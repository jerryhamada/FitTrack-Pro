from app.models.enums import UnitEnum
from app.services.units import LBS_PER_KG, from_lbs, to_lbs, total_load


def test_to_lbs_noop_for_lbs():
    assert to_lbs(100, UnitEnum.lbs) == 100


def test_to_lbs_converts_kg():
    assert to_lbs(10, UnitEnum.kg) == 10 * LBS_PER_KG


def test_round_trip_conversion():
    original = 47.5
    converted = from_lbs(to_lbs(original, UnitEnum.kg), UnitEnum.kg)
    assert abs(converted - original) < 1e-9


def test_total_load_per_side_doubles():
    assert total_load(15, is_per_side=True) == 30


def test_total_load_not_per_side_unchanged():
    assert total_load(25, is_per_side=False) == 25


def test_total_load_none_weight_is_zero():
    assert total_load(None, is_per_side=True) == 0.0


def test_total_load_accepts_decimal_from_db():
    from decimal import Decimal

    assert total_load(Decimal("12.5"), is_per_side=True) == 25.0
