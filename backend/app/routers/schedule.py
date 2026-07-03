from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.enums import ClientStatusEnum, ScheduledStatusEnum
from ..models.identity import User
from ..models.roster import Client
from ..models.schedule import ScheduledSession
from ..models.sessions import WorkoutSession
from ..schemas.schedule import (
    CancelScope,
    ScheduledSessionCreate,
    ScheduledSessionOut,
    ScheduledSessionUpdate,
)
from ..schemas.sessions import SessionOut
from .sessions import _session_out

router = APIRouter(prefix="/schedule", tags=["schedule"])

REPEAT_WINDOW_WEEKS = 8  # rolling generation window for recurring sessions


def _to_out(s: ScheduledSession) -> ScheduledSessionOut:
    out = ScheduledSessionOut.model_validate(s)
    out.client_name = s.client.name if s.client else ""
    out.client_photo_url = s.client.photo_url if s.client else None
    return out


def _get_scheduled_or_404(db: Session, trainer_id: int, scheduled_id: int) -> ScheduledSession:
    s = (
        db.query(ScheduledSession)
        .options(joinedload(ScheduledSession.client))
        .filter(ScheduledSession.id == scheduled_id, ScheduledSession.trainer_id == trainer_id)
        .first()
    )
    if s is None:
        raise HTTPException(status_code=404, detail="Scheduled session not found")
    return s


@router.get("", response_model=list[ScheduledSessionOut])
def list_schedule(
    start: date = Query(...),
    end: date = Query(...),
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    rows = (
        db.query(ScheduledSession)
        .options(joinedload(ScheduledSession.client))
        .filter(
            ScheduledSession.trainer_id == trainer.id,
            ScheduledSession.scheduled_at >= start_dt,
            ScheduledSession.scheduled_at < end_dt,
        )
        .order_by(ScheduledSession.scheduled_at)
        .all()
    )
    return [_to_out(s) for s in rows]


@router.get("/needs-review", response_model=list[ScheduledSessionOut])
def needs_review(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    """Past sessions still marked 'upcoming' — surfaced so the trainer resolves them
    instead of letting them sit in limbo."""
    rows = (
        db.query(ScheduledSession)
        .options(joinedload(ScheduledSession.client))
        .filter(
            ScheduledSession.trainer_id == trainer.id,
            ScheduledSession.status == ScheduledStatusEnum.upcoming,
            ScheduledSession.scheduled_at < datetime.now(timezone.utc) - timedelta(hours=2),
        )
        .order_by(ScheduledSession.scheduled_at)
        .all()
    )
    return [_to_out(s) for s in rows]


@router.post("", response_model=list[ScheduledSessionOut], status_code=201)
def create_scheduled(
    body: ScheduledSessionCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = (
        db.query(Client)
        .filter(
            Client.id == body.client_id,
            Client.trainer_id == trainer.id,
            Client.status == ClientStatusEnum.active,
        )
        .first()
    )
    if client is None:
        raise HTTPException(status_code=404, detail="Active client not found")

    occurrences: list[datetime] = [body.scheduled_at]
    series_id = None
    if body.repeat is not None:
        series_id = uuid.uuid4().hex
        step = timedelta(weeks=1 if body.repeat.value == "weekly" else 2)
        window_end = body.scheduled_at + timedelta(weeks=REPEAT_WINDOW_WEEKS)
        if body.repeat_until is not None:
            until_dt = datetime.combine(
                body.repeat_until + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
            )
            window_end = min(window_end, until_dt)
        next_at = body.scheduled_at + step
        while next_at < window_end:
            occurrences.append(next_at)
            next_at += step

    rows = [
        ScheduledSession(
            trainer_id=trainer.id,
            client_id=client.id,
            scheduled_at=at,
            repeat_rule=body.repeat,
            series_id=series_id,
            notes=body.notes,
        )
        for at in occurrences
    ]
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
        r.client = client
    return [_to_out(r) for r in rows]


@router.put("/{scheduled_id}", response_model=ScheduledSessionOut)
def update_scheduled(
    scheduled_id: int,
    body: ScheduledSessionUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    s = _get_scheduled_or_404(db, trainer.id, scheduled_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return _to_out(s)


@router.post("/{scheduled_id}/cancel", response_model=list[ScheduledSessionOut])
def cancel_scheduled(
    scheduled_id: int,
    body: CancelScope,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    s = _get_scheduled_or_404(db, trainer.id, scheduled_id)
    targets = [s]
    if body.scope == "future" and s.series_id:
        targets = (
            db.query(ScheduledSession)
            .options(joinedload(ScheduledSession.client))
            .filter(
                ScheduledSession.trainer_id == trainer.id,
                ScheduledSession.series_id == s.series_id,
                ScheduledSession.scheduled_at >= s.scheduled_at,
                ScheduledSession.status == ScheduledStatusEnum.upcoming,
            )
            .all()
        )
    for t in targets:
        t.status = ScheduledStatusEnum.cancelled
    db.commit()
    return [_to_out(t) for t in targets]


@router.delete("/{scheduled_id}", status_code=204)
def delete_scheduled(
    scheduled_id: int,
    scope: str = Query("one", pattern="^(one|future)$"),
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    s = _get_scheduled_or_404(db, trainer.id, scheduled_id)
    if scope == "future" and s.series_id:
        db.query(ScheduledSession).filter(
            ScheduledSession.trainer_id == trainer.id,
            ScheduledSession.series_id == s.series_id,
            ScheduledSession.scheduled_at >= s.scheduled_at,
        ).delete(synchronize_session=False)
    else:
        db.delete(s)
    db.commit()


@router.post("/{scheduled_id}/start-workout", response_model=SessionOut)
def start_workout_from_schedule(
    scheduled_id: int,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Start logging the scheduled session: creates a workout for the client, links it
    to this scheduled slot, and returns it. Completing the workout auto-marks the
    slot as completed."""
    s = _get_scheduled_or_404(db, trainer.id, scheduled_id)
    if s.status == ScheduledStatusEnum.completed:
        raise HTTPException(status_code=400, detail="This session is already completed")
    if s.workout_session_id is not None:
        existing = db.query(WorkoutSession).filter(WorkoutSession.id == s.workout_session_id).first()
        if existing is not None and existing.ended_at is None:
            return _session_out(db, existing)  # resume the in-progress workout

    workout = WorkoutSession(client_id=s.client_id, logged_by_user_id=trainer.id)
    db.add(workout)
    db.flush()
    s.workout_session_id = workout.id
    if s.status == ScheduledStatusEnum.cancelled:
        s.status = ScheduledStatusEnum.upcoming  # training anyway — revive the slot
    db.commit()
    db.refresh(workout)
    return _session_out(db, workout)
