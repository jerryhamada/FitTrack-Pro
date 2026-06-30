from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .enums import ActivityEventTypeEnum


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    event_type: Mapped[ActivityEventTypeEnum] = mapped_column(
        Enum(ActivityEventTypeEnum, name="activity_event_type_enum"), nullable=False
    )
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
