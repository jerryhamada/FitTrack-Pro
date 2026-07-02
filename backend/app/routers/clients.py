from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.activity import ActivityEvent
from ..models.enums import ActivityEventTypeEnum, ClientStatusEnum
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.programs import ClientProgram
from ..models.prs import PR
from ..models.roster import Client, ClientNote, Invite
from ..models.sessions import WorkoutSession
from ..schemas.roster import (
    ClientCreate,
    ClientCreateResponse,
    ClientNoteCreate,
    ClientNoteOut,
    ClientOut,
    ClientPulseOut,
    ClientUpdate,
    InviteOut,
)
from ..services.invites import create_invite, send_invite

router = APIRouter(prefix="/clients", tags=["clients"])

STALE_DAYS = 7  # "Inactive 7+ days" — keep in sync with routers/dashboard.py


def _week_start(now: datetime) -> datetime:
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _prev_iso_week(iso_week: tuple[int, int]) -> tuple[int, int]:
    monday = date.fromisocalendar(iso_week[0], iso_week[1], 1) - timedelta(weeks=1)
    iso = monday.isocalendar()
    return (iso[0], iso[1])


def _streak_weeks(completed_weeks: set[tuple[int, int]], today: date) -> int:
    """Consecutive ISO weeks with >=1 completed session, counting backward from the
    current week. Mid-week grace: if the current week has no session yet, the streak
    may start at the previous week."""
    iso = today.isocalendar()
    week = (iso[0], iso[1])
    if week not in completed_weeks:
        week = _prev_iso_week(week)
    streak = 0
    while week in completed_weeks:
        streak += 1
        week = _prev_iso_week(week)
    return streak


def _training_phase(program: ClientProgram, today: date) -> str:
    if program.start_date is None:
        return program.name
    week = (today - program.start_date).days // 7 + 1
    if week < 1:
        return program.name
    return f"{program.name} — Week {week}"


@router.get("", response_model=list[ClientPulseOut])
def list_clients(
    status: Literal["active", "archived", "all"] = "active",
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    query = db.query(Client).filter(Client.trainer_id == trainer.id)
    if status != "all":
        query = query.filter(Client.status == ClientStatusEnum(status))
    clients = query.all()
    client_ids = [c.id for c in clients]

    now = datetime.now(timezone.utc)
    today = now.date()
    week_start = _week_start(now)
    stale_cutoff = now - timedelta(days=STALE_DAYS)

    last_session_by_client: dict[int, datetime] = {}
    sessions_this_week_by_client: dict[int, int] = {}
    completed_weeks_by_client: dict[int, set[tuple[int, int]]] = {}
    recent_pr_label_by_client: dict[int, str] = {}
    training_phase_by_client: dict[int, str] = {}

    if client_ids:
        last_session_by_client = dict(
            db.query(WorkoutSession.client_id, func.max(WorkoutSession.started_at))
            .filter(WorkoutSession.client_id.in_(client_ids))
            .group_by(WorkoutSession.client_id)
            .all()
        )
        sessions_this_week_by_client = dict(
            db.query(WorkoutSession.client_id, func.count(WorkoutSession.id))
            .filter(WorkoutSession.client_id.in_(client_ids), WorkoutSession.started_at >= week_start)
            .group_by(WorkoutSession.client_id)
            .all()
        )
        completed_rows = (
            db.query(WorkoutSession.client_id, WorkoutSession.started_at)
            .filter(WorkoutSession.client_id.in_(client_ids), WorkoutSession.ended_at.isnot(None))
            .all()
        )
        for client_id, started_at in completed_rows:
            iso = started_at.astimezone(timezone.utc).date().isocalendar()
            completed_weeks_by_client.setdefault(client_id, set()).add((iso[0], iso[1]))

        # Most recent PR per client (Postgres DISTINCT ON).
        pr_rows = (
            db.query(PR, Exercise)
            .join(Exercise, PR.exercise_id == Exercise.id)
            .filter(PR.client_id.in_(client_ids))
            .order_by(PR.client_id, PR.achieved_at.desc())
            .distinct(PR.client_id)
            .all()
        )
        for pr, exercise in pr_rows:
            recent_pr_label_by_client[pr.client_id] = f"{exercise.name}: {pr.value:g} {pr.unit.value}" + (
                f" x {pr.reps}" if pr.reps else ""
            )

        # Most recently assigned active program per client.
        active_programs = (
            db.query(ClientProgram)
            .filter(ClientProgram.client_id.in_(client_ids), ClientProgram.active.is_(True))
            .order_by(ClientProgram.client_id, ClientProgram.assigned_at.desc())
            .distinct(ClientProgram.client_id)
            .all()
        )
        for program in active_programs:
            training_phase_by_client[program.client_id] = _training_phase(program, today)

    out: list[ClientPulseOut] = []
    for c in clients:
        last_session_at = last_session_by_client.get(c.id)
        out.append(
            ClientPulseOut(
                **ClientOut.model_validate(c).model_dump(),
                last_session_at=last_session_at,
                sessions_this_week=sessions_this_week_by_client.get(c.id, 0),
                recent_pr_label=recent_pr_label_by_client.get(c.id),
                is_stale=(last_session_at is None or last_session_at < stale_cutoff),
                training_phase=training_phase_by_client.get(c.id),
                streak_weeks=_streak_weeks(completed_weeks_by_client.get(c.id, set()), today),
            )
        )
    return out


@router.post("", response_model=ClientCreateResponse, status_code=201)
def create_client(
    body: ClientCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = Client(trainer_id=trainer.id, **body.model_dump())
    db.add(client)
    db.flush()

    invite = create_invite(client.id)
    db.add(invite)
    db.flush()
    send_invite(invite)

    db.add(
        ActivityEvent(
            trainer_id=trainer.id,
            client_id=client.id,
            event_type=ActivityEventTypeEnum.client_added,
            payload={"client_name": client.name},
        )
    )
    db.add(
        ActivityEvent(
            trainer_id=trainer.id,
            client_id=client.id,
            event_type=ActivityEventTypeEnum.invite_sent,
            payload={"invite_id": invite.id},
        )
    )
    db.commit()
    db.refresh(client)
    db.refresh(invite)
    return ClientCreateResponse(client=ClientOut.model_validate(client), invite=InviteOut.from_invite(invite))


def _get_client_or_404(db: Session, trainer_id: int, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    return _get_client_or_404(db, trainer.id, client_id)


@router.put("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    body: ClientUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer.id, client_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.post("/{client_id}/archive", response_model=ClientOut)
def archive_client(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    client = _get_client_or_404(db, trainer.id, client_id)
    client.status = ClientStatusEnum.archived
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    """Hard-delete a client. Refused once workout history exists — archive instead,
    so sessions/PRs stay available for records."""
    client = _get_client_or_404(db, trainer.id, client_id)
    has_sessions = (
        db.query(WorkoutSession.id).filter(WorkoutSession.client_id == client_id).first() is not None
    )
    if has_sessions:
        raise HTTPException(
            status_code=409,
            detail="This client has logged workouts. Archive them instead to keep their history.",
        )
    # Programs assigned to the client (days/exercises cascade via ORM relationships).
    for program in db.query(ClientProgram).filter(ClientProgram.client_id == client_id).all():
        db.delete(program)
    db.query(ActivityEvent).filter(ActivityEvent.client_id == client_id).delete()
    db.delete(client)  # notes + invites cascade
    db.commit()


@router.get("/{client_id}/notes", response_model=list[ClientNoteOut])
def list_notes(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    _get_client_or_404(db, trainer.id, client_id)
    return (
        db.query(ClientNote)
        .filter(ClientNote.client_id == client_id)
        .order_by(ClientNote.created_at.desc())
        .all()
    )


@router.post("/{client_id}/notes", response_model=ClientNoteOut, status_code=201)
def add_note(
    client_id: int,
    body: ClientNoteCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    _get_client_or_404(db, trainer.id, client_id)
    note = ClientNote(client_id=client_id, trainer_id=trainer.id, **body.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.post("/{client_id}/invite/resend", response_model=InviteOut)
def resend_invite(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    client = _get_client_or_404(db, trainer.id, client_id)
    invite = create_invite(client.id)
    db.add(invite)
    db.flush()
    send_invite(invite)
    db.add(
        ActivityEvent(
            trainer_id=trainer.id,
            client_id=client.id,
            event_type=ActivityEventTypeEnum.invite_sent,
            payload={"invite_id": invite.id},
        )
    )
    db.commit()
    db.refresh(invite)
    return InviteOut.from_invite(invite)
