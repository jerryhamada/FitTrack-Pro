from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.identity import User
from ..models.notifications import Notification
from ..schemas.notifications import NotificationOut, UnreadCount
from ..services.notifications import generate_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(100, ge=1, le=200),
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    generate_notifications(db, trainer.id)
    query = db.query(Notification).filter(Notification.trainer_id == trainer.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    generate_notifications(db, trainer.id)
    count = (
        db.query(func.count(Notification.id))
        .filter(Notification.trainer_id == trainer.id, Notification.is_read.is_(False))
        .scalar()
    ) or 0
    return UnreadCount(count=count)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    n = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.trainer_id == trainer.id)
        .first()
    )
    if n is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/read-all", response_model=UnreadCount)
def mark_all_read(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.trainer_id == trainer.id, Notification.is_read.is_(False)
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return UnreadCount(count=0)
