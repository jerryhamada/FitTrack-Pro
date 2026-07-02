from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from ..models.enums import UnitEnum


class ClientOverviewStats(BaseModel):
    lifetime_workouts: int
    lifetime_prs: int
    hours_trained: float
    current_streak_weeks: int
    avg_workouts_per_week: float | None  # null until the first completed workout
    most_improved_lift: str | None  # e.g. "Bench press (barbell) +12.5%"


class WeeklyStat(BaseModel):
    week_start: date
    workouts: int
    volume: float


class ClientWeeklyStats(BaseModel):
    unit: UnitEnum
    weeks: list[WeeklyStat]


class ExercisePRSummary(BaseModel):
    exercise_id: int
    exercise_name: str
    best_weight: float | None  # in `unit`, heaviest single set
    best_weight_reps: int | None
    best_e1rm: float | None  # in `unit`
    best_set_volume: float | None  # weight x reps of the single biggest set, in `unit`
    pr_count: int
    last_pr_at: datetime | None


class ClientPRSummary(BaseModel):
    unit: UnitEnum
    lifetime_pr_count: int
    prs_this_month: int
    last_pr_at: datetime | None
    exercises: list[ExercisePRSummary]
