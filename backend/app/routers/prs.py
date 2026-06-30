from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.prs import PR, ClientBadge
from ..models.roster import Client
from ..schemas.prs import ClientBadgeOut, PROut

router = APIRouter(tags=["prs"])


def _client_or_404(db: Session, trainer_id: int, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/clients/{client_id}/prs", response_model=list[PROut])
def list_prs(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    _client_or_404(db, trainer.id, client_id)
    rows = (
        db.query(PR, Exercise)
        .join(Exercise, PR.exercise_id == Exercise.id)
        .filter(PR.client_id == client_id)
        .order_by(PR.achieved_at.desc())
        .all()
    )
    out = []
    for pr, exercise in rows:
        o = PROut.model_validate(pr)
        o.exercise_name = exercise.name
        out.append(o)
    return out


@router.get("/clients/{client_id}/badges", response_model=list[ClientBadgeOut])
def list_badges(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    _client_or_404(db, trainer.id, client_id)
    rows = (
        db.query(ClientBadge)
        .filter(ClientBadge.client_id == client_id)
        .order_by(ClientBadge.earned_at.desc())
        .all()
    )
    return [ClientBadgeOut(badge=cb.badge, earned_at=cb.earned_at) for cb in rows]
