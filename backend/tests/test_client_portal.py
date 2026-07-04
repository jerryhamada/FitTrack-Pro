from __future__ import annotations

from datetime import datetime, timezone


def _log_completed_workout(api, client_id, exercise_id, sets):
    """Helper: start a session as the trainer, log sets, complete it. Returns id."""
    sid = api.post("/sessions", json={"client_id": client_id}).json()["id"]
    for weight, reps in sets:
        api.post(f"/sessions/{sid}/sets", json={"exercise_id": exercise_id, "weight": weight, "weight_unit": "lbs", "reps": reps})
    api.post(f"/sessions/{sid}/complete")
    return sid


def test_dashboard_shape(client_api, api, client_row, exercise):
    _log_completed_workout(api, client_row.id, exercise.id, [(135, 5)])
    r = client_api.get("/client-portal/dashboard")
    assert r.status_code == 200
    d = r.json()
    assert d["client_name"] == "Test Client"
    assert d["lifetime_workouts"] == 1
    assert isinstance(d["recent_prs"], list) and len(d["recent_prs"]) >= 1
    assert len(d["weekly_workouts"]) == 12


def test_history_and_detail_excludes_trainer_notes(client_api, api, client_row, exercise):
    sid = _log_completed_workout(api, client_row.id, exercise.id, [(135, 5), (145, 5)])
    hist = client_api.get("/client-portal/history").json()
    assert hist["summary"]["total_workouts"] == 1
    assert len(hist["workouts"]) == 1

    detail = client_api.get(f"/client-portal/workouts/{sid}").json()
    # workout-level notes field may exist, but never the trainer-only client_notes
    assert "notes" in detail
    assert "trainer_notes" not in detail
    assert detail["exercises"][0]["exercise_name"] == "Bench Press"


def test_workout_detail_scoped_to_own_client(client_api, api, db, trainer, exercise):
    """A client must not be able to fetch another client's workout."""
    from app.models.roster import Client
    from app.models.enums import ClientStatusEnum, UnitEnum

    other = Client(trainer_id=trainer.id, name="Other", email="o@c.com", status=ClientStatusEnum.active, preferred_unit=UnitEnum.lbs)
    db.add(other)
    db.flush()
    foreign_sid = _log_completed_workout(api, other.id, exercise.id, [(100, 5)])

    # client_api is scoped to client_row, not `other`
    r = client_api.get(f"/client-portal/workouts/{foreign_sid}")
    assert r.status_code == 404


def test_progress_and_strength(client_api, api, client_row, exercise):
    _log_completed_workout(api, client_row.id, exercise.id, [(135, 5)])
    prog = client_api.get("/client-portal/progress", params={"range": "3m"}).json()
    assert prog["stats"]["total_workouts"] == 1
    assert prog["default_exercise_id"] == exercise.id
    assert any(o["exercise_id"] == exercise.id for o in prog["exercise_options"])

    strength = client_api.get(
        "/client-portal/progress/strength", params={"exercise_id": exercise.id, "range": "all"}
    ).json()
    assert strength["exercise_name"] == "Bench Press"
    assert len(strength["points"]) >= 1
    assert strength["points"][0]["is_pr"] is True  # first ever set is a PR


def test_bodyweight_write_and_readback(client_api):
    r = client_api.post("/client-portal/bodyweight", json={"weight": 142.5})
    assert r.status_code == 201
    assert r.json()["weight"] == 142.5

    prog = client_api.get("/client-portal/progress", params={"range": "all"}).json()
    assert len(prog["bodyweight"]) == 1
    assert prog["bodyweight"][0]["weight"] == 142.5


def test_bodyweight_rejects_nonsense(client_api):
    assert client_api.post("/client-portal/bodyweight", json={"weight": -5}).status_code == 422
    assert client_api.post("/client-portal/bodyweight", json={"weight": 9999}).status_code == 422
