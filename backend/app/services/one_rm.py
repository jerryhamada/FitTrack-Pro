from __future__ import annotations


def estimated_1rm(weight: float, reps: int) -> float:
    """Epley formula: 1RM = weight * (1 + reps / 30).

    Chosen over Brzycki as the more common default and more forgiving at higher
    rep counts. See plan notes for rationale.
    """
    if reps <= 0:
        return weight
    return weight * (1 + reps / 30)


def set_e1rm_lbs(s) -> float | None:
    """A set row's est_1rm normalized to lbs for cross-set comparison/charting.
    Prefers the stored sets.est_1rm column (the write-time source of truth);
    falls back to computing it for rows that predate the column."""
    from ..models.enums import UnitEnum
    from .units import to_lbs

    value = s.est_1rm if s.est_1rm is not None else set_est_1rm(s.weight, s.reps)
    if value is None:
        return None
    return to_lbs(value, s.weight_unit or UnitEnum.lbs)


def set_est_1rm(weight: float | None, reps: int | None) -> float | None:
    """The single source of truth for a set's stored est_1rm (sets.est_1rm).

    Uses the weight as logged — for per-side dumbbell sets that's the PER-HAND
    weight, deliberately NOT doubled (a 15 lb-per-hand x10 set estimates to 20,
    not 40). Returned in the same unit as the input weight. Null when the set
    has no weight or no reps (nothing meaningful to estimate).
    """
    if weight is None or reps is None or reps <= 0:
        return None
    return estimated_1rm(float(weight), reps)
