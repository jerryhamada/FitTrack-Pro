from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ..models.enums import DistanceUnitEnum, EffortTypeEnum, PrTypeEnum, SetStatusEnum, UnitEnum


class SessionStart(BaseModel):
    client_id: int
    client_program_day_id: int | None = None
    label: str | None = None


class ActiveSessionOut(BaseModel):
    id: int
    client_id: int
    client_name: str
    label: str | None
    started_at: datetime


class SessionUpdate(BaseModel):
    label: str | None = None
    notes: str | None = None
    ended_at: datetime | None = None


class SetCreate(BaseModel):
    exercise_id: int
    order_index: int = 0
    weight: float | None = None
    weight_unit: UnitEnum | None = None
    height: float | None = None
    height_unit: DistanceUnitEnum | None = None
    band_color: str | None = None
    is_per_side: bool = False
    reps: int | None = None
    effort_value: float | None = None
    effort_type: EffortTypeEnum | None = None
    set_modifier: str | None = None
    status: SetStatusEnum = SetStatusEnum.completed
    superset_group: str | None = None
    notes: str | None = None


class SetUpdate(BaseModel):
    weight: float | None = None
    weight_unit: UnitEnum | None = None
    height: float | None = None
    height_unit: DistanceUnitEnum | None = None
    band_color: str | None = None
    is_per_side: bool | None = None
    reps: int | None = None
    effort_value: float | None = None
    effort_type: EffortTypeEnum | None = None
    set_modifier: str | None = None
    status: SetStatusEnum | None = None
    notes: str | None = None
    superset_group: str | None = None


class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    exercise_id: int
    exercise_name: str = ""
    order_index: int
    set_number: int
    weight: float | None
    weight_unit: UnitEnum | None
    height: float | None = None
    height_unit: DistanceUnitEnum | None = None
    band_color: str | None = None
    is_per_side: bool
    reps: int | None
    # Stored Epley estimate in this set's weight_unit (per-hand for per-side sets).
    est_1rm: float | None = None
    effort_value: float | None
    effort_type: EffortTypeEnum | None
    set_modifier: str | None
    status: SetStatusEnum
    superset_group: str | None
    notes: str | None = None
    is_pr: bool
    pr_type: PrTypeEnum | None
    created_at: datetime


class PlannedExerciseOut(BaseModel):
    exercise_id: int
    exercise_name: str
    target_sets: int | None
    target_reps: str | None
    target_weight: float | None
    target_weight_unit: UnitEnum | None
    target_rpe: float | None
    target_rest_seconds: int | None
    notes: str | None


class SessionExerciseOut(BaseModel):
    exercise_id: int
    exercise_name: str
    order_index: int
    superset_group_id: str | None
    superset_order: int | None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_program_day_id: int | None
    label: str | None
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int | None
    notes: str | None
    sets: list[SetOut]
    session_exercises: list[SessionExerciseOut] = []
    planned_exercises: list[PlannedExerciseOut] = []


class AddSessionExerciseIn(BaseModel):
    exercise_id: int


class SupersetCreateIn(BaseModel):
    exercise_ids: list[int]  # 2+ members, in the desired A/B/C order


class MoveExerciseIn(BaseModel):
    # Move an exercise into a group (superset_group_id set) or out (null).
    superset_group_id: str | None = None
    superset_order: int | None = None


class SessionListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str | None
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int | None
    set_count: int = 0
    pr_count: int = 0
    exercise_count: int = 0
    total_volume: float = 0
    total_volume_unit: UnitEnum = UnitEnum.lbs
    notes_preview: str | None = None


class SessionSummaryOut(BaseModel):
    session_id: int
    total_volume: float
    total_volume_unit: UnitEnum
    total_sets: int
    duration_seconds: int | None
    prs_hit: list[SetOut]
