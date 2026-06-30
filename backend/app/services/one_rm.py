from __future__ import annotations


def estimated_1rm(weight: float, reps: int) -> float:
    """Epley formula: 1RM = weight * (1 + reps / 30).

    Chosen over Brzycki as the more common default and more forgiving at higher
    rep counts. See plan notes for rationale.
    """
    if reps <= 0:
        return weight
    return weight * (1 + reps / 30)
