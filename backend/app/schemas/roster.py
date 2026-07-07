from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from ..models.enums import ClientStatusEnum, InviteStatusEnum, UnitEnum

GoalType = Literal["strength", "hypertrophy", "fat_loss", "endurance", "general_fitness"]
NoteCategory = Literal["technique", "injury", "mobility", "nutrition", "homework", "preferences"]


class ClientCreate(BaseModel):
    name: str
    # Required: the client is invited by email, and it's stored on their account
    # so the invite is tied to a real address (the invite token still authorizes
    # signup regardless of which email they ultimately register with Clerk).
    email: EmailStr
    goals: str | None = None
    goal_type: GoalType | None = None
    training_frequency_target: int | None = Field(default=None, ge=1, le=7)
    photo_url: str | None = None
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    injuries_limitations: str | None = None
    starting_bodyweight: float | None = None
    starting_body_fat_pct: float | None = None
    preferred_unit: UnitEnum = UnitEnum.lbs


class ClientUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    goals: str | None = None
    goal_type: GoalType | None = None
    training_frequency_target: int | None = Field(default=None, ge=1, le=7)
    photo_url: str | None = None
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    injuries_limitations: str | None = None
    starting_bodyweight: float | None = None
    starting_body_fat_pct: float | None = None
    preferred_unit: UnitEnum | None = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    phone: str | None
    goals: str | None
    goal_type: str | None
    training_frequency_target: int | None
    photo_url: str | None
    age: int | None
    gender: str | None
    injuries_limitations: str | None
    starting_bodyweight: float | None
    starting_body_fat_pct: float | None
    preferred_unit: UnitEnum
    status: ClientStatusEnum
    created_at: datetime


class ClientPulseOut(ClientOut):
    last_session_at: datetime | None = None
    sessions_this_week: int = 0
    recent_pr_label: str | None = None
    is_stale: bool = False
    training_phase: str | None = None
    streak_weeks: int = 0


class ClientNoteCreate(BaseModel):
    body: str
    category: NoteCategory | None = None
    is_trainer_only: bool = True


class ClientNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
    category: str | None
    is_trainer_only: bool
    created_at: datetime
    updated_at: datetime


class InviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token: str
    status: InviteStatusEnum
    expires_at: datetime
    invite_link: str

    @staticmethod
    def from_invite(invite) -> "InviteOut":
        return InviteOut(
            id=invite.id,
            token=invite.token,
            status=invite.status,
            expires_at=invite.expires_at,
            invite_link=f"https://app.fittrackpro.com/invite/{invite.token}",
        )


class ClientCreateResponse(BaseModel):
    client: ClientOut
    invite: InviteOut
