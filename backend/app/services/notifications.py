"""Notification generation.

A single idempotent pass builds all four notification types. Each candidate carries
a stable ``dedup_key``; a unique (trainer_id, dedup_key) constraint means a recurring
condition (inactive client, missed session) notifies once, not every run.

In production the recurring checks (inactive/missed) would run on a daily cron and the
event types (PR/reminder) would fire from their triggers. Here we run the whole pass
lazily when the trainer reads their notifications — cheap for MVP data volumes and
safe to call repeatedly.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.enums import ClientStatusEnum, NotificationTypeEnum, ScheduledStatusEnum
from ..models.notifications import Notification
from ..models.prs import PR
from ..models.roster import Client
from ..models.schedule import ScheduledSession
from ..models.sessions import WorkoutSession

INACTIVE_DAYS = 7  # matches the roster "inactive 7+ days" definition
MISSED_GRACE_HOURS = 2  # a slot is "missed" only once it's this long past its time
REMINDER_LEAD_MINUTES = 60  # remind ~1h before an upcoming session
PR_LOOKBACK_DAYS = 7  # don't backfill ancient PRs as notifications


def generate_notifications(db: Session, trainer_id: int) -> None:
    now = datetime.now(timezone.utc)
    candidates: list[dict] = []

    active_clients = (
        db.query(Client)
        .filter(Client.trainer_id == trainer_id, Client.status == ClientStatusEnum.active)
        .all()
    )
    client_by_id = {c.id: c for c in active_clients}
    client_ids = list(client_by_id)

    # --- Client inactive: last completed workout > INACTIVE_DAYS ago (or never) ---
    if client_ids:
        last_workout = dict(
            db.query(WorkoutSession.client_id, func.max(WorkoutSession.started_at))
            .filter(WorkoutSession.client_id.in_(client_ids), WorkoutSession.ended_at.isnot(None))
            .group_by(WorkoutSession.client_id)
            .all()
        )
        cutoff = now - timedelta(days=INACTIVE_DAYS)
        for c in active_clients:
            last = last_workout.get(c.id)
            if last is not None and last >= cutoff:
                continue  # trained recently
            if last is None:
                # Never trained — don't nag brand-new clients in their first week.
                if c.created_at and c.created_at >= cutoff:
                    continue
                spell = f"never:{int(c.created_at.timestamp()) if c.created_at else 0}"
                days = (now - c.created_at).days if c.created_at else INACTIVE_DAYS
                msg = f"{c.name} hasn't logged a workout yet ({days} days since joining)."
            else:
                # Re-arm per inactivity spell: the key is tied to their last workout,
                # so training again then lapsing produces a fresh notification.
                spell = f"since:{int(last.timestamp())}"
                days = (now - last).days
                msg = f"{c.name} hasn't worked out in {days} days."
            candidates.append(
                {
                    "type": NotificationTypeEnum.client_inactive,
                    "client_id": c.id,
                    "message": msg,
                    "dedup_key": f"inactive:{c.id}:{spell}",
                }
            )

    # --- New PR: recent PRs for this trainer's clients, one notification each ---
    if client_ids:
        pr_rows = (
            db.query(PR)
            .filter(
                PR.client_id.in_(client_ids),
                PR.achieved_at >= now - timedelta(days=PR_LOOKBACK_DAYS),
            )
            .all()
        )
        for pr in pr_rows:
            client = client_by_id.get(pr.client_id)
            if client is None:
                continue
            kind = "estimated 1RM" if pr.pr_type.value == "estimated_1rm" else "lift"
            reps = f" × {pr.reps}" if pr.reps else ""
            candidates.append(
                {
                    "type": NotificationTypeEnum.new_pr,
                    "client_id": pr.client_id,
                    "message": f"🏆 {client.name} hit a new {kind} PR: {float(pr.value):g} {pr.unit.value}{reps}.",
                    "dedup_key": f"pr:{pr.id}",
                }
            )

    # --- Scheduled: upcoming reminders + missed sessions ---
    scheduled = (
        db.query(ScheduledSession)
        .filter(
            ScheduledSession.trainer_id == trainer_id,
            ScheduledSession.status == ScheduledStatusEnum.upcoming,
        )
        .all()
    )
    reminder_window_end = now + timedelta(minutes=REMINDER_LEAD_MINUTES)
    missed_before = now - timedelta(hours=MISSED_GRACE_HOURS)
    for s in scheduled:
        client = client_by_id.get(s.client_id)
        name = client.name if client else "a client"
        if now <= s.scheduled_at <= reminder_window_end:
            when = s.scheduled_at.astimezone(timezone.utc).strftime("%-I:%M %p UTC")
            candidates.append(
                {
                    "type": NotificationTypeEnum.session_reminder,
                    "client_id": s.client_id,
                    "scheduled_session_id": s.id,
                    "message": f"📅 Upcoming session with {name} at {when}.",
                    "dedup_key": f"reminder:{s.id}",
                }
            )
        elif s.scheduled_at < missed_before and s.workout_session_id is None:
            candidates.append(
                {
                    "type": NotificationTypeEnum.missed_workout,
                    "client_id": s.client_id,
                    "scheduled_session_id": s.id,
                    "message": f"❌ Missed session with {name} — no workout was logged.",
                    "dedup_key": f"missed:{s.id}",
                }
            )

    if not candidates:
        return

    existing = {
        k
        for (k,) in db.query(Notification.dedup_key).filter(
            Notification.trainer_id == trainer_id,
            Notification.dedup_key.in_([c["dedup_key"] for c in candidates]),
        )
    }
    new_rows = [
        Notification(trainer_id=trainer_id, **c) for c in candidates if c["dedup_key"] not in existing
    ]
    if new_rows:
        db.add_all(new_rows)
        db.commit()
