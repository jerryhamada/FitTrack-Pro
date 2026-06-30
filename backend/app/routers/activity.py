from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.activity import ActivityEvent
from ..models.enums import ActivityEventTypeEnum
from ..models.identity import User
from ..models.roster import Client
from ..schemas.activity import ActivityEventOut

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityEventOut])
def list_activity(
    client_id: int | None = None,
    event_type: ActivityEventTypeEnum | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    query = db.query(ActivityEvent, Client.name).outerjoin(Client, ActivityEvent.client_id == Client.id).filter(
        ActivityEvent.trainer_id == trainer.id
    )
    if client_id is not None:
        query = query.filter(ActivityEvent.client_id == client_id)
    if event_type is not None:
        query = query.filter(ActivityEvent.event_type == event_type)
    rows = query.order_by(ActivityEvent.created_at.desc()).offset(offset).limit(limit).all()

    out = []
    for event, client_name in rows:
        o = ActivityEventOut.model_validate(event)
        o.client_name = client_name
        out.append(o)
    return out
