from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.identity import TrainerProfile, User
from ..schemas.identity import TrainerOut, TrainerProfileUpdate

router = APIRouter(prefix="/trainer", tags=["trainer"])


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
    db.refresh(trainer)
    return trainer


@router.get("/subscription")
def get_subscription(trainer: User = Depends(get_current_trainer)):
    # Stub only -- no real billing in Phase 1, see spec T12 and Phase 3 scope.
    return {"status": "trial", "plan": None, "renews_at": None}


@router.get("/weekly-summary")
def weekly_summary(trainer: User = Depends(get_current_trainer)):
    # Stub for T11 -- lightweight first pass, fleshed out in Phase 3.
    return {"status": "not_implemented", "message": "Weekly summary generation lands in Phase 3."}
