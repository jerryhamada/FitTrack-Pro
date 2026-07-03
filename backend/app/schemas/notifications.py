from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import NotificationTypeEnum


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: NotificationTypeEnum
    client_id: int | None
    scheduled_session_id: int | None
    workout_session_id: int | None
    message: str
    is_read: bool
    created_at: datetime


class UnreadCount(BaseModel):
    count: int
