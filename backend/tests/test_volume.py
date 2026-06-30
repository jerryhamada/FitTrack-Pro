from app.models.enums import SetStatusEnum, UnitEnum
from app.models.sessions import SetEntry
from app.services.volume import session_total_volume, set_volume_lbs


def make_set(**kwargs) -> SetEntry:
    defaults = dict(status=SetStatusEnum.completed, is_per_side=False, weight_unit=UnitEnum.lbs)
    defaults.update(kwargs)
    return SetEntry(**defaults)


def test_set_volume_basic():
    s = make_set(weight=100, reps=10)
    assert set_volume_lbs(s) == 1000


def test_set_volume_skipped_is_zero():
    s = make_set(weight=100, reps=10, status=SetStatusEnum.skipped)
    assert set_volume_lbs(s) == 0.0


def test_set_volume_bodyweight_is_zero():
    s = make_set(weight=None, reps=12)
    assert set_volume_lbs(s) == 0.0


def test_set_volume_no_reps_is_zero():
    s = make_set(weight=100, reps=None)
    assert set_volume_lbs(s) == 0.0


def test_set_volume_per_side_doubles_load():
    s = make_set(weight=15, reps=10, is_per_side=True)
    assert set_volume_lbs(s) == 300  # (15*2) * 10


def test_set_volume_converts_kg_to_lbs():
    s = make_set(weight=10, weight_unit=UnitEnum.kg, reps=10)
    assert abs(set_volume_lbs(s) - 220.46226218) < 1e-6


def test_session_total_volume_sums_and_converts_display_unit():
    sets = [make_set(weight=100, reps=10), make_set(weight=50, reps=10, status=SetStatusEnum.skipped)]
    total_lbs = session_total_volume(sets, UnitEnum.lbs)
    assert total_lbs == 1000  # skipped set contributes 0

    total_kg = session_total_volume(sets, UnitEnum.kg)
    assert abs(total_kg - 1000 / 2.2046226218) < 1e-6
