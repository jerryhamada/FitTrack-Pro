from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


MeasurementType = Literal["weight", "height", "band"]


class ExerciseCreate(BaseModel):
    name: str
    category: str
    subcategory: str | None = None
    muscle_group: str | None = None
    secondary_muscles: list[str] | None = None
    equipment: str | None = None
    exercise_type: Literal["compound", "isolation"] | None = None
    demo_media_url: str | None = None
    images: list[str] | None = None
    level: Literal["beginner", "intermediate", "expert"] | None = None
    instructions_steps: list[str] | None = None
    measurement_type: MeasurementType = "weight"
    tracks_height: bool = False
    invert_difficulty: bool = False
    notes: str | None = None


class MeasurementUpdate(BaseModel):
    measurement_type: MeasurementType


class ExerciseUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    subcategory: str | None = None
    muscle_group: str | None = None
    secondary_muscles: list[str] | None = None
    equipment: str | None = None
    exercise_type: Literal["compound", "isolation"] | None = None
    demo_media_url: str | None = None
    images: list[str] | None = None
    level: Literal["beginner", "intermediate", "expert"] | None = None
    instructions_steps: list[str] | None = None
    measurement_type: MeasurementType | None = None
    tracks_height: bool | None = None
    invert_difficulty: bool | None = None
    notes: str | None = None


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    subcategory: str | None
    muscle_group: str | None
    secondary_muscles: list[str] | None = None
    equipment: str | None = None
    exercise_type: str | None = None
    demo_media_url: str | None = None
    images: list[str] | None = None
    level: str | None = None
    instructions_steps: list[str] | None = None
    # Resolved per-trainer: the trainer's override for a built-in wins over the
    # exercise's own default. tracks_height mirrors it for older app builds.
    measurement_type: str = "weight"
    tracks_height: bool = False
    invert_difficulty: bool = False
    notes: str | None
    is_custom: bool = False
    is_favorite: bool = False
