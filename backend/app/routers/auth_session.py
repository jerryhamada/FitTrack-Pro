from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_clerk_payload
from ..database import get_db
from ..models.enums import LinkRequestStatusEnum, RoleEnum
from ..models.identity import User
from ..models.roster import Client, TrainerLinkRequest
from ..schemas.identity import RegisterClientOut, WhoAmIOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _link_status(client: Client, db: Session) -> str:
    if client.trainer_id is not None:
        return "linked"
    pending = (
        db.query(TrainerLinkRequest.id)
        .filter(
            TrainerLinkRequest.client_id == client.id,
            TrainerLinkRequest.status == LinkRequestStatusEnum.pending,
        )
        .first()
    )
    return "pending" if pending else "none"


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
            return WhoAmIOut(
                role="client",
                client_id=client.id,
                client_name=client.name,
                trainer_link_status=_link_status(client, db),
            )

    return WhoAmIOut(role=None)


@router.post("/register-client", response_model=RegisterClientOut)
def register_client(payload: dict = Depends(get_clerk_payload), db: Session = Depends(get_db)):
    """Provision a standalone client account for a login that chose "I'm a Client"
    at signup without an invite. Creates the users row plus an unlinked Client row
    (trainer_id NULL) that a trainer link request can attach later. Idempotent:
    calling it again for an already-provisioned client returns the existing row."""
    clerk_user_id: str = payload["sub"]

    # One login = one role, same rule as invite redemption.
    is_trainer = (
        db.query(User.id)
        .filter(User.clerk_user_id == clerk_user_id, User.role == RoleEnum.trainer)
        .first()
        is not None
    )
    if is_trainer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This login is already a trainer account.",
        )

    user = (
        db.query(User)
        .filter(User.clerk_user_id == clerk_user_id, User.role == RoleEnum.client)
        .first()
    )
    if user is not None:
        existing = db.query(Client).filter(Client.user_id == user.id).first()
        if existing is not None:
            return RegisterClientOut(client_id=existing.id, client_name=existing.name)
    else:
        user = User(
            clerk_user_id=clerk_user_id,
            role=RoleEnum.client,
            email=payload.get("email"),
            name=payload.get("name"),
        )
        db.add(user)
        db.flush()

    email = payload.get("email")
    name = payload.get("name") or (email.split("@")[0] if email else "New Client")
    client = Client(trainer_id=None, user_id=user.id, name=name, email=email)
    db.add(client)
    db.commit()
    db.refresh(client)
    return RegisterClientOut(client_id=client.id, client_name=client.name)
