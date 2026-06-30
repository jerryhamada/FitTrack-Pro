from __future__ import annotations

from ..models.enums import SetStatusEnum, UnitEnum
from ..models.sessions import SetEntry
from .units import from_lbs, to_lbs, total_load


def set_volume_lbs(s: SetEntry) -> float:
    """weight x reps for a single set, normalized to lbs. Skipped/zero-weight sets contribute 0."""
    if s.status == SetStatusEnum.skipped or s.weight is None or not s.reps:
        return 0.0
    load = to_lbs(total_load(s.weight, s.is_per_side), s.weight_unit or UnitEnum.lbs)
    return load * s.reps


def session_total_volume(sets: list[SetEntry], display_unit: UnitEnum) -> float:
    total_lbs = sum(set_volume_lbs(s) for s in sets)
    return from_lbs(total_lbs, display_unit)
