from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.activity import ActivityEvent
from ..models.enums import ActivityEventTypeEnum
from ..models.prs import PR, Badge, ClientBadge
from ..models.sessions import WorkoutSession

# Generic milestone badges only for Phase 1 (confirmed with user) -- exercise/weight
# specific badges like "first 100lb squat" need per-client thresholds defined and are
# deferred. Add new codes here + a matching threshold check to extend.
SESSION_COUNT_BADGES = {
    "first_session": 1,
    "sessions_10": 10,
    "sessions_25": 25,
    "sessions_50": 50,
}
PR_COUNT_BADGES = {
    "first_pr": 1,
    "prs_5": 5,
}

BADGE_SEED = [
    ("first_session", "First Session Logged", "Logged your first training session."),
    ("sessions_10", "10 Sessions Logged", "Logged 10 training sessions."),
    ("sessions_25", "25 Sessions Logged", "Logged 25 training sessions."),
    ("sessions_50", "50 Sessions Logged", "Logged 50 training sessions."),
    ("first_pr", "First PR", "Hit your first personal record."),
    ("prs_5", "5 PRs", "Hit 5 personal records."),
]


def _award(db: Session, client_id: int, trainer_id: int, code: str) -> None:
    badge = db.query(Badge).filter(Badge.code == code).first()
    if badge is None:
        return
    exists = (
        db.query(ClientBadge)
        .filter(ClientBadge.client_id == client_id, ClientBadge.badge_id == badge.id)
        .first()
    )
    if exists:
        return
    db.add(ClientBadge(client_id=client_id, badge_id=badge.id, earned_at=datetime.now(timezone.utc)))
    db.add(
        ActivityEvent(
            trainer_id=trainer_id,
            client_id=client_id,
            event_type=ActivityEventTypeEnum.badge_earned,
            payload={"badge_code": code, "badge_name": badge.name},
        )
    )


def evaluate_badges(db: Session, client_id: int, trainer_id: int) -> None:
    session_count = db.query(func.count(WorkoutSession.id)).filter(WorkoutSession.client_id == client_id).scalar()
    pr_count = db.query(func.count(PR.id)).filter(PR.client_id == client_id).scalar()

    for code, threshold in SESSION_COUNT_BADGES.items():
        if session_count >= threshold:
            _award(db, client_id, trainer_id, code)
    for code, threshold in PR_COUNT_BADGES.items():
        if pr_count >= threshold:
            _award(db, client_id, trainer_id, code)
