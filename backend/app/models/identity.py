from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import DistanceUnitEnum, RoleEnum, UnitEnum


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    clerk_user_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum, name="role_enum"), nullable=False)
    trainer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    trainer_profile: Mapped["TrainerProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class TrainerProfile(Base):
    __tablename__ = "trainer_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    business_name: Mapped[str | None] = mapped_column(String, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    default_unit: Mapped[UnitEnum] = mapped_column(
        Enum(UnitEnum, name="unit_enum"), nullable=False, default=UnitEnum.lbs
    )
    default_distance_unit: Mapped[DistanceUnitEnum] = mapped_column(
        Enum(DistanceUnitEnum, name="distance_unit_enum", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=DistanceUnitEnum.inches,
    )
    notification_prefs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Shareable code clients can enter to join this trainer directly (no search,
    # no approval step). NULL until the trainer generates one.
    join_code: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    subscription_status: Mapped[str] = mapped_column(String, nullable=False, default="trial")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="trainer_profile")
