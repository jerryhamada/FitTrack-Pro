from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import PrTypeEnum


class PROut(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str = ""
    pr_type: PrTypeEnum
    reps: int | None
    value: float
    unit: str
    achieved_at: datetime


class BadgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str


class ClientBadgeOut(BaseModel):
    badge: BadgeOut
    earned_at: datetime
