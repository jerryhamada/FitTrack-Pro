from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import EffortTypeEnum, PrTypeEnum, SetStatusEnum, UnitEnum


class WorkoutSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    logged_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    client_program_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("client_program_days.id"), nullable=True
    )
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sets: Mapped[list["SetEntry"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SetEntry.order_index"
    )


class SetEntry(Base):
    __tablename__ = "sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    weight: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    weight_unit: Mapped[UnitEnum | None] = mapped_column(Enum(UnitEnum, name="unit_enum"), nullable=True)
    is_per_side: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    effort_value: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    effort_type: Mapped[EffortTypeEnum | None] = mapped_column(
        Enum(EffortTypeEnum, name="effort_type_enum"), nullable=True
    )
    set_modifier: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[SetStatusEnum] = mapped_column(
        Enum(SetStatusEnum, name="set_status_enum"), nullable=False, default=SetStatusEnum.completed
    )
    superset_group: Mapped[str | None] = mapped_column(String, nullable=True)
    is_pr: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pr_type: Mapped[PrTypeEnum | None] = mapped_column(Enum(PrTypeEnum, name="pr_type_enum"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[WorkoutSession] = relationship(back_populates="sets")
    exercise: Mapped["Exercise"] = relationship()  # noqa: F821
