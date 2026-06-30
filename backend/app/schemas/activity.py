from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import ActivityEventTypeEnum


class ActivityEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int | None
    client_name: str | None = None
    event_type: ActivityEventTypeEnum
    payload: dict | None
    created_at: datetime
