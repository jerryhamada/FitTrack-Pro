"""Est. 1RM tracking: the stored sets.est_1rm column, peak-set surfacing for the
Add Set strip, and the Dashboard strength widget (delta + fallbacks).

Covers the spec's backend scenarios: default unit, per-hand per-side math, peak
by value not recency, recompute on edit, live mid-session peak updates,
first-time empty state, 30-day delta and its insufficient-data fallback, and
chart-data correctness against the stored column.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.models.sessions import SetEntry, WorkoutSession

BENCH_100x10_E1RM = 100 * (1 + 10 / 30)  # 133.33 (Epley)


def start_session(api, client_row) -> int:
    res = api.post("/sessions", json={"client_id": client_row.id})
    assert res.status_code == 201, res.text
    return res.json()["id"]


def log_set(api, session_id: int, exercise_id: int, **overrides) -> dict:
    body = {"exercise_id": exercise_id, "status": "completed", **overrides}
    res = api.post(f"/sessions/{session_id}/sets", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def peak_for(api, client_row, exercise_id: int) -> dict | None:
    res = api.get(f"/clients/{client_row.id}/exercise-insights")
    assert res.status_code == 200, res.text
    row = next((e for e in res.json()["exercises"] if e["exercise_id"] == exercise_id), None)
    return row["peak_set"] if row else None


def backdate_session(db, session_id: int, days_ago: int) -> None:
    s = db.query(WorkoutSession).filter(WorkoutSession.id == session_id).one()
    s.started_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    db.flush()


# ------------------------------------------------------------------ data layer


def test_default_unit_is_lbs(api, db, client_row, exercise):
    sid = start_session(api, client_row)
    out = log_set(api, sid, exercise.id, weight=100, reps=10)  # no weight_unit sent
    assert out["weight_unit"] == "lbs"
    row = db.query(SetEntry).filter(SetEntry.id == out["id"]).one()
    assert row.weight_unit.value == "lbs"
    assert float(row.est_1rm) == pytest.approx(BENCH_100x10_E1RM)


def test_per_side_est_1rm_uses_per_hand_weight(api, db, client_row, exercise):
    # 15 lb per hand x 10 -> 15 * (1 + 10/30) = 20, NOT the doubled 40.
    sid = start_session(api, client_row)
    out = log_set(api, sid, exercise.id, weight=15, reps=10, is_per_side=True)
    assert out["is_per_side"] is True
    row = db.query(SetEntry).filter(SetEntry.id == out["id"]).one()
    assert float(row.est_1rm) == pytest.approx(20.0)


def test_no_weight_or_reps_stores_null_est_1rm(api, db, client_row, exercise):
    sid = start_session(api, client_row)
    bw = log_set(api, sid, exercise.id, reps=12)  # bodyweight
    assert db.query(SetEntry).filter(SetEntry.id == bw["id"]).one().est_1rm is None


# ------------------------------------------------------------------- peak set


def test_peak_set_is_by_value_not_recency(api, db, client_row, exercise):
    # Heavier set lives in an older (backdated) session; a lighter set is logged
    # today. Peak must be the heavier one regardless of date order.
    old_sid = start_session(api, client_row)
    log_set(api, old_sid, exercise.id, weight=150, reps=10)  # e1RM 200
    api.post(f"/sessions/{old_sid}/complete")
    backdate_session(db, old_sid, days_ago=60)

    new_sid = start_session(api, client_row)
    log_set(api, new_sid, exercise.id, weight=100, reps=10)  # e1RM 133.3
    api.post(f"/sessions/{new_sid}/complete")

    peak = peak_for(api, client_row, exercise.id)
    assert peak is not None
    assert peak["weight"] == 150
    assert peak["reps"] == 10
    assert peak["est_1rm"] == pytest.approx(200.0)


def test_peak_updates_live_mid_session(api, client_row, exercise):
    # Session is still in progress (never completed) — the peak must reflect its
    # sets immediately so the Add Set strip updates live, and a peak-beating set
    # comes back flagged is_pr (which fires the celebration).
    sid = start_session(api, client_row)
    first = log_set(api, sid, exercise.id, weight=100, reps=10)
    assert first["is_pr"] is True  # first ever set is a PR
    assert peak_for(api, client_row, exercise.id)["est_1rm"] == pytest.approx(133.3)

    higher = log_set(api, sid, exercise.id, weight=120, reps=10)  # e1RM 160
    assert higher["is_pr"] is True
    peak = peak_for(api, client_row, exercise.id)
    assert peak["weight"] == 120
    assert peak["est_1rm"] == pytest.approx(160.0)


def test_first_time_exercise_has_no_peak(api, client_row, exercise):
    # No history at all -> no insight row / no peak (the strip shows
    # "No peak set yet — this will be the first!").
    assert peak_for(api, client_row, exercise.id) is None


def test_per_side_peak_reports_per_hand_values(api, client_row, exercise):
    sid = start_session(api, client_row)
    log_set(api, sid, exercise.id, weight=50, reps=6, is_per_side=True)
    peak = peak_for(api, client_row, exercise.id)
    assert peak["weight"] == 50  # per-hand, not 100
    assert peak["is_per_side"] is True
    assert peak["est_1rm"] == pytest.approx(60.0)


# ------------------------------------------------------------ recompute on edit


def test_edit_recomputes_est_1rm_and_peak(api, db, client_row, exercise):
    sid = start_session(api, client_row)
    first = log_set(api, sid, exercise.id, weight=100, reps=10)  # e1RM 133.3
    second = log_set(api, sid, exercise.id, weight=120, reps=10)  # e1RM 160 — current peak
    assert peak_for(api, client_row, exercise.id)["weight"] == 120

    # Edit the first set past the peak: est_1rm recomputes and it retakes the
    # peak + PR status everywhere.
    res = api.put(f"/sets/{first['id']}", json={"weight": 150})
    assert res.status_code == 200, res.text
    edited = res.json()
    assert edited["est_1rm"] == pytest.approx(200.0)
    assert edited["is_pr"] is True

    peak = peak_for(api, client_row, exercise.id)
    assert peak["weight"] == 150
    assert peak["est_1rm"] == pytest.approx(200.0)

    row = db.query(SetEntry).filter(SetEntry.id == first["id"]).one()
    assert float(row.est_1rm) == pytest.approx(200.0)
    # `second` is untouched by the edit
    assert float(db.query(SetEntry).filter(SetEntry.id == second["id"]).one().est_1rm) == pytest.approx(160.0)


def test_edit_down_loses_pr_status(api, client_row, exercise):
    sid = start_session(api, client_row)
    only = log_set(api, sid, exercise.id, weight=100, reps=10)
    heavy = log_set(api, sid, exercise.id, weight=200, reps=10)
    assert heavy["is_pr"] is True

    res = api.put(f"/sets/{heavy['id']}", json={"weight": 50})
    assert res.status_code == 200
    downgraded = res.json()
    assert downgraded["est_1rm"] == pytest.approx(50 * (1 + 10 / 30))
    assert downgraded["is_pr"] is False  # no longer beats the 100x10 in history

    peak = peak_for(api, client_row, exercise.id)
    assert peak["weight"] == 100
    assert only["is_pr"] is True


# ------------------------------------------------- dashboard widget (portal)


def test_strength_summary_delta_over_30_days(client_api, api, db, client_row, exercise):
    old_sid = start_session(api, client_row)
    log_set(api, old_sid, exercise.id, weight=100, reps=10)  # baseline e1RM 133.3
    api.post(f"/sessions/{old_sid}/complete")
    backdate_session(db, old_sid, days_ago=40)

    new_sid = start_session(api, client_row)
    log_set(api, new_sid, exercise.id, weight=120, reps=10)  # peak e1RM 160
    api.post(f"/sessions/{new_sid}/complete")

    res = client_api.get("/client-portal/strength-summary")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["exercise_id"] == exercise.id
    # Baseline = point nearest the 30-day window start (the 40-day-old one).
    assert body["delta_value"] == pytest.approx(160.0 - 133.3, abs=0.11)
    assert body["delta_pct"] == pytest.approx(20.0, abs=0.2)


def test_strength_summary_delta_fallback_when_history_too_young(client_api, api, client_row, exercise):
    # Two points but all within the last week -> no delta (UI shows
    # "Keep logging to see your trend").
    for weight in (100, 120):
        sid = start_session(api, client_row)
        log_set(api, sid, exercise.id, weight=weight, reps=10)
        api.post(f"/sessions/{sid}/complete")

    body = client_api.get("/client-portal/strength-summary").json()
    assert len(body["points"]) >= 1
    assert body["delta_value"] is None
    assert body["delta_pct"] is None


def test_strength_summary_delta_fallback_single_point(client_api, api, db, client_row, exercise):
    sid = start_session(api, client_row)
    log_set(api, sid, exercise.id, weight=100, reps=10)
    api.post(f"/sessions/{sid}/complete")
    backdate_session(db, sid, days_ago=45)  # old enough, but only one point

    body = client_api.get("/client-portal/strength-summary").json()
    assert len(body["points"]) == 1
    assert body["delta_value"] is None


def test_strength_summary_defaults_to_most_recently_logged(client_api, api, db, client_row, exercise, exercise2):
    old_sid = start_session(api, client_row)
    log_set(api, old_sid, exercise.id, weight=200, reps=5)
    api.post(f"/sessions/{old_sid}/complete")
    backdate_session(db, old_sid, days_ago=10)

    new_sid = start_session(api, client_row)
    log_set(api, new_sid, exercise2.id, weight=80, reps=8)
    api.post(f"/sessions/{new_sid}/complete")

    body = client_api.get("/client-portal/strength-summary").json()
    assert body["exercise_id"] == exercise2.id  # most recently logged wins
    assert [o["exercise_id"] for o in body["exercise_options"]] == [exercise2.id, exercise.id]

    # Explicit selection overrides the default.
    picked = client_api.get(f"/client-portal/strength-summary?exercise_id={exercise.id}").json()
    assert picked["exercise_id"] == exercise.id


def test_strength_summary_empty_when_no_history(client_api):
    body = client_api.get("/client-portal/strength-summary").json()
    assert body["exercise_id"] is None
    assert body["points"] == []
    assert body["exercise_options"] == []
    assert body["delta_value"] is None


# ------------------------------------------------------------- chart integrity


def test_progress_chart_matches_stored_est_1rm(client_api, api, db, client_row, exercise):
    sid = start_session(api, client_row)
    logged = log_set(api, sid, exercise.id, weight=100, reps=10)
    api.post(f"/sessions/{sid}/complete")

    stored = float(db.query(SetEntry).filter(SetEntry.id == logged["id"]).one().est_1rm)
    res = client_api.get(f"/client-portal/progress/strength?exercise_id={exercise.id}")
    assert res.status_code == 200, res.text
    points = res.json()["points"]
    assert len(points) == 1
    assert points[0]["value"] == pytest.approx(round(stored, 1))
    assert points[0]["is_pr"] is True  # first-ever set was a PR that day


def test_progress_default_exercise_is_most_recently_logged(client_api, api, db, client_row, exercise, exercise2):
    old_sid = start_session(api, client_row)
    log_set(api, old_sid, exercise.id, weight=200, reps=5)  # more PRs live here
    api.post(f"/sessions/{old_sid}/complete")
    backdate_session(db, old_sid, days_ago=10)

    new_sid = start_session(api, client_row)
    log_set(api, new_sid, exercise2.id, weight=80, reps=8)
    api.post(f"/sessions/{new_sid}/complete")

    body = client_api.get("/client-portal/progress").json()
    assert body["default_exercise_id"] == exercise2.id
