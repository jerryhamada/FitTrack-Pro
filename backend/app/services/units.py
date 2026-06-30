from __future__ import annotations

from ..models.enums import UnitEnum

LBS_PER_KG = 2.2046226218


def to_lbs(value: float, unit: UnitEnum) -> float:
    value = float(value)
    return value if unit == UnitEnum.lbs else value * LBS_PER_KG


def from_lbs(value: float, unit: UnitEnum) -> float:
    value = float(value)
    return value if unit == UnitEnum.lbs else value / LBS_PER_KG


def total_load(weight: float | None, is_per_side: bool) -> float:
    """Total load lifted for a set, accounting for the per-dumbbell/per-side toggle."""
    if weight is None:
        return 0.0
    weight = float(weight)
    return weight * 2 if is_per_side else weight
