from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import PrTypeEnum, UnitEnum


class PR(Base):
    __tablename__ = "prs"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    set_id: Mapped[int] = mapped_column(ForeignKey("sets.id"), nullable=False)
    pr_type: Mapped[PrTypeEnum] = mapped_column(Enum(PrTypeEnum, name="pr_type_enum"), nullable=False)
    reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[UnitEnum] = mapped_column(Enum(UnitEnum, name="unit_enum"), nullable=False)
    achieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exercise: Mapped["Exercise"] = relationship()  # noqa: F821


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientBadge(Base):
    __tablename__ = "client_badges"
    __table_args__ = (UniqueConstraint("client_id", "badge_id", name="uq_client_badge"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    badge: Mapped[Badge] = relationship()
