from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import NotificationTypeEnum


class Notification(Base):
    """A trainer-facing alert. `dedup_key` makes recurring checks (inactive/missed)
    fire once per condition instead of every run — see services/notifications.py."""

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("trainer_id", "dedup_key", name="uq_notification_trainer_dedup"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[NotificationTypeEnum] = mapped_column(
        Enum(NotificationTypeEnum, name="notification_type_enum"), nullable=False
    )
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=True)
    scheduled_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("scheduled_sessions.id", ondelete="CASCADE"), nullable=True
    )
    workout_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    dedup_key: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["Client | None"] = relationship()  # noqa: F821
