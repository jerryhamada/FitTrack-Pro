import pytest

from app.models.enums import PrTypeEnum, SetStatusEnum, UnitEnum
from app.models.exercises import Exercise
from app.models.sessions import SetEntry, WorkoutSession
from app.services.pr_detection import detect_and_record_prs


@pytest.fixture()
def exercise_row(db):
    e = Exercise(trainer_id=None, name="Test Squat", category="Lower Body", subcategory="Squat pattern")
    db.add(e)
    db.flush()
    return e


@pytest.fixture()
def session_row(db, client_row, trainer):
    s = WorkoutSession(client_id=client_row.id, logged_by_user_id=trainer.id, label="Test Session")
    db.add(s)
    db.flush()
    return s


def log_set(db, session_row, exercise_row, **kwargs):
    defaults = dict(
        session_id=session_row.id,
        exercise_id=exercise_row.id,
        order_index=0,
        set_number=1,
        status=SetStatusEnum.completed,
        is_per_side=False,
        weight_unit=UnitEnum.lbs,
    )
    defaults.update(kwargs)
    s = SetEntry(**defaults)
    db.add(s)
    db.flush()
    detect_and_record_prs(db, session_row.client_id, s)
    return s


def test_first_set_is_always_pr(db, session_row, exercise_row):
    s = log_set(db, session_row, exercise_row, weight=100, reps=10)
    assert s.is_pr is True
    assert s.pr_type == PrTypeEnum.estimated_1rm


def test_lighter_set_after_heavier_is_not_pr(db, session_row, exercise_row):
    log_set(db, session_row, exercise_row, weight=200, reps=10)
    lighter = log_set(db, session_row, exercise_row, weight=100, reps=10)
    assert lighter.is_pr is False
    assert lighter.pr_type is None


def test_heavier_set_after_lighter_is_pr(db, session_row, exercise_row):
    log_set(db, session_row, exercise_row, weight=100, reps=10)
    heavier = log_set(db, session_row, exercise_row, weight=150, reps=10)
    assert heavier.is_pr is True


def test_mixed_units_kg_beats_lbs(db, session_row, exercise_row):
    # 95 lbs ~= 43kg; a 50kg set (~110lbs) at the same rep count should PR.
    log_set(db, session_row, exercise_row, weight=95, weight_unit=UnitEnum.lbs, reps=10)
    kg_set = log_set(db, session_row, exercise_row, weight=50, weight_unit=UnitEnum.kg, reps=10)
    assert kg_set.is_pr is True


def test_mixed_units_lighter_kg_is_not_pr(db, session_row, exercise_row):
    # 110 lbs is heavier than a 40kg (~88lbs) set at the same rep count.
    log_set(db, session_row, exercise_row, weight=110, weight_unit=UnitEnum.lbs, reps=10)
    kg_set = log_set(db, session_row, exercise_row, weight=40, weight_unit=UnitEnum.kg, reps=10)
    assert kg_set.is_pr is False


def test_per_side_load_doubles(db, session_row, exercise_row):
    # 15s x10 (per-side, total 30) should beat a flat 25 x10 single dumbbell entry.
    log_set(db, session_row, exercise_row, weight=25, is_per_side=False, reps=10)
    per_side = log_set(db, session_row, exercise_row, weight=15, is_per_side=True, reps=10)
    assert per_side.is_pr is True


def test_identical_load_and_reps_is_not_a_new_pr(db, session_row, exercise_row):
    log_set(db, session_row, exercise_row, weight=100, reps=10)
    duplicate = log_set(db, session_row, exercise_row, weight=100, reps=10)
    assert duplicate.is_pr is False, "an exact repeat of a prior best should not register as a new PR"


def test_bodyweight_set_never_prs(db, session_row, exercise_row):
    s = log_set(db, session_row, exercise_row, weight=None, reps=12)
    assert s.is_pr is False
    assert s.pr_type is None


def test_skipped_set_never_prs(db, session_row, exercise_row):
    s = log_set(db, session_row, exercise_row, weight=999, reps=1, status=SetStatusEnum.skipped)
    assert s.is_pr is False


def test_set_with_no_reps_never_prs(db, session_row, exercise_row):
    s = log_set(db, session_row, exercise_row, weight=100, reps=None)
    assert s.is_pr is False


def test_new_rep_count_is_a_weight_at_reps_pr_even_if_lighter(db, session_row, exercise_row):
    log_set(db, session_row, exercise_row, weight=200, reps=5)
    new_rep_range = log_set(db, session_row, exercise_row, weight=100, reps=20)
    # Never logged 20 reps before -- it's a weight-at-reps PR even though it's lighter
    # in absolute terms than the 5-rep set.
    assert new_rep_range.is_pr is True
    assert new_rep_range.pr_type is not None


def test_different_exercise_does_not_affect_pr_history(db, session_row, exercise_row):
    other = Exercise(trainer_id=None, name="Other Lift", category="Lower Body", subcategory="Squat pattern")
    db.add(other)
    db.flush()

    log_set(db, session_row, exercise_row, weight=300, reps=5)
    unrelated = log_set(db, session_row, other, weight=20, reps=5)
    assert unrelated.is_pr is True, "a different exercise's history should not block a first-time PR"
