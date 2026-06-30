from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from ..models.enums import ClientStatusEnum, InviteStatusEnum, UnitEnum


class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    goals: str | None = None
    starting_bodyweight: float | None = None
    starting_body_fat_pct: float | None = None
    preferred_unit: UnitEnum = UnitEnum.lbs


class ClientUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    goals: str | None = None
    starting_bodyweight: float | None = None
    starting_body_fat_pct: float | None = None
    preferred_unit: UnitEnum | None = None


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    goals: str | None
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


class ClientNoteCreate(BaseModel):
    body: str
    is_trainer_only: bool = True


class ClientNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
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
