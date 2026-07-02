from __future__ import annotations

from pydantic import BaseModel


class CategoryCount(BaseModel):
    category: str
    count: int


class DashboardStats(BaseModel):
    active_clients: int
    workouts_today: int
    workouts_this_week: int
    workouts_all_time: int
    adherence_pct: float | None  # null when no client has scheduled program days
    prs_last_7_days: int
    inactive_clients: int
    lifetime_prs: int
    avg_sessions_per_client: float | None  # null when no active clients
    hours_coached_this_week: float
    top_categories: list[CategoryCount]


class RecentPROut(BaseModel):
    id: int
    client_id: int
    client_name: str
    exercise_name: str
    pr_type: str
    reps: int | None
    value: float
    unit: str
    achieved_at: str
