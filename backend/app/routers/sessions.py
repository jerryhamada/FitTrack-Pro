from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.activity import ActivityEvent
from ..models.enums import ActivityEventTypeEnum, ScheduledStatusEnum
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.prs import PR
from ..models.programs import ClientProgramExercise
from ..models.roster import Client
from ..models.schedule import ScheduledSession
from ..models.sessions import SessionExercise, SetEntry, WorkoutSession
from ..schemas.sessions import (
    ActiveSessionOut,
    AddSessionExerciseIn,
    MoveExerciseIn,
    PlannedExerciseOut,
    SessionExerciseOut,
    SupersetCreateIn,
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
    ex_ids = {s.exercise_id for s in session.sets} | {se.exercise_id for se in session.exercises}
    names = _exercise_name_map(db, ex_ids)
    for set_out, s in zip(out.sets, session.sets):
        set_out.exercise_name = names.get(s.exercise_id, "")
    out.session_exercises = [
        SessionExerciseOut(
            exercise_id=se.exercise_id,
            exercise_name=names.get(se.exercise_id, ""),
            order_index=se.order_index,
            superset_group_id=se.superset_group_id,
            superset_order=se.superset_order,
        )
        for se in sorted(session.exercises, key=lambda e: e.order_index)
    ]

    if session.client_program_day_id is not None:
        planned = (
            db.query(ClientProgramExercise)
            .filter(ClientProgramExercise.client_program_day_id == session.client_program_day_id)
            .order_by(ClientProgramExercise.order_index)
            .all()
        )
        plan_names = _exercise_name_map(db, {p.exercise_id for p in planned})
        out.planned_exercises = [
            PlannedExerciseOut(
                exercise_id=p.exercise_id,
                exercise_name=plan_names.get(p.exercise_id, ""),
                target_sets=p.target_sets,
                target_reps=p.target_reps,
                target_weight=float(p.target_weight) if p.target_weight is not None else None,
                target_weight_unit=p.target_weight_unit,
                target_rpe=float(p.target_rpe) if p.target_rpe is not None else None,
                target_rest_seconds=p.target_rest_seconds,
                notes=p.notes,
            )
            for p in planned
        ]
    return out


def _ensure_membership(db: Session, session: WorkoutSession, exercise_id: int) -> SessionExercise:
    """Idempotently ensure the exercise is a member of the session; appends at the
    end if new. Used both by explicit add and lazily when a set is first logged."""
    existing = next((se for se in session.exercises if se.exercise_id == exercise_id), None)
    if existing is not None:
        return existing
    next_order = max((se.order_index for se in session.exercises), default=-1) + 1
    membership = SessionExercise(session_id=session.id, exercise_id=exercise_id, order_index=next_order)
    db.add(membership)
    session.exercises.append(membership)
    return membership


def _next_group_letter(session: WorkoutSession) -> str:
    used = {se.superset_group_id for se in session.exercises if se.superset_group_id}
    for i in range(26):
        letter = chr(ord("A") + i)
        if letter not in used:
            return letter
    return f"G{len(used) + 1}"


def _get_session_or_404(db: Session, trainer_id: int, session_id: int) -> WorkoutSession:
    session = (
        db.query(WorkoutSession)
        .join(Client, WorkoutSession.client_id == Client.id)
        .options(joinedload(WorkoutSession.sets), joinedload(WorkoutSession.exercises))
        .filter(WorkoutSession.id == session_id, Client.trainer_id == trainer_id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/active", response_model=ActiveSessionOut | None)
def get_active_session(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    """The trainer's most recently started in-progress session (if any), across all
    clients. Powers the "Current Workout" button's resume-vs-start-fresh choice."""
    session = (
        db.query(WorkoutSession)
        .join(Client, WorkoutSession.client_id == Client.id)
        .filter(Client.trainer_id == trainer.id, WorkoutSession.ended_at.is_(None))
        # started_at alone can tie (Postgres now() is constant per transaction), so
        # break ties on id to deterministically pick the most-recently-created one.
        .order_by(WorkoutSession.started_at.desc(), WorkoutSession.id.desc())
        .first()
    )
    if session is None:
        return None
    client = db.query(Client).filter(Client.id == session.client_id).first()
    return ActiveSessionOut(
        id=session.id,
        client_id=session.client_id,
        client_name=client.name if client else "",
        label=session.label,
        started_at=session.started_at,
    )


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


@router.delete("/sessions/{session_id}", status_code=204)
def cancel_session(
    session_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    """Cancel a session and discard everything logged in it (e.g. started on the
    wrong client). PR rows earned by its sets are rolled back too so records stay
    consistent."""
    session = _get_session_or_404(db, trainer.id, session_id)
    if session.ended_at is not None:
        raise HTTPException(status_code=400, detail="Can't cancel a completed session")
    set_ids = [s.id for s in session.sets]
    if set_ids:
        db.query(PR).filter(PR.set_id.in_(set_ids)).delete(synchronize_session=False)
    # Unlink any scheduled slot that pointed at this workout (slot stays 'upcoming').
    db.query(ScheduledSession).filter(ScheduledSession.workout_session_id == session.id).update(
        {"workout_session_id": None}, synchronize_session=False
    )
    db.delete(session)  # sets cascade via the ORM relationship
    db.commit()


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
    _ensure_membership(db, session, body.exercise_id)  # first set for an exercise joins the session
    db.flush()  # need new_set.id before PR detection

    detect_and_record_prs(db, session.client_id, new_set)
    db.commit()
    db.refresh(new_set)

    exercise = db.query(Exercise).filter(Exercise.id == new_set.exercise_id).first()
    out = SetOut.model_validate(new_set)
    out.exercise_name = exercise.name if exercise else ""
    return out


@router.post("/sessions/{session_id}/exercises", response_model=SessionOut, status_code=201)
def add_session_exercise(
    session_id: int,
    body: AddSessionExerciseIn,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Add an exercise to the session before any set is logged (e.g. building a
    superset). Idempotent."""
    session = _get_session_or_404(db, trainer.id, session_id)
    _ensure_membership(db, session, body.exercise_id)
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.post("/sessions/{session_id}/supersets", response_model=SessionOut)
def create_superset(
    session_id: int,
    body: SupersetCreateIn,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Group 2+ exercises into a superset (auto-lettered). Members keep their sets;
    grouping only sets superset_group_id/order. Any member already in another group
    is moved into this one."""
    if len(body.exercise_ids) < 2:
        raise HTTPException(status_code=422, detail="A superset needs at least 2 exercises")
    session = _get_session_or_404(db, trainer.id, session_id)
    memberships = []
    for ex_id in body.exercise_ids:
        memberships.append(_ensure_membership(db, session, ex_id))
    db.flush()

    group_id = _next_group_letter(session)
    # Position the group where its first member currently sits.
    anchor_order = min(m.order_index for m in memberships)
    for i, m in enumerate(memberships):
        m.superset_group_id = group_id
        m.superset_order = i
        m.order_index = anchor_order + i
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.delete("/sessions/{session_id}/supersets/{group_id}", response_model=SessionOut)
def ungroup_superset(
    session_id: int,
    group_id: str,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Ungroup a superset — members become standalone again. Logged sets untouched."""
    session = _get_session_or_404(db, trainer.id, session_id)
    for se in session.exercises:
        if se.superset_group_id == group_id:
            se.superset_group_id = None
            se.superset_order = None
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


@router.put("/sessions/{session_id}/exercises/{exercise_id}", response_model=SessionOut)
def move_session_exercise(
    session_id: int,
    exercise_id: int,
    body: MoveExerciseIn,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Move an exercise into a group (superset_group_id set) or out of one (null).
    Logged sets are preserved."""
    session = _get_session_or_404(db, trainer.id, session_id)
    membership = next((se for se in session.exercises if se.exercise_id == exercise_id), None)
    if membership is None:
        raise HTTPException(status_code=404, detail="Exercise not in this session")
    membership.superset_group_id = body.superset_group_id
    if body.superset_group_id is None:
        membership.superset_order = None
    else:
        if body.superset_order is not None:
            membership.superset_order = body.superset_order
        else:
            peers = [se for se in session.exercises if se.superset_group_id == body.superset_group_id]
            membership.superset_order = max((se.superset_order or 0 for se in peers), default=-1) + 1
    db.commit()
    db.refresh(session)
    return _session_out(db, session)


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

    # Auto-resolve the scheduled slot this workout was started from (if any).
    db.query(ScheduledSession).filter(ScheduledSession.workout_session_id == session.id).update(
        {"status": ScheduledStatusEnum.completed}, synchronize_session=False
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
    client_id: int,
    exercise_id: int | None = None,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
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
    if exercise_id is not None:
        sessions = [s for s in sessions if any(st.exercise_id == exercise_id for st in s.sets)]
    return [
        SessionListItemOut(
            id=s.id,
            label=s.label,
            started_at=s.started_at,
            ended_at=s.ended_at,
            duration_seconds=s.duration_seconds,
            set_count=len(s.sets),
            pr_count=sum(1 for st in s.sets if st.is_pr),
            exercise_count=len({st.exercise_id for st in s.sets}),
            total_volume=round(session_total_volume(s.sets, client.preferred_unit), 1),
            total_volume_unit=client.preferred_unit,
            notes_preview=(s.notes[:80] if s.notes else None),
        )
        for s in sessions
    ]
