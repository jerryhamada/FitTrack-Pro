from __future__ import annotations

from typing import Literal

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


class WhoAmIOut(BaseModel):
    """Role resolution for a verified login, used by the apps to route after
    sign-in/sign-up. role is None for a brand-new login that isn't provisioned
    as a trainer or linked to a client yet."""

    role: Literal["trainer", "client"] | None
    client_id: int | None = None
    client_name: str | None = None
    # Client accounts only: whether they're connected to a trainer yet.
    # "linked" = has a trainer; "pending" = sent a connect request awaiting the
    # trainer's response; "none" = training solo (can link later in Settings).
    trainer_link_status: Literal["none", "pending", "linked"] | None = None


class RegisterClientOut(BaseModel):
    client_id: int
    client_name: str
