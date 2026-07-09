from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from ..models.enums import UnitEnum


class InviteRedeemRequest(BaseModel):
    token: str


class InviteRedeemResponse(BaseModel):
    client_id: int
    client_name: str
    trainer_name: str | None


class InvitePreviewOut(BaseModel):
    """Pre-signup peek at a valid invite so the app can show who it's for and
    prefill the signup email. client_email may be None for clients created
    before email was required."""

    client_name: str
    client_email: str | None
    trainer_name: str | None


class TrainerSearchResult(BaseModel):
    """One row of the client-facing 'Find your trainer' search."""

    trainer_id: int
    name: str
    business_name: str | None
    logo_url: str | None


class LinkRequestCreate(BaseModel):
    trainer_id: int


class LinkRequestOut(BaseModel):
    id: int
    trainer_id: int
    trainer_name: str | None
    status: str
    created_at: datetime


class JoinByCodeRequest(BaseModel):
    code: str


class JoinByCodeResponse(BaseModel):
    trainer_id: int
    trainer_name: str | None
    trainer_business: str | None


class PortalNextSession(BaseModel):
    scheduled_at: datetime
    trainer_name: str | None
    notes: str | None


class PortalPR(BaseModel):
    exercise_name: str
    pr_type: str
    value: float
    unit: str
    reps: int | None
    achieved_at: datetime


class PortalWeek(BaseModel):
    week_start: date
    workouts: int


class PortalLiftPoint(BaseModel):
    date: date
    value: float


class PortalKeyLift(BaseModel):
    exercise_name: str
    unit: UnitEnum
    points: list[PortalLiftPoint]  # estimated-1RM PRs over time


class PortalWorkout(BaseModel):
    id: int
    started_at: datetime
    duration_seconds: int | None
    exercise_count: int
    pr_count: int


class PortalPlannedExercise(BaseModel):
    exercise_name: str
    target_sets: int | None
    target_reps: str | None
    target_weight: float | None
    target_weight_unit: str | None
    notes: str | None


class PortalUpcomingSession(BaseModel):
    id: int
    scheduled_at: datetime
    status: str
    trainer_name: str | None
    notes: str | None
    plan_label: str | None  # e.g. "Lower Body Day" when a plan is attached
    planned_exercises: list[PortalPlannedExercise]


class PortalCurrentProgram(BaseModel):
    name: str
    current_week: int | None
    days_per_week: int
    goal: str | None


class ClientMyWorkouts(BaseModel):
    trainer_name: str | None
    next_session: PortalUpcomingSession | None
    upcoming_sessions: list[PortalUpcomingSession]
    current_program: PortalCurrentProgram | None


class PortalExerciseRef(BaseModel):
    id: int
    name: str


class PortalHistoryItem(BaseModel):
    id: int
    title: str  # derived from the workout's muscle groups (e.g. "Push Day", "Glutes Day")
    started_at: datetime
    duration_seconds: int | None
    exercises: list[PortalExerciseRef]
    pr_count: int
    total_volume: float
    total_volume_unit: str


class PortalHistorySummary(BaseModel):
    total_workouts: int
    streak_weeks: int
    workouts_this_month: int


class ClientHistory(BaseModel):
    summary: PortalHistorySummary
    workouts: list[PortalHistoryItem]  # reverse chronological


class PortalHistorySet(BaseModel):
    set_number: int
    weight: float | None
    weight_unit: str | None
    height: float | None = None  # for height-tracked exercises (box jumps, box push-ups)
    height_unit: str | None = None
    reps: int | None
    effort_value: float | None
    effort_type: str | None
    status: str
    is_pr: bool
    pr_type: str | None
    # NOTE: set-level notes are intentionally omitted — they can carry trainer cues.


class PortalWorkoutExercise(BaseModel):
    exercise_id: int
    exercise_name: str
    superset_group_id: str | None = None  # shared letter groups exercises into a superset
    superset_order: int | None = None
    sets: list[PortalHistorySet]


class ClientWorkoutDetail(BaseModel):
    id: int
    title: str  # derived from the workout's muscle groups (e.g. "Push Day", "Glutes Day")
    started_at: datetime
    duration_seconds: int | None
    total_volume: float
    total_volume_unit: str
    pr_count: int
    notes: str | None  # workout-level notes only (already client-visible); never trainer Notes-tab
    exercises: list[PortalWorkoutExercise]


class BodyweightLogOut(BaseModel):
    id: int
    logged_at: datetime
    weight: float
    unit: str


class BodyweightLogCreate(BaseModel):
    weight: float


class ProgressExerciseOption(BaseModel):
    exercise_id: int
    exercise_name: str
    pr_count: int


class StrengthPoint(BaseModel):
    date: date
    value: float  # best estimated 1RM that session, client's preferred unit
    is_pr: bool  # a PR was hit on this exercise that session


class StrengthSeries(BaseModel):
    exercise_id: int
    exercise_name: str
    unit: UnitEnum
    points: list[StrengthPoint]


class StrengthWidgetOption(BaseModel):
    exercise_id: int
    exercise_name: str


class StrengthWidget(BaseModel):
    """Dashboard 'Your Strength Progress' card: compact e1RM trend for one
    exercise + a plain-language delta. Options are ordered by recency (most
    recently logged first) — that's also the default selection."""

    unit: UnitEnum
    exercise_options: list[StrengthWidgetOption]
    exercise_id: int | None
    exercise_name: str | None
    points: list[StrengthPoint]
    # Peak e1RM vs the value nearest the start of the lookback window, in the
    # client's preferred unit. Null when there isn't enough history to make a
    # non-misleading claim (<2 points, or history younger than the window).
    delta_value: float | None
    delta_pct: float | None
    window_days: int = 30


class ClientProgressStats(BaseModel):
    streak_weeks: int
    total_workouts: int
    workouts_this_month: int
    total_prs: int
    avg_workouts_per_week: float | None
    most_improved_lift: str | None
    most_improved_exercise_id: int | None


class ClientProgress(BaseModel):
    unit: UnitEnum
    stats: ClientProgressStats
    consistency: list[PortalWeek]  # workouts per week across the selected range
    pr_timeline: list[PortalPR]  # most recent first, range-filtered
    bodyweight: list[BodyweightLogOut]  # range-filtered, oldest first
    exercise_options: list[ProgressExerciseOption]
    default_exercise_id: int | None


class ClientPortalDashboard(BaseModel):
    client_name: str
    client_photo_url: str | None
    trainer_name: str | None
    trainer_business: str | None
    unit: UnitEnum
    next_session: PortalNextSession | None
    streak_weeks: int
    workouts_this_month: int
    lifetime_workouts: int
    recent_prs: list[PortalPR]
    weekly_workouts: list[PortalWeek]
    key_lifts: list[PortalKeyLift]
    recent_workouts: list[PortalWorkout]
