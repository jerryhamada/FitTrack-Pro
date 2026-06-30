from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import PrTypeEnum, UnitEnum


class PROut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    exercise_name: str = ""
    pr_type: PrTypeEnum
    reps: int | None
    value: float
    unit: UnitEnum
    achieved_at: datetime


class BadgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str


class ClientBadgeOut(BaseModel):
    badge: BadgeOut
    earned_at: datetime
