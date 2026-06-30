from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import UnitEnum


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    days: Mapped[list["ProgramDay"]] = relationship(
        back_populates="program", cascade="all, delete-orphan", order_by="ProgramDay.order_index"
    )


class ProgramDay(Base):
    __tablename__ = "program_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    program: Mapped[Program] = relationship(back_populates="days")
    exercises: Mapped[list["ProgramExercise"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="ProgramExercise.order_index"
    )


class ProgramExercise(Base):
    __tablename__ = "program_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_day_id: Mapped[int] = mapped_column(ForeignKey("program_days.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_reps: Mapped[str | None] = mapped_column(String, nullable=True)
    target_weight: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    target_weight_unit: Mapped[UnitEnum | None] = mapped_column(Enum(UnitEnum, name="unit_enum"), nullable=True)
    target_rpe: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    target_rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    day: Mapped[ProgramDay] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()  # noqa: F821


class ClientProgram(Base):
    __tablename__ = "client_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    source_program_id: Mapped[int | None] = mapped_column(ForeignKey("programs.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    days: Mapped[list["ClientProgramDay"]] = relationship(
        back_populates="client_program", cascade="all, delete-orphan", order_by="ClientProgramDay.order_index"
    )


class ClientProgramDay(Base):
    __tablename__ = "client_program_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_program_id: Mapped[int] = mapped_column(ForeignKey("client_programs.id"), nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)

    client_program: Mapped[ClientProgram] = relationship(back_populates="days")
    exercises: Mapped[list["ClientProgramExercise"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", order_by="ClientProgramExercise.order_index"
    )


class ClientProgramExercise(Base):
    __tablename__ = "client_program_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_program_day_id: Mapped[int] = mapped_column(ForeignKey("client_program_days.id"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_reps: Mapped[str | None] = mapped_column(String, nullable=True)
    target_weight: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    target_weight_unit: Mapped[UnitEnum | None] = mapped_column(Enum(UnitEnum, name="unit_enum"), nullable=True)
    target_rpe: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    target_rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    day: Mapped[ClientProgramDay] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()  # noqa: F821
