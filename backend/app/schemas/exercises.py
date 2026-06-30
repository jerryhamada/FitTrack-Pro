from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ExerciseCreate(BaseModel):
    name: str
    category: str
    subcategory: str | None = None
    notes: str | None = None


class ExerciseUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    subcategory: str | None = None
    notes: str | None = None


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    subcategory: str | None
    notes: str | None
    is_custom: bool = False
    is_favorite: bool = False
