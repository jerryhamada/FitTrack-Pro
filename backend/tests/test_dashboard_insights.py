from __future__ import annotations


def _completed(api, client_id, exercise_id, sets):
    sid = api.post("/sessions", json={"client_id": client_id}).json()["id"]
    for weight, reps in sets:
        api.post(f"/sessions/{sid}/sets", json={"exercise_id": exercise_id, "weight": weight, "weight_unit": "lbs", "reps": reps})
    api.post(f"/sessions/{sid}/complete")
    return sid


def test_dashboard_stats(api, client_row, exercise):
    _completed(api, client_row.id, exercise.id, [(135, 5)])
    d = api.get("/dashboard/stats").json()
    assert d["active_clients"] == 1
    assert d["workouts_today"] == 1
    assert d["workouts_all_time"] == 1
    assert d["prs_last_7_days"] >= 1
    assert "upcoming_sessions" in d  # scheduling field wired into stats


def test_dashboard_recent_prs(api, client_row, exercise):
    _completed(api, client_row.id, exercise.id, [(135, 5)])
    prs = api.get("/dashboard/recent-prs").json()
    assert len(prs) >= 1
    assert prs[0]["client_name"] == "Test Client"
    assert prs[0]["exercise_name"] == "Bench Press"


def test_client_overview_stats(api, client_row, exercise):
    _completed(api, client_row.id, exercise.id, [(135, 5)])
    o = api.get(f"/clients/{client_row.id}/overview-stats").json()
    assert o["lifetime_workouts"] == 1
    assert o["lifetime_prs"] >= 1
    assert o["current_streak_weeks"] >= 1


def test_client_pr_summary(api, client_row, exercise):
    _completed(api, client_row.id, exercise.id, [(135, 5), (185, 3)])
    s = api.get(f"/clients/{client_row.id}/pr-summary").json()
    assert s["lifetime_pr_count"] >= 1
    bench = next(e for e in s["exercises"] if e["exercise_name"] == "Bench Press")
    assert bench["best_weight"] == 185.0


def test_exercise_insights_last3(api, client_row, exercise):
    _completed(api, client_row.id, exercise.id, [(135, 8)])
    ins = api.get(f"/clients/{client_row.id}/exercise-insights").json()
    entry = next(e for e in ins["exercises"] if e["exercise_id"] == exercise.id)
    assert entry["sessions_used"] == 1
    assert len(entry["last3_best"]) == 1
    assert entry["last3_best"][0]["reps"] == 8
