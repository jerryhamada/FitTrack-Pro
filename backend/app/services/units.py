from __future__ import annotations

from ..models.enums import DistanceUnitEnum, UnitEnum

LBS_PER_KG = 2.2046226218
INCHES_PER_CM = 0.3937007874


def to_lbs(value: float, unit: UnitEnum) -> float:
    value = float(value)
    return value if unit == UnitEnum.lbs else value * LBS_PER_KG


def from_lbs(value: float, unit: UnitEnum) -> float:
    value = float(value)
    return value if unit == UnitEnum.lbs else value / LBS_PER_KG


def to_inches(value: float, unit: DistanceUnitEnum) -> float:
    value = float(value)
    return value if unit == DistanceUnitEnum.inches else value * INCHES_PER_CM


def from_inches(value: float, unit: DistanceUnitEnum) -> float:
    value = float(value)
    return value if unit == DistanceUnitEnum.inches else value / INCHES_PER_CM


def total_load(weight: float | None, is_per_side: bool) -> float:
    """Total load lifted for a set, accounting for the per-dumbbell/per-side toggle."""
    if weight is None:
        return 0.0
    weight = float(weight)
    return weight * 2 if is_per_side else weight
