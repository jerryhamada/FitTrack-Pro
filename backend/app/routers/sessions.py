from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.activity import ActivityEvent
from ..models.enums import ActivityEventTypeEnum
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.prs import PR
from ..models.roster import Client
from ..models.sessions import SetEntry, WorkoutSession
from ..schemas.sessions import (
    SessionListItemOut,
    SessionOut,
    SessionStart,
    SessionSummaryOut,
    SessionUpdate,
    SetCreate,
    SetOut,
    SetUpdate,
)
from ..services.badges import evaluate_badges
from ..services.pr_detection import detect_and_record_prs
from ..services.volume import session_total_volume

router = APIRouter(tags=["sessions"])


def _exercise_name_map(db: Session, exercise_ids: set[int]) -> dict[int, str]:
    if not exercise_ids:
        return {}
    rows = db.query(Exercise.id, Exercise.name).filter(Exercise.id.in_(exercise_ids)).all()
    return {r.id: r.name for r in rows}


def _session_out(db: Session, session: WorkoutSession) -> SessionOut:
    out = SessionOut.model_validate(session)
    names = _exercise_name_map(db, {s.exercise_id for s in session.sets})
    for set_out, s in zip(out.sets, session.sets):
        set_out.exercise_name = names.get(s.exercise_id, "")
    return out


def _get_session_or_404(db: Session, trainer_id: int, session_id: int) -> WorkoutSession:
    session = (
        db.query(WorkoutSession)
        .join(Client, WorkoutSession.client_id == Client.id)
        .options(joinedload(WorkoutSession.sets))
        .filter(WorkoutSession.id == session_id, Client.trainer_id == trainer_id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions", response_model=SessionOut, status_code=201)
def start_session(
    body: SessionStart, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.id == body.client_id, Client.trainer_id == trainer.id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    session = WorkoutSession(
        client_id=client.id,
        logged_by_user_id=trainer.id,
        client_program_day_id=body.client_program_day_id,
        label=body.label,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    session = _get_session_or_404(db, trainer.id, session_id)
    return _session_out(db, session)


@router.put("/sessions/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    body: SessionUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(db, trainer.id, session_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.post("/sessions/{session_id}/sets", response_model=SetOut, status_code=201)
def log_set(
    session_id: int,
    body: SetCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(db, trainer.id, session_id)
    set_number = (
        db.query(func.count(SetEntry.id))
        .filter(SetEntry.session_id == session_id, SetEntry.exercise_id == body.exercise_id)
        .scalar()
        + 1
    )
    new_set = SetEntry(session_id=session_id, set_number=set_number, **body.model_dump())
    db.add(new_set)
    db.flush()  # need new_set.id before PR detection

    detect_and_record_prs(db, session.client_id, new_set)
    db.commit()
    db.refresh(new_set)

    exercise = db.query(Exercise).filter(Exercise.id == new_set.exercise_id).first()
    out = SetOut.model_validate(new_set)
    out.exercise_name = exercise.name if exercise else ""
    return out


def _get_set_or_404(db: Session, trainer_id: int, set_id: int) -> SetEntry:
    s = (
        db.query(SetEntry)
        .join(WorkoutSession, SetEntry.session_id == WorkoutSession.id)
        .join(Client, WorkoutSession.client_id == Client.id)
        .filter(SetEntry.id == set_id, Client.trainer_id == trainer_id)
        .first()
    )
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    return s


@router.put("/sets/{set_id}", response_model=SetOut)
def update_set(
    set_id: int, body: SetUpdate, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    s = _get_set_or_404(db, trainer.id, set_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    exercise = db.query(Exercise).filter(Exercise.id == s.exercise_id).first()
    out = SetOut.model_validate(s)
    out.exercise_name = exercise.name if exercise else ""
    return out


@router.delete("/sets/{set_id}", status_code=204)
def delete_set(set_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    s = _get_set_or_404(db, trainer.id, set_id)
    db.delete(s)
    db.commit()


@router.post("/sessions/{session_id}/complete", response_model=SessionSummaryOut)
def complete_session(
    session_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    session = _get_session_or_404(db, trainer.id, session_id)
    client = db.query(Client).filter(Client.id == session.client_id).first()

    session.ended_at = datetime.now(timezone.utc)
    session.duration_seconds = int((session.ended_at - session.started_at).total_seconds())

    total_volume = session_total_volume(session.sets, client.preferred_unit)
    pr_sets = [s for s in session.sets if s.is_pr]
    names = _exercise_name_map(db, {s.exercise_id for s in pr_sets})

    db.add(
        ActivityEvent(
            trainer_id=trainer.id,
            client_id=session.client_id,
            event_type=ActivityEventTypeEnum.session_logged,
            payload={"session_id": session.id, "total_volume": total_volume, "set_count": len(session.sets)},
        )
    )
    for pr_set in pr_sets:
        db.add(
            ActivityEvent(
                trainer_id=trainer.id,
                client_id=session.client_id,
                event_type=ActivityEventTypeEnum.pr_hit,
                payload={"exercise_name": names.get(pr_set.exercise_id, ""), "set_id": pr_set.id},
            )
        )

    evaluate_badges(db, session.client_id, trainer.id)
    db.commit()
    db.refresh(session)

    pr_out = []
    for pr_set in pr_sets:
        o = SetOut.model_validate(pr_set)
        o.exercise_name = names.get(pr_set.exercise_id, "")
        pr_out.append(o)

    return SessionSummaryOut(
        session_id=session.id,
        total_volume=total_volume,
        total_volume_unit=client.preferred_unit,
        total_sets=len(session.sets),
        duration_seconds=session.duration_seconds,
        prs_hit=pr_out,
    )


@router.get("/clients/{client_id}/sessions", response_model=list[SessionListItemOut])
def list_client_sessions(
    client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer.id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    sessions = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets))
        .filter(WorkoutSession.client_id == client_id)
        .order_by(WorkoutSession.started_at.desc())
        .all()
    )
    return [
        SessionListItemOut(
            id=s.id,
            label=s.label,
            started_at=s.started_at,
            ended_at=s.ended_at,
            duration_seconds=s.duration_seconds,
            set_count=len(s.sets),
            pr_count=sum(1 for st in s.sets if st.is_pr),
        )
        for s in sessions
    ]
