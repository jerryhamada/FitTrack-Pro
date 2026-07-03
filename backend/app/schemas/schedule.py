from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from ..models.enums import RepeatRuleEnum, ScheduledStatusEnum


class ScheduledSessionCreate(BaseModel):
    client_id: int
    scheduled_at: datetime
    repeat: RepeatRuleEnum | None = None
    repeat_until: date | None = None  # only meaningful with repeat; capped at the rolling window
    notes: str | None = None


class ScheduledSessionUpdate(BaseModel):
    scheduled_at: datetime | None = None
    status: ScheduledStatusEnum | None = None
    notes: str | None = None


class ScheduledSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_name: str = ""
    client_photo_url: str | None = None
    scheduled_at: datetime
    status: ScheduledStatusEnum
    repeat_rule: RepeatRuleEnum | None
    series_id: str | None
    workout_session_id: int | None
    notes: str | None


class CancelScope(BaseModel):
    scope: Literal["one", "future"] = "one"
