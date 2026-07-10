"""Per-exercise measurement type (weight / height / band color): the settings
endpoint, per-trainer overrides for built-ins, and band-color set logging."""

from __future__ import annotations

from app.models.enums import RoleEnum
from app.models.exercises import Exercise, ExerciseSetting
from app.models.identity import User


class TestSetMeasurement:
    def test_defaults_to_weight(self, api, exercise):
        listed = api.get("/exercises").json()
        me = next(e for e in listed if e["id"] == exercise.id)
        assert me["measurement_type"] == "weight"
        assert me["tracks_height"] is False

    def test_builtin_gets_trainer_override_not_row_edit(self, api, db, trainer, exercise):
        res = api.put(f"/exercises/{exercise.id}/measurement", json={"measurement_type": "band"})
        assert res.status_code == 200, res.text
        assert res.json()["measurement_type"] == "band"

        # The shared global row is untouched — only this trainer sees band.
        db.refresh(exercise)
        assert exercise.measurement_type == "weight"
        override = (
            db.query(ExerciseSetting)
            .filter(ExerciseSetting.trainer_id == trainer.id, ExerciseSetting.exercise_id == exercise.id)
            .one()
        )
        assert override.measurement_type == "band"

        # And the list endpoint resolves it.
        listed = api.get("/exercises").json()
        assert next(e for e in listed if e["id"] == exercise.id)["measurement_type"] == "band"

    def test_override_updates_in_place(self, api, db, trainer, exercise):
        api.put(f"/exercises/{exercise.id}/measurement", json={"measurement_type": "band"})
        api.put(f"/exercises/{exercise.id}/measurement", json={"measurement_type": "height"})
        rows = (
            db.query(ExerciseSetting)
            .filter(ExerciseSetting.trainer_id == trainer.id, ExerciseSetting.exercise_id == exercise.id)
            .all()
        )
        assert len(rows) == 1 and rows[0].measurement_type == "height"

    def test_custom_exercise_edited_directly(self, api, db, trainer):
        created = api.post(
            "/exercises", json={"name": "Band Pull-Apart", "category": "Upper Body — Compound Pull"}
        ).json()
        res = api.put(f"/exercises/{created['id']}/measurement", json={"measurement_type": "band"})
        assert res.status_code == 200
        row = db.query(Exercise).filter(Exercise.id == created["id"]).one()
        assert row.measurement_type == "band"
        assert db.query(ExerciseSetting).count() == 0  # no override row for own exercises

    def test_height_syncs_legacy_flag(self, api, db):
        created = api.post(
            "/exercises",
            json={"name": "Box Jump 2", "category": "Lower Body", "measurement_type": "height"},
        ).json()
        assert created["tracks_height"] is True
        row = db.query(Exercise).filter(Exercise.id == created["id"]).one()
        assert row.tracks_height is True

    def test_invalid_type_422(self, api, exercise):
        assert (
            api.put(f"/exercises/{exercise.id}/measurement", json={"measurement_type": "rope"}).status_code
            == 422
        )

    def test_other_trainers_custom_404(self, api, db):
        other = User(clerk_user_id="other_tr", role=RoleEnum.trainer, name="Other Trainer")
        db.add(other)
        db.flush()
        foreign = Exercise(trainer_id=other.id, name="Private Move", category="Core")
        db.add(foreign)
        db.flush()
        assert (
            api.put(f"/exercises/{foreign.id}/measurement", json={"measurement_type": "band"}).status_code
            == 404
        )


class TestBandSets:
    def _start_session(self, api, client_row) -> int:
        res = api.post("/sessions", json={"client_id": client_row.id})
        assert res.status_code == 201, res.text
        return res.json()["id"]

    def test_log_band_set(self, api, client_row, exercise):
        session_id = self._start_session(api, client_row)
        res = api.post(
            f"/sessions/{session_id}/sets",
            json={"exercise_id": exercise.id, "band_color": "red", "reps": 12},
        )
        assert res.status_code == 201, res.text
        body = res.json()
        assert body["band_color"] == "red"
        assert body["weight"] is None
        # Band sets never PR or produce an estimated 1RM.
        assert body["est_1rm"] is None
        assert body["is_pr"] is False

    def test_band_set_in_client_history_detail(self, api, client_api, client_row, exercise):
        session_id = self._start_session(api, client_row)
        api.post(
            f"/sessions/{session_id}/sets",
            json={"exercise_id": exercise.id, "band_color": "green", "reps": 15},
        )
        assert api.post(f"/sessions/{session_id}/complete").status_code == 200
        detail = client_api.get(f"/client-portal/workouts/{session_id}").json()
        sets = detail["exercises"][0]["sets"]
        assert sets[0]["band_color"] == "green"
