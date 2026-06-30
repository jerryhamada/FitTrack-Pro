from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from ..models.enums import UnitEnum


class ProgressPoint(BaseModel):
    date: date
    value: float


class ProgressResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    metric: str
    unit: UnitEnum
    points: list[ProgressPoint]


class VolumeByCategoryPoint(BaseModel):
    period_start: date
    category: str
    total_volume: float


class VolumeByCategoryResponse(BaseModel):
    unit: UnitEnum
    points: list[VolumeByCategoryPoint]


class CalendarSessionOut(BaseModel):
    id: int
    label: str | None
    category: str | None
    started_at: str


class CalendarDayOut(BaseModel):
    date: date
    sessions: list[CalendarSessionOut]


class CalendarResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarDayOut]
