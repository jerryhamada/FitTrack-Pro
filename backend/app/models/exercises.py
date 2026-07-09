from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    subcategory: Mapped[str | None] = mapped_column(String, nullable=True)
    muscle_group: Mapped[str | None] = mapped_column(String, nullable=True)
    secondary_muscles: Mapped[list | None] = mapped_column(JSON, nullable=True)
    equipment: Mapped[str | None] = mapped_column(String, nullable=True)
    exercise_type: Mapped[str | None] = mapped_column(String, nullable=True)  # compound | isolation
    demo_media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    images: Mapped[list | None] = mapped_column(JSON, nullable=True)  # demo photo URLs (start/end position)
    level: Mapped[str | None] = mapped_column(String, nullable=True)  # beginner | intermediate | expert
    instructions_steps: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ordered "how to perform" steps
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tracks_height: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Only meaningful when tracks_height is set: a lower height is the harder/better
    # direction (e.g. box-assisted push-ups — less assistance is more impressive),
    # vs. the default where a higher number is always better (box jumps, weight, etc).
    invert_difficulty: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
