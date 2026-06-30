from __future__ import annotations

import calendar as calendar_module
from collections import Counter, defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.roster import Client
from ..models.sessions import WorkoutSession
from ..schemas.progress import CalendarDayOut, CalendarResponse, CalendarSessionOut

router = APIRouter(tags=["calendar"])


@router.get("/clients/{client_id}/calendar", response_model=CalendarResponse)
def get_calendar(
    client_id: int,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer.id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    _, last_day = calendar_module.monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, last_day)

    sessions = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets))
        .filter(WorkoutSession.client_id == client_id)
        .all()
    )
    sessions = [s for s in sessions if start <= s.started_at.date() <= end]

    exercise_ids = {st.exercise_id for s in sessions for st in s.sets}
    categories = {}
    if exercise_ids:
        categories = {
            e.id: e.category for e in db.query(Exercise).filter(Exercise.id.in_(exercise_ids)).all()
        }

    by_day: dict[date, list[WorkoutSession]] = defaultdict(list)
    for s in sessions:
        by_day[s.started_at.date()].append(s)

    days = []
    for day, day_sessions in sorted(by_day.items()):
        session_outs = []
        for s in day_sessions:
            cat_counts = Counter(categories.get(st.exercise_id) for st in s.sets if st.exercise_id in categories)
            dominant_category = cat_counts.most_common(1)[0][0] if cat_counts else None
            session_outs.append(
                CalendarSessionOut(
                    id=s.id, label=s.label, category=dominant_category, started_at=s.started_at.isoformat()
                )
            )
        days.append(CalendarDayOut(date=day, sessions=session_outs))

    return CalendarResponse(year=year, month=month, days=days)
