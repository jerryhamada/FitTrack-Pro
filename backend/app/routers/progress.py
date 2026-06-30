from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.enums import SetStatusEnum, UnitEnum
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.roster import Client
from ..models.sessions import SetEntry, WorkoutSession
from ..schemas.progress import ProgressPoint, ProgressResponse, VolumeByCategoryPoint, VolumeByCategoryResponse
from ..services.one_rm import estimated_1rm
from ..services.units import from_lbs, to_lbs, total_load
from ..services.volume import set_volume_lbs

router = APIRouter(tags=["progress"])


def _client_or_404(db: Session, trainer_id: int, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/clients/{client_id}/progress", response_model=ProgressResponse)
def get_progress(
    client_id: int,
    exercise_id: int = Query(...),
    metric: Literal["1rm", "weight"] = "1rm",
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = _client_or_404(db, trainer.id, client_id)
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    sets = (
        db.query(SetEntry, WorkoutSession.started_at)
        .join(WorkoutSession, SetEntry.session_id == WorkoutSession.id)
        .filter(
            WorkoutSession.client_id == client_id,
            SetEntry.exercise_id == exercise_id,
            SetEntry.status == SetStatusEnum.completed,
            SetEntry.weight.isnot(None),
            SetEntry.reps.isnot(None),
        )
        .order_by(WorkoutSession.started_at)
        .all()
    )

    best_per_day: dict = {}
    for s, started_at in sets:
        load_lbs = to_lbs(total_load(s.weight, s.is_per_side), s.weight_unit or UnitEnum.lbs)
        value_lbs = estimated_1rm(load_lbs, s.reps) if metric == "1rm" else load_lbs
        day = started_at.date()
        if day not in best_per_day or value_lbs > best_per_day[day]:
            best_per_day[day] = value_lbs

    points = [
        ProgressPoint(date=day, value=round(from_lbs(value, client.preferred_unit), 2))
        for day, value in sorted(best_per_day.items())
    ]
    return ProgressResponse(
        exercise_id=exercise_id, exercise_name=exercise.name, metric=metric, unit=client.preferred_unit, points=points
    )


@router.get("/clients/{client_id}/volume-by-category", response_model=VolumeByCategoryResponse)
def get_volume_by_category(
    client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    client = _client_or_404(db, trainer.id, client_id)

    rows = (
        db.query(SetEntry, WorkoutSession.started_at, Exercise.category)
        .join(WorkoutSession, SetEntry.session_id == WorkoutSession.id)
        .join(Exercise, SetEntry.exercise_id == Exercise.id)
        .filter(WorkoutSession.client_id == client_id)
        .all()
    )

    totals: dict[tuple, float] = defaultdict(float)
    for s, started_at, category in rows:
        week_start = (started_at - timedelta(days=started_at.weekday())).date()
        totals[(week_start, category)] += set_volume_lbs(s)

    points = [
        VolumeByCategoryPoint(
            period_start=period_start, category=category, total_volume=round(from_lbs(total, client.preferred_unit), 2)
        )
        for (period_start, category), total in sorted(totals.items())
        if total > 0
    ]
    return VolumeByCategoryResponse(unit=client.preferred_unit, points=points)
