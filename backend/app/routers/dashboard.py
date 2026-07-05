from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.enums import ClientStatusEnum, ScheduledStatusEnum
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.programs import ClientProgram, ClientProgramDay
from ..models.prs import PR
from ..models.roster import Client
from ..models.schedule import ScheduledSession
from ..models.sessions import SetEntry, WorkoutSession
from ..schemas.dashboard import CategoryCount, DashboardStats, RecentPROut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

STALE_DAYS = 7  # must match the roster pulse definition in routers/clients.py
ADHERENCE_WINDOW_DAYS = 30


def _count_weekday_occurrences(start: date, end: date, weekday: int) -> int:
    """Number of times `weekday` (0-6) occurs in [start, end] inclusive."""
    if end < start:
        return 0
    total_days = (end - start).days + 1
    full_weeks, remainder = divmod(total_days, 7)
    count = full_weeks
    for offset in range(remainder):
        if (start + timedelta(days=offset)).weekday() % 7 == weekday % 7:
            count += 1
    return count


def _adherence_pct(db: Session, client_ids: list[int], now: datetime) -> float | None:
    """Scheduled-vs-completed over the trailing 30 days. 'Scheduled' comes from
    active client programs' day_of_week slots; clients without scheduled days
    are excluded. Returns None when nothing is scheduled."""
    if not client_ids:
        return None
    window_end = now.date()
    window_start = window_end - timedelta(days=ADHERENCE_WINDOW_DAYS - 1)

    programs = (
        db.query(ClientProgram)
        .filter(ClientProgram.client_id.in_(client_ids), ClientProgram.active.is_(True))
        .all()
    )
    day_rows = (
        db.query(ClientProgramDay)
        .filter(
            ClientProgramDay.client_program_id.in_([p.id for p in programs]),
            ClientProgramDay.day_of_week.isnot(None),
        )
        .all()
        if programs
        else []
    )
    days_by_program: dict[int, list[int]] = {}
    for row in day_rows:
        days_by_program.setdefault(row.client_program_id, []).append(row.day_of_week)

    total_expected = 0
    scheduled_client_ids: set[int] = set()
    for program in programs:
        weekdays = days_by_program.get(program.id)
        if not weekdays:
            continue
        start = max(window_start, program.start_date or program.assigned_at.date())
        expected = sum(_count_weekday_occurrences(start, window_end, wd) for wd in weekdays)
        if expected > 0:
            total_expected += expected
            scheduled_client_ids.add(program.client_id)

    if total_expected == 0:
        return None

    window_start_dt = now - timedelta(days=ADHERENCE_WINDOW_DAYS)
    completed = (
        db.query(func.count(WorkoutSession.id))
        .filter(
            WorkoutSession.client_id.in_(scheduled_client_ids),
            WorkoutSession.started_at >= window_start_dt,
            WorkoutSession.ended_at.isnot(None),
        )
        .scalar()
    ) or 0
    return round(min(completed / total_expected, 1.0) * 100, 1)


@router.get("/stats", response_model=DashboardStats)
def get_stats(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    stale_cutoff = now - timedelta(days=STALE_DAYS)

    active_clients = (
        db.query(Client)
        .filter(Client.trainer_id == trainer.id, Client.status == ClientStatusEnum.active)
        .all()
    )
    client_ids = [c.id for c in active_clients]

    completed = db.query(WorkoutSession).filter(
        WorkoutSession.client_id.in_(client_ids) if client_ids else False,
        WorkoutSession.ended_at.isnot(None),
    )
    workouts_all_time = completed.count()
    workouts_today = completed.filter(WorkoutSession.started_at >= today_start).count()
    workouts_this_week = completed.filter(WorkoutSession.started_at >= week_start).count()

    # Latest session per client → inactive = never trained or stale
    inactive = 0
    if client_ids:
        latest_by_client = dict(
            db.query(WorkoutSession.client_id, func.max(WorkoutSession.started_at))
            .filter(WorkoutSession.client_id.in_(client_ids))
            .group_by(WorkoutSession.client_id)
            .all()
        )
        for cid in client_ids:
            last = latest_by_client.get(cid)
            if last is None or last < stale_cutoff:
                inactive += 1

    prs_q = db.query(func.count(PR.id)).filter(PR.client_id.in_(client_ids) if client_ids else False)
    lifetime_prs = prs_q.scalar() or 0
    prs_last_7 = (
        db.query(func.count(PR.id))
        .filter(
            PR.client_id.in_(client_ids) if client_ids else False,
            PR.achieved_at >= now - timedelta(days=7),
        )
        .scalar()
        or 0
    )

    seconds_this_week = 0
    if client_ids:
        week_sessions = (
            db.query(WorkoutSession)
            .filter(
                WorkoutSession.client_id.in_(client_ids),
                WorkoutSession.started_at >= week_start,
                WorkoutSession.ended_at.isnot(None),
            )
            .all()
        )
        for s in week_sessions:
            if s.duration_seconds:
                seconds_this_week += s.duration_seconds
            elif s.ended_at:
                seconds_this_week += int((s.ended_at - s.started_at).total_seconds())

    top_categories: list[CategoryCount] = []
    if client_ids:
        rows = (
            db.query(Exercise.category, func.count(SetEntry.id))
            .join(SetEntry, SetEntry.exercise_id == Exercise.id)
            .join(WorkoutSession, WorkoutSession.id == SetEntry.session_id)
            .filter(
                WorkoutSession.client_id.in_(client_ids),
                WorkoutSession.started_at >= now - timedelta(days=30),
            )
            .group_by(Exercise.category)
            .order_by(func.count(SetEntry.id).desc())
            .limit(5)
            .all()
        )
        top_categories = [CategoryCount(category=cat, count=cnt) for cat, cnt in rows]

    upcoming_sessions = (
        db.query(func.count(ScheduledSession.id))
        .filter(
            ScheduledSession.trainer_id == trainer.id,
            ScheduledSession.status == ScheduledStatusEnum.upcoming,
            ScheduledSession.scheduled_at >= now,
            ScheduledSession.scheduled_at < now + timedelta(days=7),
        )
        .scalar()
        or 0
    )

    return DashboardStats(
        active_clients=len(client_ids),
        workouts_today=workouts_today,
        workouts_this_week=workouts_this_week,
        workouts_all_time=workouts_all_time,
        adherence_pct=_adherence_pct(db, client_ids, now),
        prs_last_7_days=prs_last_7,
        upcoming_sessions=upcoming_sessions,
        inactive_clients=inactive,
        lifetime_prs=lifetime_prs,
        avg_sessions_per_client=round(workouts_all_time / len(client_ids), 1) if client_ids else None,
        hours_coached_this_week=round(seconds_this_week / 3600, 1),
        top_categories=top_categories,
    )


@router.get("/recent-prs", response_model=list[RecentPROut])
def recent_prs(
    days: int = Query(7, ge=1, le=90),
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(PR, Client.name, Exercise.name)
        .join(Client, Client.id == PR.client_id)
        .join(Exercise, Exercise.id == PR.exercise_id)
        .filter(Client.trainer_id == trainer.id, PR.achieved_at >= cutoff)
        .order_by(PR.achieved_at.desc())
        .limit(100)
        .all()
    )
    return [
        RecentPROut(
            id=pr.id,
            client_id=pr.client_id,
            client_name=client_name,
            exercise_name=exercise_name,
            pr_type=pr.pr_type.value,
            reps=pr.reps,
            value=float(pr.value),
            unit=pr.unit.value if pr.unit else pr.distance_unit.value,
            achieved_at=pr.achieved_at.isoformat(),
        )
        for pr, client_name, exercise_name in rows
    ]
