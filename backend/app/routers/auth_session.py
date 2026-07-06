from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_clerk_payload
from ..database import get_db
from ..models.enums import RoleEnum
from ..models.identity import User
from ..models.roster import Client
from ..schemas.identity import WhoAmIOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/whoami", response_model=WhoAmIOut)
def whoami(payload: dict = Depends(get_clerk_payload), db: Session = Depends(get_db)):
    """Resolve what kind of account this verified login maps to, WITHOUT
    provisioning anything. The apps call this right after sign-in/sign-up to
    decide between the trainer UI, the client portal, or (role=None) a
    first-time flow such as trainer onboarding or invite redemption."""
    clerk_user_id: str = payload["sub"]

    trainer = (
        db.query(User)
        .filter(User.clerk_user_id == clerk_user_id, User.role == RoleEnum.trainer)
        .first()
    )
    if trainer is not None:
        return WhoAmIOut(role="trainer")

    client_user = (
        db.query(User)
        .filter(User.clerk_user_id == clerk_user_id, User.role == RoleEnum.client)
        .first()
    )
    if client_user is not None:
        client = db.query(Client).filter(Client.user_id == client_user.id).first()
        if client is not None:
            return WhoAmIOut(role="client", client_id=client.id, client_name=client.name)

    return WhoAmIOut(role=None)
