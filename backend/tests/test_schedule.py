from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _future(days: int = 1, hour: int = 9) -> datetime:
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )


def test_create_single_session(api, client_row):
    at = _future()
    r = api.post("/schedule", json={"client_id": client_row.id, "scheduled_at": _iso(at), "notes": "leg day"})
    assert r.status_code == 201
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["status"] == "upcoming"
    assert rows[0]["series_id"] is None
    assert rows[0]["notes"] == "leg day"


def test_create_weekly_series_bounded_by_until(api, client_row):
    start = _future(days=1)
    until = (start + timedelta(weeks=3)).date().isoformat()
    r = api.post(
        "/schedule",
        json={"client_id": client_row.id, "scheduled_at": _iso(start), "repeat": "weekly", "repeat_until": until},
    )
    assert r.status_code == 201
    rows = r.json()
    assert len(rows) == 4  # weeks 0..3
    series_ids = {row["series_id"] for row in rows}
    assert len(series_ids) == 1 and None not in series_ids


def test_create_for_other_trainers_client_404(api, db, trainer):
    from app.models.identity import User
    from app.models.enums import RoleEnum, ClientStatusEnum
    from app.models.roster import Client

    other = User(clerk_user_id="other", role=RoleEnum.trainer, email="o@t.com")
    db.add(other)
    db.flush()
    foreign = Client(trainer_id=other.id, name="Not Mine", email="x@y.com", status=ClientStatusEnum.active)
    db.add(foreign)
    db.flush()
    r = api.post("/schedule", json={"client_id": foreign.id, "scheduled_at": _iso(_future())})
    assert r.status_code == 404


def test_cancel_one_vs_future(api, client_row):
    start = _future(days=1)
    until = (start + timedelta(weeks=4)).date().isoformat()
    rows = api.post(
        "/schedule",
        json={"client_id": client_row.id, "scheduled_at": _iso(start), "repeat": "weekly", "repeat_until": until},
    ).json()
    assert len(rows) == 5
    ids = [row["id"] for row in rows]

    # cancel just the 2nd occurrence
    r = api.post(f"/schedule/{ids[1]}/cancel", json={"scope": "one"})
    assert r.status_code == 200
    assert len(r.json()) == 1

    # cancel the 3rd and everything after
    r = api.post(f"/schedule/{ids[2]}/cancel", json={"scope": "future"})
    assert {row["id"] for row in r.json()} == {ids[2], ids[3], ids[4]}

    # list the window: #1 still upcoming, #2..5 cancelled
    end = (start + timedelta(weeks=5)).date().isoformat()
    listing = api.get("/schedule", params={"start": start.date().isoformat(), "end": end}).json()
    by_id = {row["id"]: row["status"] for row in listing}
    assert by_id[ids[0]] == "upcoming"
    assert by_id[ids[1]] == "cancelled"
    assert by_id[ids[2]] == "cancelled"


def test_delete_future_removes_rows(api, client_row):
    start = _future(days=1)
    until = (start + timedelta(weeks=2)).date().isoformat()
    rows = api.post(
        "/schedule",
        json={"client_id": client_row.id, "scheduled_at": _iso(start), "repeat": "weekly", "repeat_until": until},
    ).json()
    ids = [row["id"] for row in rows]
    assert len(ids) == 3

    r = api.delete(f"/schedule/{ids[1]}", params={"scope": "future"})
    assert r.status_code == 204

    end = (start + timedelta(weeks=3)).date().isoformat()
    remaining = api.get("/schedule", params={"start": start.date().isoformat(), "end": end}).json()
    assert {row["id"] for row in remaining} == {ids[0]}


def test_start_workout_links_and_autocompletes(api, client_row):
    at = _future()
    slot = api.post("/schedule", json={"client_id": client_row.id, "scheduled_at": _iso(at)}).json()[0]

    r = api.post(f"/schedule/{slot['id']}/start-workout")
    assert r.status_code == 200
    workout_id = r.json()["id"]

    # completing the linked workout should flip the slot to completed
    api.post(f"/sessions/{workout_id}/complete")
    end = (at + timedelta(days=1)).date().isoformat()
    listing = api.get("/schedule", params={"start": at.date().isoformat(), "end": end}).json()
    slot_after = next(row for row in listing if row["id"] == slot["id"])
    assert slot_after["status"] == "completed"
    assert slot_after["workout_session_id"] == workout_id


def test_needs_review_surfaces_past_upcoming(api, db, client_row):
    from app.models.schedule import ScheduledSession
    from app.models.enums import ScheduledStatusEnum

    past = datetime.now(timezone.utc) - timedelta(days=1)
    db.add(
        ScheduledSession(
            trainer_id=client_row.trainer_id,
            client_id=client_row.id,
            scheduled_at=past,
            status=ScheduledStatusEnum.upcoming,
        )
    )
    db.flush()
    r = api.get("/schedule/needs-review")
    assert r.status_code == 200
    assert len(r.json()) == 1
