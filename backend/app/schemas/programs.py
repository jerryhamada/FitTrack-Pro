from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import UnitEnum


class ProgramExerciseIn(BaseModel):
    exercise_id: int
    order_index: int = 0
    target_sets: int | None = None
    target_reps: str | None = None
    target_weight: float | None = None
    target_weight_unit: UnitEnum | None = None
    target_rpe: float | None = None
    target_rest_seconds: int | None = None
    notes: str | None = None


class ProgramDayIn(BaseModel):
    label: str
    order_index: int = 0
    exercises: list[ProgramExerciseIn] = []


class ProgramCreate(BaseModel):
    name: str
    description: str | None = None
    days: list[ProgramDayIn] = []


class ProgramExerciseOut(ProgramExerciseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_name: str = ""


class ProgramDayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    order_index: int
    exercises: list[ProgramExerciseOut]


class ProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    days: list[ProgramDayOut]


class ProgramSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    day_count: int
    created_at: datetime


class ProgramAssignRequest(BaseModel):
    client_id: int
    start_date: date | None = None


class ClientProgramExerciseOut(ProgramExerciseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_name: str = ""


class ClientProgramDayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    order_index: int
    day_of_week: int | None
    exercises: list[ClientProgramExerciseOut]


class ClientProgramOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    source_program_id: int | None
    name: str
    assigned_at: datetime
    start_date: date | None
    active: bool
    days: list[ClientProgramDayOut]


class ClientProgramDayUpdate(BaseModel):
    label: str
    order_index: int = 0
    day_of_week: int | None = None
    exercises: list[ProgramExerciseIn] = []


class ClientProgramUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None
    days: list[ClientProgramDayUpdate] | None = None
