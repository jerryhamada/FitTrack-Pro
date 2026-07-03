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


class BestSet(BaseModel):
    weight: float | None  # in the client's preferred unit
    reps: int | None
    session_date: date


class ExerciseInsight(BaseModel):
    exercise_id: int
    sessions_used: int
    last_used_at: datetime
    last3_best: list[BestSet]  # best set from each of the last 3 sessions with this exercise


class ClientExerciseInsights(BaseModel):
    unit: UnitEnum
    exercises: list[ExerciseInsight]
