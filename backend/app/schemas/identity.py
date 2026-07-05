from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from ..models.enums import DistanceUnitEnum, UnitEnum


class TrainerProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    business_name: str | None
    logo_url: str | None
    default_unit: UnitEnum
    default_distance_unit: DistanceUnitEnum
    notification_prefs: dict | None
    subscription_status: str


class TrainerProfileUpdate(BaseModel):
    business_name: str | None = None
    logo_url: str | None = None
    default_unit: UnitEnum | None = None
    default_distance_unit: DistanceUnitEnum | None = None
    notification_prefs: dict | None = None


class TrainerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str | None
    name: str | None
    profile: TrainerProfileOut | None = None
