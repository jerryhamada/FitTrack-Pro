from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import _verify_token
from ..config import get_settings
from ..database import get_db
from ..models.enums import ClientStatusEnum, PrTypeEnum, RoleEnum, ScheduledStatusEnum
from ..models.exercises import Exercise
from ..models.identity import TrainerProfile, User
from ..models.programs import ClientProgram, ClientProgramDay, ClientProgramExercise, Program
from ..models.prs import PR
from ..models.roster import BodyweightLog, Client
from ..models.schedule import ScheduledSession
from ..models.sessions import SetEntry, WorkoutSession
from ..schemas.client_portal import (
    BodyweightLogCreate,
    BodyweightLogOut,
    ClientHistory,
    ClientMyWorkouts,
    ClientPortalDashboard,
    ClientProgress,
    ClientProgressStats,
    ClientWorkoutDetail,
    PortalCurrentProgram,
    PortalExerciseRef,
    PortalHistoryItem,
    PortalHistorySet,
    PortalHistorySummary,
    PortalKeyLift,
    PortalLiftPoint,
    PortalNextSession,
    PortalPlannedExercise,
    PortalPR,
    PortalUpcomingSession,
    PortalWeek,
    PortalWorkout,
    PortalWorkoutExercise,
    ProgressExerciseOption,
    StrengthPoint,
    StrengthSeries,
)
from ..services.one_rm import estimated_1rm
from ..services.units import from_lbs, to_lbs, total_load
from ..services.volume import session_total_volume
from .clients import _streak_weeks

router = APIRouter(prefix="/client-portal", tags=["client-portal"])

_bearer = HTTPBearer(auto_error=False)


def get_current_client(
    client_id: int | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Client:
    """Resolve the logged-in client. All portal reads are scoped to this row —
    a client can only ever see their own data.

    DEV ONLY: with DEV_AUTH_BYPASS the ?client_id param (or the first active client)
    is used so the trainer-side role-preview toggle has something to render."""
    if get_settings().dev_auth_bypass:
        query = db.query(Client).filter(Client.status == ClientStatusEnum.active)
        client = (
            query.filter(Client.id == client_id).first() if client_id is not None else query.order_by(Client.id).first()
        )
        if client is None:
            raise HTTPException(status_code=404, detail="No active client to preview")
        return client

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = _verify_token(credentials)
    user = (
        db.query(User)
        .filter(User.clerk_user_id == payload["sub"], User.role == RoleEnum.client)
        .first()
    )
    client = (
        db.query(Client).filter(Client.user_id == user.id).first() if user is not None else None
    )
    if client is None:
        raise HTTPException(status_code=403, detail="No client account linked to this login")
    return client


@router.get("/dashboard", response_model=ClientPortalDashboard)
def portal_dashboard(client: Client = Depends(get_current_client), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today = now.date()

    trainer = db.query(User).filter(User.id == client.trainer_id).first()
    profile = (
        db.query(TrainerProfile).filter(TrainerProfile.user_id == client.trainer_id).first()
        if trainer
        else None
    )

    # Next upcoming session
    next_slot = (
        db.query(ScheduledSession)
        .filter(
            ScheduledSession.client_id == client.id,
            ScheduledSession.status == ScheduledStatusEnum.upcoming,
            ScheduledSession.scheduled_at >= now - timedelta(hours=1),
        )
        .order_by(ScheduledSession.scheduled_at)
        .first()
    )

    # Completed workouts (drives streak, counts, weekly bars, recent list)
    completed = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets))
        .filter(WorkoutSession.client_id == client.id, WorkoutSession.ended_at.isnot(None))
        .order_by(WorkoutSession.started_at.desc())
        .all()
    )
    # Empty sessions (ended with no sets) aren't real workouts — exclude them so the
    # counts here match the History screen.
    completed = [s for s in completed if s.sets]
    completed_weeks = set()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    workouts_this_month = 0
    for s in completed:
        d = s.started_at.astimezone(timezone.utc).date()
        iso = d.isocalendar()
        completed_weeks.add((iso[0], iso[1]))
        if s.started_at >= month_start:
            workouts_this_month += 1

    # Trailing 12 ISO weeks of workout counts
    current_monday = today - timedelta(days=today.weekday())
    window_start = current_monday - timedelta(weeks=11)
    per_week: dict = defaultdict(int)
    for s in completed:
        d = s.started_at.astimezone(timezone.utc).date()
        monday = d - timedelta(days=d.weekday())
        if monday >= window_start:
            per_week[monday] += 1
    weekly = [
        PortalWeek(week_start=window_start + timedelta(weeks=i), workouts=per_week.get(window_start + timedelta(weeks=i), 0))
        for i in range(12)
    ]

    # PRs: recent celebration list + key-lift progressions (top 2 by e1RM PR count)
    prs = (
        db.query(PR, Exercise.name)
        .join(Exercise, Exercise.id == PR.exercise_id)
        .filter(PR.client_id == client.id)
        .order_by(PR.achieved_at)
        .all()
    )
    recent_prs = [
        PortalPR(
            exercise_name=name,
            pr_type=pr.pr_type.value,
            value=round(float(pr.value), 1),
            unit=pr.unit.value if pr.unit else pr.distance_unit.value,
            reps=pr.reps,
            achieved_at=pr.achieved_at,
        )
        for pr, name in sorted(prs, key=lambda r: r[0].achieved_at, reverse=True)[:5]
    ]
    e1rm_by_exercise: dict[int, list] = defaultdict(list)
    names: dict[int, str] = {}
    for pr, name in prs:
        if pr.pr_type == PrTypeEnum.estimated_1rm:
            e1rm_by_exercise[pr.exercise_id].append(pr)
            names[pr.exercise_id] = name
    top_lifts = sorted(e1rm_by_exercise.items(), key=lambda kv: len(kv[1]), reverse=True)[:2]
    key_lifts = [
        PortalKeyLift(
            exercise_name=names[ex_id],
            unit=client.preferred_unit,
            points=[
                PortalLiftPoint(date=pr.achieved_at.astimezone(timezone.utc).date(), value=round(float(pr.value), 1))
                for pr in lift_prs[-10:]
            ],
        )
        for ex_id, lift_prs in top_lifts
    ]

    return ClientPortalDashboard(
        client_name=client.name,
        client_photo_url=client.photo_url,
        trainer_name=trainer.name if trainer else None,
        trainer_business=profile.business_name if profile else None,
        unit=client.preferred_unit,
        next_session=PortalNextSession(
            scheduled_at=next_slot.scheduled_at,
            trainer_name=(trainer.name if trainer else None),
            notes=next_slot.notes,
        )
        if next_slot
        else None,
        streak_weeks=_streak_weeks(completed_weeks, today),
        workouts_this_month=workouts_this_month,
        lifetime_workouts=len(completed),
        recent_prs=recent_prs,
        weekly_workouts=weekly,
        key_lifts=key_lifts,
        recent_workouts=[
            PortalWorkout(
                id=s.id,
                started_at=s.started_at,
                duration_seconds=s.duration_seconds,
                exercise_count=len({st.exercise_id for st in s.sets}),
                pr_count=sum(1 for st in s.sets if st.is_pr),
            )
            for s in completed[:3]
        ],
    )


def _planned_from_day(day: ClientProgramDay, db: Session) -> list[PortalPlannedExercise]:
    rows = (
        db.query(ClientProgramExercise, Exercise.name)
        .join(Exercise, Exercise.id == ClientProgramExercise.exercise_id)
        .filter(ClientProgramExercise.client_program_day_id == day.id)
        .order_by(ClientProgramExercise.order_index)
        .all()
    )
    return [
        PortalPlannedExercise(
            exercise_name=name,
            target_sets=pe.target_sets,
            target_reps=pe.target_reps,
            target_weight=float(pe.target_weight) if pe.target_weight is not None else None,
            target_weight_unit=pe.target_weight_unit.value if pe.target_weight_unit else None,
            notes=pe.notes,
        )
        for pe, name in rows
    ]


@router.get("/my-workouts", response_model=ClientMyWorkouts)
def my_workouts(client: Client = Depends(get_current_client), db: Session = Depends(get_db)):
    """Read-only view of the client's scheduled sessions and current program.
    Planned exercises come from an explicitly attached program day, else are
    derived by matching the active program's day for that weekday."""
    now = datetime.now(timezone.utc)
    trainer = db.query(User).filter(User.id == client.trainer_id).first()

    # Active program (drives the current-program section + weekday-match fallback)
    active_program = (
        db.query(ClientProgram)
        .filter(ClientProgram.client_id == client.id, ClientProgram.active.is_(True))
        .order_by(ClientProgram.assigned_at.desc())
        .first()
    )
    program_days = (
        db.query(ClientProgramDay)
        .filter(ClientProgramDay.client_program_id == active_program.id)
        .all()
        if active_program
        else []
    )
    day_by_weekday = {d.day_of_week: d for d in program_days if d.day_of_week is not None}
    day_by_id = {d.id: d for d in program_days}

    upcoming_rows = (
        db.query(ScheduledSession)
        .filter(
            ScheduledSession.client_id == client.id,
            ScheduledSession.status == ScheduledStatusEnum.upcoming,
            ScheduledSession.scheduled_at >= now - timedelta(hours=1),
        )
        .order_by(ScheduledSession.scheduled_at)
        .all()
    )

    def to_out(s: ScheduledSession) -> PortalUpcomingSession:
        # Explicit link first, else weekday-match the active program.
        day = None
        if s.client_program_day_id is not None:
            day = day_by_id.get(s.client_program_day_id) or (
                db.query(ClientProgramDay).filter(ClientProgramDay.id == s.client_program_day_id).first()
            )
        if day is None:
            day = day_by_weekday.get(s.scheduled_at.astimezone(timezone.utc).weekday())
        planned = _planned_from_day(day, db) if day is not None else []
        return PortalUpcomingSession(
            id=s.id,
            scheduled_at=s.scheduled_at,
            status=s.status.value,
            trainer_name=trainer.name if trainer else None,
            notes=s.notes,
            plan_label=day.label if day is not None else None,
            planned_exercises=planned,
        )

    upcoming = [to_out(s) for s in upcoming_rows]

    current_program = None
    if active_program:
        current_week = None
        if active_program.start_date is not None:
            days_elapsed = (now.date() - active_program.start_date).days
            if days_elapsed >= 0:
                current_week = days_elapsed // 7 + 1
        goal = None
        if active_program.source_program_id is not None:
            src = db.query(Program).filter(Program.id == active_program.source_program_id).first()
            goal = src.description if src else None
        goal = goal or client.goals
        current_program = PortalCurrentProgram(
            name=active_program.name,
            current_week=current_week,
            days_per_week=len(program_days),
            goal=goal,
        )

    return ClientMyWorkouts(
        trainer_name=trainer.name if trainer else None,
        next_session=upcoming[0] if upcoming else None,
        upcoming_sessions=upcoming,
        current_program=current_program,
    )


_PUSH = {"chest", "shoulders", "triceps"}
_PULL = {"back", "biceps", "forearms"}
_LEGS = {"quads", "hamstrings", "glutes", "calves"}


def _workout_title(muscle_groups: list[str]) -> str:
    """Give a completed workout a human headline derived from the muscle groups it
    trained. A single dominant muscle reads as "Glutes Day"; a coherent split reads
    as "Push Day" / "Pull Day" / "Leg Day"; broader mixes collapse to Upper/Lower/
    Full Body. Falls back to "Workout" when nothing is tagged."""
    distinct = list(dict.fromkeys(m for m in muscle_groups if m))
    if not distinct:
        return "Workout"
    if len(distinct) == 1:
        return f"{distinct[0].capitalize()} Day"
    s = set(distinct)
    if s <= _PUSH:
        return "Push Day"
    if s <= _PULL:
        return "Pull Day"
    if s <= _LEGS:
        return "Leg Day"
    if s <= {"core"}:
        return "Core Day"
    if s <= (_PUSH | _PULL):
        return "Upper Body"
    if s <= (_LEGS | {"core"}):
        return "Lower Body"
    return "Full Body"


@router.get("/history", response_model=ClientHistory)
def history(client: Client = Depends(get_current_client), db: Session = Depends(get_db)):
    """Read-only workout history for the client. Reads only workout/set data —
    never the trainer-only client_notes table."""
    now = datetime.now(timezone.utc)
    today = now.date()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    completed = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets))
        .filter(WorkoutSession.client_id == client.id, WorkoutSession.ended_at.isnot(None))
        .order_by(WorkoutSession.started_at.desc())
        .all()
    )
    # Drop empty sessions (ended with no sets logged) — they aren't real workouts,
    # so they shouldn't appear in the list or count toward totals/streak.
    completed = [s for s in completed if s.sets]

    # Exercise name + muscle group (for the condensed list and the derived title)
    ex_ids = {st.exercise_id for s in completed for st in s.sets}
    ex_by_id = {
        e.id: e for e in db.query(Exercise).filter(Exercise.id.in_(ex_ids)).all()
    } if ex_ids else {}

    completed_weeks = set()
    for s in completed:
        iso = s.started_at.astimezone(timezone.utc).date().isocalendar()
        completed_weeks.add((iso[0], iso[1]))

    items = []
    for s in completed:
        seen: list[int] = []
        for st in s.sets:
            if st.exercise_id not in seen:
                seen.append(st.exercise_id)
        muscles = [ex_by_id[eid].muscle_group for eid in seen if eid in ex_by_id]
        items.append(
            PortalHistoryItem(
                id=s.id,
                title=_workout_title(muscles),
                started_at=s.started_at,
                duration_seconds=s.duration_seconds,
                exercises=[
                    PortalExerciseRef(id=eid, name=ex_by_id[eid].name if eid in ex_by_id else "Exercise")
                    for eid in seen
                ],
                pr_count=sum(1 for st in s.sets if st.is_pr),
                total_volume=round(session_total_volume(s.sets, client.preferred_unit), 1),
                total_volume_unit=client.preferred_unit.value,
            )
        )

    return ClientHistory(
        summary=PortalHistorySummary(
            total_workouts=len(completed),
            streak_weeks=_streak_weeks(completed_weeks, today),
            workouts_this_month=sum(1 for s in completed if s.started_at >= month_start),
        ),
        workouts=items,
    )


@router.get("/workouts/{workout_id}", response_model=ClientWorkoutDetail)
def workout_detail(
    workout_id: int, client: Client = Depends(get_current_client), db: Session = Depends(get_db)
):
    """Full read-only breakdown of one of the client's own completed workouts.
    Excludes set-level notes and never touches the trainer-only notes table."""
    workout = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets), joinedload(WorkoutSession.exercises))
        .filter(
            WorkoutSession.id == workout_id,
            WorkoutSession.client_id == client.id,  # scope: own workouts only
            WorkoutSession.ended_at.isnot(None),
        )
        .first()
    )
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")

    ex_ids = {st.exercise_id for st in workout.sets}
    ex_by_id = {
        e.id: e for e in db.query(Exercise).filter(Exercise.id.in_(ex_ids)).all()
    } if ex_ids else {}
    names = {eid: e.name for eid, e in ex_by_id.items()}
    membership = {se.exercise_id: se for se in workout.exercises}

    grouped: dict[int, list] = defaultdict(list)
    order: list[int] = []
    for st in sorted(workout.sets, key=lambda s: (s.order_index, s.set_number)):
        if st.exercise_id not in grouped:
            order.append(st.exercise_id)
        grouped[st.exercise_id].append(st)

    # Order by the session's exercise order (keeps superset members adjacent),
    # falling back to set-appearance order for anything without a membership row.
    order.sort(key=lambda eid: (membership[eid].order_index if eid in membership else 1_000 + order.index(eid)))

    exercises = [
        PortalWorkoutExercise(
            exercise_id=eid,
            exercise_name=names.get(eid, "Exercise"),
            superset_group_id=membership[eid].superset_group_id if eid in membership else None,
            superset_order=membership[eid].superset_order if eid in membership else None,
            sets=[
                PortalHistorySet(
                    set_number=st.set_number,
                    weight=float(st.weight) if st.weight is not None else None,
                    weight_unit=st.weight_unit.value if st.weight_unit else None,
                    height=float(st.height) if st.height is not None else None,
                    height_unit=st.height_unit.value if st.height_unit else None,
                    reps=st.reps,
                    effort_value=float(st.effort_value) if st.effort_value is not None else None,
                    effort_type=st.effort_type.value if st.effort_type else None,
                    status=st.status.value,
                    is_pr=st.is_pr,
                    pr_type=st.pr_type.value if st.pr_type else None,
                )
                for st in grouped[eid]
            ],
        )
        for eid in order
    ]

    return ClientWorkoutDetail(
        id=workout.id,
        title=_workout_title([ex_by_id[eid].muscle_group for eid in order if eid in ex_by_id]),
        started_at=workout.started_at,
        duration_seconds=workout.duration_seconds,
        total_volume=round(session_total_volume(workout.sets, client.preferred_unit), 1),
        total_volume_unit=client.preferred_unit.value,
        pr_count=sum(1 for st in workout.sets if st.is_pr),
        notes=workout.notes,
        exercises=exercises,
    )


def _range_start(range_key: str, now: datetime) -> datetime | None:
    days = {"4w": 28, "3m": 91, "6m": 182}.get(range_key)
    return now - timedelta(days=days) if days else None


@router.get("/progress", response_model=ClientProgress)
def progress(
    range_key: str = Query("all", alias="range"),
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Everything the My Progress screen needs except the per-lift series
    (fetched separately per selected exercise). Read-only apart from bodyweight,
    which is the single client-owned writable feature."""
    now = datetime.now(timezone.utc)
    today = now.date()
    start = _range_start(range_key, now)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    completed = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.client_id == client.id, WorkoutSession.ended_at.isnot(None))
        .order_by(WorkoutSession.started_at)
        .all()
    )
    completed_weeks = set()
    for s in completed:
        iso = s.started_at.astimezone(timezone.utc).date().isocalendar()
        completed_weeks.add((iso[0], iso[1]))

    avg_per_week = None
    if completed:
        first = completed[0].started_at.astimezone(timezone.utc).date()
        weeks_active = max(1.0, ((today - first).days + 1) / 7)
        avg_per_week = round(len(completed) / weeks_active, 1)

    # PRs (all-time for totals/most-improved; range-filtered for the timeline)
    prs = (
        db.query(PR, Exercise.name)
        .join(Exercise, Exercise.id == PR.exercise_id)
        .filter(PR.client_id == client.id)
        .order_by(PR.achieved_at)
        .all()
    )
    e1rm_by_exercise: dict[int, list] = defaultdict(list)
    pr_count_by_exercise: dict[int, int] = defaultdict(int)
    names: dict[int, str] = {}
    for pr, name in prs:
        names[pr.exercise_id] = name
        pr_count_by_exercise[pr.exercise_id] += 1
        if pr.pr_type == PrTypeEnum.estimated_1rm:
            e1rm_by_exercise[pr.exercise_id].append(pr)
    most_improved = None
    most_improved_id = None
    best_pct = 0.0
    for ex_id, lift_prs in e1rm_by_exercise.items():
        if len(lift_prs) < 2:
            continue
        first_val = to_lbs(lift_prs[0].value, lift_prs[0].unit)
        last_val = to_lbs(lift_prs[-1].value, lift_prs[-1].unit)
        if first_val <= 0:
            continue
        pct = (last_val - first_val) / first_val * 100
        if pct > best_pct:
            best_pct = pct
            most_improved = f"{names[ex_id]} +{pct:.1f}%"
            most_improved_id = ex_id

    pr_timeline = [
        PortalPR(
            exercise_name=name,
            pr_type=pr.pr_type.value,
            value=round(float(pr.value), 1),
            unit=pr.unit.value if pr.unit else pr.distance_unit.value,
            reps=pr.reps,
            achieved_at=pr.achieved_at,
        )
        for pr, name in sorted(prs, key=lambda r: r[0].achieved_at, reverse=True)
        if start is None or pr.achieved_at >= start
    ]

    # Consistency: weekly counts across the selected range (cap "all" at 52 weeks)
    current_monday = today - timedelta(days=today.weekday())
    if start is not None:
        n_weeks = max(1, min(52, (today - start.date()).days // 7 + 1))
    else:
        first_date = completed[0].started_at.astimezone(timezone.utc).date() if completed else today
        n_weeks = max(1, min(52, (today - first_date).days // 7 + 1))
    window_start = current_monday - timedelta(weeks=n_weeks - 1)
    per_week: dict = defaultdict(int)
    for s in completed:
        d = s.started_at.astimezone(timezone.utc).date()
        monday = d - timedelta(days=d.weekday())
        if monday >= window_start:
            per_week[monday] += 1
    consistency = [
        PortalWeek(week_start=window_start + timedelta(weeks=i), workouts=per_week.get(window_start + timedelta(weeks=i), 0))
        for i in range(n_weeks)
    ]

    # Bodyweight logs in range (oldest first, for the trend chart)
    bw_query = db.query(BodyweightLog).filter(BodyweightLog.client_id == client.id)
    if start is not None:
        bw_query = bw_query.filter(BodyweightLog.logged_at >= start)
    bodyweight = [
        BodyweightLogOut(id=b.id, logged_at=b.logged_at, weight=round(float(b.weight), 1), unit=b.unit.value)
        for b in bw_query.order_by(BodyweightLog.logged_at).all()
    ]

    # Exercises the client has actually trained (weighted sets), for the picker
    trained_rows = (
        db.query(SetEntry.exercise_id, Exercise.name)
        .join(WorkoutSession, WorkoutSession.id == SetEntry.session_id)
        .join(Exercise, Exercise.id == SetEntry.exercise_id)
        .filter(
            WorkoutSession.client_id == client.id,
            WorkoutSession.ended_at.isnot(None),
            SetEntry.weight.isnot(None),
        )
        .distinct()
        .all()
    )
    options = sorted(
        (
            ProgressExerciseOption(
                exercise_id=eid, exercise_name=name, pr_count=pr_count_by_exercise.get(eid, 0)
            )
            for eid, name in trained_rows
        ),
        key=lambda o: (-o.pr_count, o.exercise_name.lower()),
    )
    default_id = most_improved_id or (options[0].exercise_id if options else None)

    return ClientProgress(
        unit=client.preferred_unit,
        stats=ClientProgressStats(
            streak_weeks=_streak_weeks(completed_weeks, today),
            total_workouts=len(completed),
            workouts_this_month=sum(1 for s in completed if s.started_at >= month_start),
            total_prs=len(prs),
            avg_workouts_per_week=avg_per_week,
            most_improved_lift=most_improved,
            most_improved_exercise_id=most_improved_id,
        ),
        consistency=consistency,
        pr_timeline=pr_timeline,
        bodyweight=bodyweight,
        exercise_options=options,
        default_exercise_id=default_id,
    )


@router.get("/progress/strength", response_model=StrengthSeries)
def strength_series(
    exercise_id: int,
    range_key: str = Query("all", alias="range"),
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Per-session best estimated 1RM for one lift, with sessions that produced a
    PR flagged for trophy markers."""
    now = datetime.now(timezone.utc)
    start = _range_start(range_key, now)

    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    q = (
        db.query(SetEntry, WorkoutSession.started_at)
        .join(WorkoutSession, WorkoutSession.id == SetEntry.session_id)
        .filter(
            WorkoutSession.client_id == client.id,
            WorkoutSession.ended_at.isnot(None),
            SetEntry.exercise_id == exercise_id,
            SetEntry.weight.isnot(None),
            SetEntry.reps.isnot(None),
        )
    )
    if start is not None:
        q = q.filter(WorkoutSession.started_at >= start)

    best_by_day: dict = {}
    pr_days: set = set()
    for st, started_at in q.all():
        day = started_at.astimezone(timezone.utc).date()
        e1 = estimated_1rm(to_lbs(total_load(st.weight, st.is_per_side), st.weight_unit or client.preferred_unit), st.reps)
        if e1 > best_by_day.get(day, 0.0):
            best_by_day[day] = e1
        if st.is_pr:
            pr_days.add(day)

    points = [
        StrengthPoint(date=day, value=round(from_lbs(val, client.preferred_unit), 1), is_pr=day in pr_days)
        for day, val in sorted(best_by_day.items())
    ]
    return StrengthSeries(
        exercise_id=exercise_id,
        exercise_name=exercise.name,
        unit=client.preferred_unit,
        points=points,
    )


@router.post("/bodyweight", response_model=BodyweightLogOut, status_code=201)
def log_bodyweight(
    body: BodyweightLogCreate,
    client: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """The one client-owned WRITE: self-logged bodyweight in the client's unit."""
    if body.weight <= 0 or body.weight > 1500:
        raise HTTPException(status_code=422, detail="Enter a realistic weight")
    log = BodyweightLog(client_id=client.id, weight=body.weight, unit=client.preferred_unit)
    db.add(log)
    db.commit()
    db.refresh(log)
    return BodyweightLogOut(id=log.id, logged_at=log.logged_at, weight=round(float(log.weight), 1), unit=log.unit.value)
