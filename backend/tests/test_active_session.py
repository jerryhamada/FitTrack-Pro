from __future__ import annotations


def test_no_active_session_returns_null(api):
    r = api.get("/sessions/active")
    assert r.status_code == 200
    assert r.json() is None


def test_active_session_returned_while_in_progress(api, client_row):
    sid = api.post("/sessions", json={"client_id": client_row.id}).json()["id"]
    r = api.get("/sessions/active")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == sid
    assert body["client_name"] == "Test Client"


def test_completed_session_is_not_active(api, client_row):
    sid = api.post("/sessions", json={"client_id": client_row.id}).json()["id"]
    api.post(f"/sessions/{sid}/complete")
    r = api.get("/sessions/active")
    assert r.status_code == 200
    assert r.json() is None


def test_most_recent_wins_when_multiple_in_progress(api, db, trainer, client_row):
    from app.models.roster import Client
    from app.models.enums import ClientStatusEnum, UnitEnum

    # first session, for client_row
    api.post("/sessions", json={"client_id": client_row.id})

    # second, later session for a different client
    other = Client(
        trainer_id=trainer.id, name="Second", email="s@c.com", status=ClientStatusEnum.active, preferred_unit=UnitEnum.lbs
    )
    db.add(other)
    db.flush()
    sid_latest = api.post("/sessions", json={"client_id": other.id}).json()["id"]

    active = api.get("/sessions/active").json()
    assert active["id"] == sid_latest
    assert active["client_name"] == "Second"
