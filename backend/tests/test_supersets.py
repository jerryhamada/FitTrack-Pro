from __future__ import annotations

import pytest


@pytest.fixture()
def session_id(api, client_row):
    return api.post("/sessions", json={"client_id": client_row.id}).json()["id"]


def _members(session_json):
    return {e["exercise_name"]: e for e in session_json["session_exercises"]}


def test_add_exercise_creates_membership(api, session_id, exercise):
    r = api.post(f"/sessions/{session_id}/exercises", json={"exercise_id": exercise.id})
    assert r.status_code == 201
    members = _members(r.json())
    assert members["Bench Press"]["superset_group_id"] is None


def test_logging_a_set_auto_adds_membership(api, session_id, exercise):
    api.post(f"/sessions/{session_id}/sets", json={"exercise_id": exercise.id, "reps": 10, "weight": 135, "weight_unit": "lbs"})
    session = api.get(f"/sessions/{session_id}").json()
    assert exercise.id in {e["exercise_id"] for e in session["session_exercises"]}


def test_create_superset_groups_and_orders(api, session_id, exercise, exercise2):
    api.post(f"/sessions/{session_id}/exercises", json={"exercise_id": exercise.id})
    api.post(f"/sessions/{session_id}/exercises", json={"exercise_id": exercise2.id})
    r = api.post(f"/sessions/{session_id}/supersets", json={"exercise_ids": [exercise.id, exercise2.id]})
    assert r.status_code == 200
    members = _members(r.json())
    assert members["Bench Press"]["superset_group_id"] == "A"
    assert members["Bench Press"]["superset_order"] == 0
    assert members["Barbell Row"]["superset_group_id"] == "A"
    assert members["Barbell Row"]["superset_order"] == 1


def test_superset_requires_two(api, session_id, exercise):
    api.post(f"/sessions/{session_id}/exercises", json={"exercise_id": exercise.id})
    r = api.post(f"/sessions/{session_id}/supersets", json={"exercise_ids": [exercise.id]})
    assert r.status_code == 422


def test_ungroup_preserves_sets(api, session_id, exercise, exercise2):
    # log a set for each, group, then ungroup — sets must survive
    api.post(f"/sessions/{session_id}/sets", json={"exercise_id": exercise.id, "reps": 8, "weight": 135, "weight_unit": "lbs"})
    api.post(f"/sessions/{session_id}/sets", json={"exercise_id": exercise2.id, "reps": 10, "weight": 95, "weight_unit": "lbs"})
    api.post(f"/sessions/{session_id}/supersets", json={"exercise_ids": [exercise.id, exercise2.id]})

    r = api.delete(f"/sessions/{session_id}/supersets/A")
    assert r.status_code == 200
    body = r.json()
    assert all(e["superset_group_id"] is None for e in body["session_exercises"])
    assert len(body["sets"]) == 2  # both logged sets intact


def test_move_exercise_in_and_out(api, session_id, exercise, exercise2):
    api.post(f"/sessions/{session_id}/exercises", json={"exercise_id": exercise.id})
    api.post(f"/sessions/{session_id}/exercises", json={"exercise_id": exercise2.id})
    api.post(f"/sessions/{session_id}/supersets", json={"exercise_ids": [exercise.id, exercise2.id]})

    # move exercise2 out of the group
    r = api.put(
        f"/sessions/{session_id}/exercises/{exercise2.id}",
        json={"superset_group_id": None},
    )
    members = _members(r.json())
    assert members["Barbell Row"]["superset_group_id"] is None
    assert members["Bench Press"]["superset_group_id"] == "A"
