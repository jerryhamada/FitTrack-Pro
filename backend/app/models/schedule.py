from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import RepeatRuleEnum, ScheduledStatusEnum


class ScheduledSession(Base):
    """A planned training session. Recurring schedules generate one row per
    occurrence up front (rolling window), grouped by series_id so cancel/delete
    can target 'this one' or 'this and all future'."""

    __tablename__ = "scheduled_sessions"
    __table_args__ = (Index("ix_scheduled_sessions_trainer_time", "trainer_id", "scheduled_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ScheduledStatusEnum] = mapped_column(
        Enum(ScheduledStatusEnum, name="scheduled_status_enum"),
        nullable=False,
        default=ScheduledStatusEnum.upcoming,
    )
    repeat_rule: Mapped[RepeatRuleEnum | None] = mapped_column(
        Enum(RepeatRuleEnum, name="repeat_rule_enum"), nullable=True
    )
    series_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    workout_session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)
    # Optional plan attached ahead of the session (reuses the trainer-side planned
    # workout schema — no new table). When null, a preview is derived by matching
    # the client's active-program day for that weekday.
    client_program_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("client_program_days.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["Client"] = relationship()  # noqa: F821
