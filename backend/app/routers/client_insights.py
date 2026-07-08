from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.enums import PrTypeEnum, SetStatusEnum, UnitEnum
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.prs import PR
from ..models.roster import Client
from ..models.sessions import SetEntry, WorkoutSession
from ..schemas.insights import (
    BestSet,
    ClientExerciseInsights,
    ClientOverviewStats,
    ClientPRSummary,
    ClientWeeklyStats,
    ExerciseInsight,
    ExercisePRSummary,
    PeakSet,
    WeeklyStat,
)
from ..services.one_rm import set_e1rm_lbs, set_est_1rm
from ..services.units import from_lbs, to_lbs, total_load
from ..services.volume import set_volume_lbs
from .clients import _streak_weeks

router = APIRouter(tags=["client-insights"])


def _get_client_or_404(db: Session, trainer_id: int, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


def _session_hours(s: WorkoutSession) -> float:
    if s.duration_seconds:
        return s.duration_seconds / 3600
    if s.ended_at:
        return (s.ended_at - s.started_at).total_seconds() / 3600
    return 0.0


@router.get("/clients/{client_id}/overview-stats", response_model=ClientOverviewStats)
def overview_stats(
    client_id: int,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    _get_client_or_404(db, trainer.id, client_id)
    now = datetime.now(timezone.utc)
    today = now.date()

    completed = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.client_id == client_id, WorkoutSession.ended_at.isnot(None))
        .order_by(WorkoutSession.started_at)
        .all()
    )
    lifetime_workouts = len(completed)
    hours_trained = round(sum(_session_hours(s) for s in completed), 1)

    completed_weeks = set()
    for s in completed:
        iso = s.started_at.astimezone(timezone.utc).date().isocalendar()
        completed_weeks.add((iso[0], iso[1]))

    avg_per_week = None
    if completed:
        first = completed[0].started_at.astimezone(timezone.utc).date()
        weeks_active = max(1.0, ((today - first).days + 1) / 7)
        avg_per_week = round(lifetime_workouts / weeks_active, 1)

    lifetime_prs = db.query(func.count(PR.id)).filter(PR.client_id == client_id).scalar() or 0

    # Most improved lift: biggest % gain between first and latest estimated-1RM PR per exercise.
    e1rm_prs = (
        db.query(PR, Exercise.name)
        .join(Exercise, Exercise.id == PR.exercise_id)
        .filter(PR.client_id == client_id, PR.pr_type == PrTypeEnum.estimated_1rm)
        .order_by(PR.achieved_at)
        .all()
    )
    by_exercise: dict[int, list] = defaultdict(list)
    names: dict[int, str] = {}
    for pr, exercise_name in e1rm_prs:
        by_exercise[pr.exercise_id].append(pr)
        names[pr.exercise_id] = exercise_name
    most_improved = None
    best_pct = 0.0
    for exercise_id, prs in by_exercise.items():
        if len(prs) < 2:
            continue
        first_val = to_lbs(prs[0].value, prs[0].unit)
        last_val = to_lbs(prs[-1].value, prs[-1].unit)
        if first_val <= 0:
            continue
        pct = (last_val - first_val) / first_val * 100
        if pct > best_pct:
            best_pct = pct
            most_improved = f"{names[exercise_id]} +{pct:.1f}%"

    return ClientOverviewStats(
        lifetime_workouts=lifetime_workouts,
        lifetime_prs=lifetime_prs,
        hours_trained=hours_trained,
        current_streak_weeks=_streak_weeks(completed_weeks, today),
        avg_workouts_per_week=avg_per_week,
        most_improved_lift=most_improved,
    )


@router.get("/clients/{client_id}/weekly-stats", response_model=ClientWeeklyStats)
def weekly_stats(
    client_id: int,
    weeks: int = Query(12, ge=1, le=52),
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer.id, client_id)
    today = datetime.now(timezone.utc).date()
    current_monday = today - timedelta(days=today.weekday())
    window_start = current_monday - timedelta(weeks=weeks - 1)

    sessions = (
        db.query(WorkoutSession)
        .options(joinedload(WorkoutSession.sets))
        .filter(
            WorkoutSession.client_id == client_id,
            WorkoutSession.ended_at.isnot(None),
            WorkoutSession.started_at
            >= datetime.combine(window_start, datetime.min.time(), tzinfo=timezone.utc),
        )
        .all()
    )

    workouts_by_week: dict[date, int] = defaultdict(int)
    volume_lbs_by_week: dict[date, float] = defaultdict(float)
    for s in sessions:
        d = s.started_at.astimezone(timezone.utc).date()
        monday = d - timedelta(days=d.weekday())
        workouts_by_week[monday] += 1
        volume_lbs_by_week[monday] += sum(set_volume_lbs(st) for st in s.sets)

    out = []
    for i in range(weeks):
        monday = window_start + timedelta(weeks=i)
        out.append(
            WeeklyStat(
                week_start=monday,
                workouts=workouts_by_week.get(monday, 0),
                volume=round(from_lbs(volume_lbs_by_week.get(monday, 0.0), client.preferred_unit), 1),
            )
        )
    return ClientWeeklyStats(unit=client.preferred_unit, weeks=out)


@router.get("/clients/{client_id}/exercise-insights", response_model=ClientExerciseInsights)
def exercise_insights(
    client_id: int,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Per-exercise usage for the workout-logging screen: how often each exercise was
    used, when last, and the best set from each of the client's last 3 sessions that
    included it (weights in the client's preferred unit)."""
    client = _get_client_or_404(db, trainer.id, client_id)
    unit = client.preferred_unit

    rows = (
        db.query(SetEntry, WorkoutSession.id, WorkoutSession.started_at)
        .join(WorkoutSession, WorkoutSession.id == SetEntry.session_id)
        .filter(
            WorkoutSession.client_id == client_id,
            WorkoutSession.ended_at.isnot(None),
            SetEntry.status != SetStatusEnum.skipped,
        )
        .all()
    )

    # exercise_id -> session_id -> (started_at, best set so far)
    by_exercise: dict[int, dict[int, tuple[datetime, SetEntry]]] = defaultdict(dict)
    for st, session_id, started_at in rows:
        current = by_exercise[st.exercise_id].get(session_id)
        if current is None or _set_sort_key(st) > _set_sort_key(current[1]):
            by_exercise[st.exercise_id][session_id] = (started_at, st)

    # Peak Set per exercise: the completed set with the highest est_1rm on record —
    # by value, not recency. Unlike last3 above this deliberately INCLUDES sets from
    # in-progress sessions, so the Add Set strip updates live as sets are logged.
    peak_rows = (
        db.query(SetEntry, WorkoutSession.started_at)
        .join(WorkoutSession, WorkoutSession.id == SetEntry.session_id)
        .filter(
            WorkoutSession.client_id == client_id,
            SetEntry.status == SetStatusEnum.completed,
            SetEntry.weight.isnot(None),
            SetEntry.reps.isnot(None),
        )
        .all()
    )
    peak_by_exercise: dict[int, tuple[float, datetime, SetEntry]] = {}
    for st, started_at in peak_rows:
        e1_lbs = set_e1rm_lbs(st)
        if e1_lbs is None:
            continue
        current_peak = peak_by_exercise.get(st.exercise_id)
        if current_peak is None or e1_lbs > current_peak[0]:
            peak_by_exercise[st.exercise_id] = (e1_lbs, started_at, st)

    def _peak_out(exercise_id: int) -> PeakSet | None:
        peak = peak_by_exercise.get(exercise_id)
        if peak is None:
            return None
        st = peak[2]
        native_e1rm = st.est_1rm if st.est_1rm is not None else set_est_1rm(st.weight, st.reps)
        return PeakSet(
            weight=float(st.weight),
            unit=st.weight_unit or UnitEnum.lbs,
            reps=st.reps,
            is_per_side=st.is_per_side,
            est_1rm=round(float(native_e1rm), 1),
        )

    out = []
    for exercise_id, sessions in by_exercise.items():
        ordered = sorted(sessions.values(), key=lambda pair: pair[0], reverse=True)
        best_sets = [
            BestSet(
                weight=round(from_lbs(to_lbs(total_load(st.weight, st.is_per_side), st.weight_unit or unit), unit), 1)
                if st.weight is not None
                else None,
                reps=st.reps,
                session_date=started_at.astimezone(timezone.utc).date(),
            )
            for started_at, st in ordered[:3]
        ]
        out.append(
            ExerciseInsight(
                exercise_id=exercise_id,
                sessions_used=len(sessions),
                last_used_at=ordered[0][0],
                last3_best=best_sets,
                peak_set=_peak_out(exercise_id),
            )
        )
    # Exercises seen only in an in-progress session (first time being logged) still
    # need their live peak on the strip — emit a history-less row for them.
    for exercise_id, (_, started_at, _st) in peak_by_exercise.items():
        if exercise_id not in by_exercise:
            out.append(
                ExerciseInsight(
                    exercise_id=exercise_id,
                    sessions_used=0,
                    last_used_at=started_at,
                    last3_best=[],
                    peak_set=_peak_out(exercise_id),
                )
            )
    out.sort(key=lambda e: e.last_used_at, reverse=True)
    return ClientExerciseInsights(unit=unit, exercises=out)


def _set_sort_key(st: SetEntry) -> tuple[float, int]:
    """Heavier load wins; ties break on reps."""
    load = to_lbs(total_load(st.weight, st.is_per_side), st.weight_unit or UnitEnum.lbs) if st.weight else 0.0
    return (load, st.reps or 0)


@router.get("/clients/{client_id}/pr-summary", response_model=ClientPRSummary)
def pr_summary(
    client_id: int,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer.id, client_id)
    now = datetime.now(timezone.utc)
    unit = client.preferred_unit

    # Best lifts from actual logged sets (completed sets of completed sessions).
    set_rows = (
        db.query(SetEntry, Exercise.name)
        .join(WorkoutSession, WorkoutSession.id == SetEntry.session_id)
        .join(Exercise, Exercise.id == SetEntry.exercise_id)
        .filter(
            WorkoutSession.client_id == client_id,
            WorkoutSession.ended_at.isnot(None),
            SetEntry.status != SetStatusEnum.skipped,
        )
        .all()
    )

    best_weight_lbs: dict[int, float] = {}
    best_weight_reps: dict[int, int | None] = {}
    best_volume_lbs: dict[int, float] = {}
    names: dict[int, str] = {}
    for st, exercise_name in set_rows:
        ex_id = st.exercise_id
        names[ex_id] = exercise_name
        if st.weight is not None:
            load = to_lbs(total_load(st.weight, st.is_per_side), st.weight_unit or UnitEnum.lbs)
            if load > best_weight_lbs.get(ex_id, 0.0):
                best_weight_lbs[ex_id] = load
                best_weight_reps[ex_id] = st.reps
        vol = set_volume_lbs(st)
        if vol > best_volume_lbs.get(ex_id, 0.0):
            best_volume_lbs[ex_id] = vol

    # PR metadata per exercise.
    prs = db.query(PR).filter(PR.client_id == client_id).all()
    pr_count_by_ex: dict[int, int] = defaultdict(int)
    last_pr_by_ex: dict[int, datetime] = {}
    best_e1rm_lbs: dict[int, float] = {}
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prs_this_month = 0
    last_pr_at = None
    for pr in prs:
        pr_count_by_ex[pr.exercise_id] += 1
        if pr.exercise_id not in last_pr_by_ex or pr.achieved_at > last_pr_by_ex[pr.exercise_id]:
            last_pr_by_ex[pr.exercise_id] = pr.achieved_at
        if pr.pr_type == PrTypeEnum.estimated_1rm:
            val = to_lbs(pr.value, pr.unit)
            if val > best_e1rm_lbs.get(pr.exercise_id, 0.0):
                best_e1rm_lbs[pr.exercise_id] = val
        if pr.achieved_at >= month_start:
            prs_this_month += 1
        if last_pr_at is None or pr.achieved_at > last_pr_at:
            last_pr_at = pr.achieved_at

    exercises = [
        ExercisePRSummary(
            exercise_id=ex_id,
            exercise_name=names[ex_id],
            best_weight=round(from_lbs(best_weight_lbs[ex_id], unit), 1) if ex_id in best_weight_lbs else None,
            best_weight_reps=best_weight_reps.get(ex_id),
            best_e1rm=round(from_lbs(best_e1rm_lbs[ex_id], unit), 1) if ex_id in best_e1rm_lbs else None,
            best_set_volume=round(from_lbs(best_volume_lbs[ex_id], unit), 1)
            if ex_id in best_volume_lbs
            else None,
            pr_count=pr_count_by_ex.get(ex_id, 0),
            last_pr_at=last_pr_by_ex.get(ex_id),
        )
        for ex_id in sorted(names, key=lambda e: names[e].lower())
    ]

    return ClientPRSummary(
        unit=unit,
        lifetime_pr_count=len(prs),
        prs_this_month=prs_this_month,
        last_pr_at=last_pr_at,
        exercises=exercises,
    )
