from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.identity import TrainerProfile, User
from ..schemas.identity import JoinCodeOut, TrainerOut, TrainerProfileUpdate

router = APIRouter(prefix="/trainer", tags=["trainer"])

# No ambiguous characters (0/O, 1/I/L) — the code is read aloud in a gym.
_JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
JOIN_CODE_LENGTH = 6


def _generate_join_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(JOIN_CODE_LENGTH))
        taken = db.query(TrainerProfile.id).filter(TrainerProfile.join_code == code).first()
        if taken is None:
            return code
    raise HTTPException(status_code=500, detail="Couldn't generate a unique code — try again.")


@router.get("/me", response_model=TrainerOut)
def get_me(trainer: User = Depends(get_current_trainer)):
    return trainer


@router.put("/me", response_model=TrainerOut)
def update_me(
    body: TrainerProfileUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    profile = db.query(TrainerProfile).filter(TrainerProfile.user_id == trainer.id).first()
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    trainer.profile = profile
    return trainer


@router.get("/join-code", response_model=JoinCodeOut)
def get_join_code(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    """The trainer's shareable join code (null until one is generated)."""
    profile = db.query(TrainerProfile).filter(TrainerProfile.user_id == trainer.id).first()
    return JoinCodeOut(code=profile.join_code if profile else None)


@router.post("/join-code", response_model=JoinCodeOut)
def generate_join_code(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    """Create (or rotate) the trainer's join code. Rotating invalidates the old
    code immediately — anyone still holding it can no longer join."""
    profile = db.query(TrainerProfile).filter(TrainerProfile.user_id == trainer.id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    profile.join_code = _generate_join_code(db)
    db.commit()
    db.refresh(profile)
    return JoinCodeOut(code=profile.join_code)


@router.get("/subscription")
def get_subscription(trainer: User = Depends(get_current_trainer)):
    # Stub only -- no real billing in Phase 1, see spec T12 and Phase 3 scope.
    return {"status": "trial", "plan": None, "renews_at": None}


@router.get("/weekly-summary")
def weekly_summary(trainer: User = Depends(get_current_trainer)):
    # Stub for T11 -- lightweight first pass, fleshed out in Phase 3.
    return {"status": "not_implemented", "message": "Weekly summary generation lands in Phase 3."}
