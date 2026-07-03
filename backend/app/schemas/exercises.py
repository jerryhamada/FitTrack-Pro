from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class ExerciseCreate(BaseModel):
    name: str
    category: str
    subcategory: str | None = None
    muscle_group: str | None = None
    secondary_muscles: list[str] | None = None
    equipment: str | None = None
    exercise_type: Literal["compound", "isolation"] | None = None
    demo_media_url: str | None = None
    instructions_steps: list[str] | None = None
    notes: str | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    subcategory: str | None = None
    muscle_group: str | None = None
    secondary_muscles: list[str] | None = None
    equipment: str | None = None
    exercise_type: Literal["compound", "isolation"] | None = None
    demo_media_url: str | None = None
    instructions_steps: list[str] | None = None
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
    instructions_steps: list[str] | None = None
    notes: str | None
    is_custom: bool = False
    is_favorite: bool = False
