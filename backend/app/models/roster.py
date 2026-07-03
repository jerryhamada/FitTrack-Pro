from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import ClientStatusEnum, DeliveryMethodEnum, InviteStatusEnum, UnitEnum


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_type: Mapped[str | None] = mapped_column(String, nullable=True)
    training_frequency_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    injuries_limitations: Mapped[str | None] = mapped_column(Text, nullable=True)
    starting_bodyweight: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    starting_body_fat_pct: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    preferred_unit: Mapped[UnitEnum] = mapped_column(
        Enum(UnitEnum, name="unit_enum"), nullable=False, default=UnitEnum.lbs
    )
    status: Mapped[ClientStatusEnum] = mapped_column(
        Enum(ClientStatusEnum, name="client_status_enum"), nullable=False, default=ClientStatusEnum.active
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    notes: Mapped[list["ClientNote"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    invites: Mapped[list["Invite"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class ClientNote(Base):
    __tablename__ = "client_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    is_trainer_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    client: Mapped[Client] = relationship(back_populates="notes")


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    status: Mapped[InviteStatusEnum] = mapped_column(
        Enum(InviteStatusEnum, name="invite_status_enum"), nullable=False, default=InviteStatusEnum.pending
    )
    delivery_method: Mapped[DeliveryMethodEnum | None] = mapped_column(
        Enum(DeliveryMethodEnum, name="delivery_method_enum"), nullable=True
    )
    delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped[Client] = relationship(back_populates="invites")


class BodyweightLog(Base):
    """Client-owned self-logged bodyweight — the one client-writable table.
    Never written by trainer endpoints."""

    __tablename__ = "bodyweight_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    weight: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[UnitEnum] = mapped_column(Enum(UnitEnum, name="unit_enum"), nullable=False)
