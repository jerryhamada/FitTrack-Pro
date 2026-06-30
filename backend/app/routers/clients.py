from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.activity import ActivityEvent
from ..models.enums import ActivityEventTypeEnum, ClientStatusEnum
from ..models.exercises import Exercise
from ..models.identity import User
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

STALE_DAYS = 10  # Hardcoded per spec; configurable later.


def _week_start(now: datetime) -> datetime:
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("", response_model=list[ClientPulseOut])
def list_clients(
    status: ClientStatusEnum = ClientStatusEnum.active,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    clients = db.query(Client).filter(Client.trainer_id == trainer.id, Client.status == status).all()
    now = datetime.now(timezone.utc)
    week_start = _week_start(now)
    stale_cutoff = now - timedelta(days=STALE_DAYS)

    out: list[ClientPulseOut] = []
    for c in clients:
        last_session = (
            db.query(WorkoutSession)
            .filter(WorkoutSession.client_id == c.id)
            .order_by(WorkoutSession.started_at.desc())
            .first()
        )
        sessions_this_week = (
            db.query(func.count(WorkoutSession.id))
            .filter(WorkoutSession.client_id == c.id, WorkoutSession.started_at >= week_start)
            .scalar()
        )
        recent_pr = (
            db.query(PR, Exercise)
            .join(Exercise, PR.exercise_id == Exercise.id)
            .filter(PR.client_id == c.id)
            .order_by(PR.achieved_at.desc())
            .first()
        )
        recent_pr_label = None
        if recent_pr:
            pr, exercise = recent_pr
            recent_pr_label = f"{exercise.name}: {pr.value:g} {pr.unit.value}" + (
                f" x {pr.reps}" if pr.reps else ""
            )

        out.append(
            ClientPulseOut(
                **ClientOut.model_validate(c).model_dump(),
                last_session_at=last_session.started_at if last_session else None,
                sessions_this_week=sessions_this_week or 0,
                recent_pr_label=recent_pr_label,
                is_stale=(last_session is None or last_session.started_at < stale_cutoff),
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
