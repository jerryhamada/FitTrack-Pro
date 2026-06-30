from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    subcategory: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExerciseFavorite(Base):
    __tablename__ = "exercise_favorites"
    __table_args__ = (UniqueConstraint("trainer_id", "exercise_id", name="uq_trainer_exercise_favorite"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exercise: Mapped[Exercise] = relationship()
