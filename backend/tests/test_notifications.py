from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.enums import ClientStatusEnum, UnitEnum
from app.models.roster import Client
from app.services.notifications import generate_notifications


def _stale_client(db, trainer, days_old=40):
    """An active client created long ago with no workouts → inactive candidate."""
    c = Client(
        trainer_id=trainer.id,
        name="Stale",
        email="stale@c.com",
        status=ClientStatusEnum.active,
        preferred_unit=UnitEnum.lbs,
    )
    db.add(c)
    db.flush()
    # backdate created_at so it's past the "don't nag new clients" grace window
    c.created_at = datetime.now(timezone.utc) - timedelta(days=days_old)
    db.flush()
    return c


def test_generation_creates_and_dedupes(db, trainer, api):
    _stale_client(db, trainer)
    generate_notifications(db, trainer.id)
    first = api.get("/notifications").json()
    assert len(first) >= 1

    # running again must not create duplicates for the same condition
    generate_notifications(db, trainer.id)
    second = api.get("/notifications").json()
    assert len(second) == len(first)


def test_unread_count_and_mark_read(db, trainer, api):
    _stale_client(db, trainer)
    generate_notifications(db, trainer.id)

    count = api.get("/notifications/unread-count").json()["count"]
    assert count >= 1

    first_id = api.get("/notifications").json()[0]["id"]
    api.post(f"/notifications/{first_id}/read")
    assert api.get("/notifications/unread-count").json()["count"] == count - 1


def test_mark_all_read(db, trainer, api):
    _stale_client(db, trainer)
    generate_notifications(db, trainer.id)
    api.post("/notifications/read-all")
    assert api.get("/notifications/unread-count").json()["count"] == 0
