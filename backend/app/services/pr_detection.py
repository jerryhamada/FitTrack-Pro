from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.enums import DistanceUnitEnum, PrTypeEnum, SetStatusEnum, UnitEnum
from ..models.prs import PR
from ..models.sessions import SetEntry, WorkoutSession
from .one_rm import set_e1rm_lbs as _e1rm_lbs
from .one_rm import set_est_1rm
from .units import to_inches, to_lbs


def detect_and_record_prs(db: Session, client_id: int, new_set: SetEntry) -> list[PR]:
    """Check a just-logged set against the client's history for this exercise and
    record any PRs hit. Mutates new_set.is_pr / new_set.pr_type in place.

    Two PR types, per the spec: best weight at a given rep count, or best
    estimated 1RM (Epley). A set with no weight (bodyweight/banded) can't PR
    against either metric and is skipped.

    Weight comparisons use the weight AS LOGGED — per-hand for per-side dumbbell
    sets, NOT doubled — matching the stored est_1rm / PR value and how the set is
    displayed ("15 lb ea. × 10"). Volume math still doubles; that's a different
    concept (services/units.total_load).

    Height-tracked exercises (box jumps, box-assisted push-ups) get a separate,
    simpler check: best height at a given rep count, with the "best" direction
    flipped when the exercise is marked invert_difficulty (less assistance is
    the improvement, not more height).
    """
    if new_set.status != SetStatusEnum.completed or not new_set.reps:
        return []

    if new_set.height is not None:
        return _detect_height_pr(db, client_id, new_set)

    if new_set.weight is None:
        return []

    new_load_lbs = to_lbs(new_set.weight, new_set.weight_unit or UnitEnum.lbs)
    prs: list[PR] = []

    prior_sets = (
        db.query(SetEntry)
        .join(WorkoutSession, SetEntry.session_id == WorkoutSession.id)
        .filter(
            WorkoutSession.client_id == client_id,
            SetEntry.exercise_id == new_set.exercise_id,
            SetEntry.status == SetStatusEnum.completed,
            SetEntry.weight.isnot(None),
            SetEntry.id != new_set.id,
        )
        .all()
    )

    # Weight-at-reps PR: heaviest weight-as-logged ever at this exact rep count.
    same_rep_loads = [
        to_lbs(s.weight, s.weight_unit or UnitEnum.lbs)
        for s in prior_sets
        if s.reps == new_set.reps
    ]
    best_same_rep = max(same_rep_loads, default=None)
    is_weight_pr = best_same_rep is None or new_load_lbs > best_same_rep

    # Estimated 1RM PR: highest stored est_1rm ever for this exercise.
    prior_1rms = [v for v in (_e1rm_lbs(s) for s in prior_sets) if v is not None]
    new_1rm_lbs = _e1rm_lbs(new_set)
    best_prior_1rm = max(prior_1rms, default=None)
    is_1rm_pr = new_1rm_lbs is not None and (best_prior_1rm is None or new_1rm_lbs > best_prior_1rm)

    now = datetime.now(timezone.utc)
    unit = new_set.weight_unit or UnitEnum.lbs

    if is_weight_pr:
        prs.append(
            PR(
                client_id=client_id,
                exercise_id=new_set.exercise_id,
                set_id=new_set.id,
                pr_type=PrTypeEnum.weight_at_reps,
                reps=new_set.reps,
                value=new_set.weight,
                unit=unit,
                achieved_at=now,
            )
        )
    if is_1rm_pr:
        prs.append(
            PR(
                client_id=client_id,
                exercise_id=new_set.exercise_id,
                set_id=new_set.id,
                pr_type=PrTypeEnum.estimated_1rm,
                reps=new_set.reps,
                # Native-unit estimate (matches `unit` below) — fixes the old
                # behavior of storing an lbs-derived number against a kg unit.
                value=new_set.est_1rm if new_set.est_1rm is not None else set_est_1rm(new_set.weight, new_set.reps),
                unit=unit,
                achieved_at=now,
            )
        )

    if prs:
        new_set.is_pr = True
        # Prefer 1RM as the headline PR type shown on the set itself when both qualify.
        new_set.pr_type = PrTypeEnum.estimated_1rm if is_1rm_pr else PrTypeEnum.weight_at_reps
        db.add_all(prs)

    return prs


def _detect_height_pr(db: Session, client_id: int, new_set: SetEntry) -> list[PR]:
    invert = new_set.exercise.invert_difficulty
    new_height_in = to_inches(new_set.height, new_set.height_unit or DistanceUnitEnum.inches)

    prior_sets = (
        db.query(SetEntry)
        .join(WorkoutSession, SetEntry.session_id == WorkoutSession.id)
        .filter(
            WorkoutSession.client_id == client_id,
            SetEntry.exercise_id == new_set.exercise_id,
            SetEntry.status == SetStatusEnum.completed,
            SetEntry.height.isnot(None),
            SetEntry.id != new_set.id,
            SetEntry.reps == new_set.reps,
        )
        .all()
    )
    prior_heights_in = [to_inches(s.height, s.height_unit or DistanceUnitEnum.inches) for s in prior_sets]

    if not prior_heights_in:
        is_pr = True
    elif invert:
        is_pr = new_height_in < min(prior_heights_in)
    else:
        is_pr = new_height_in > max(prior_heights_in)

    if not is_pr:
        return []

    pr = PR(
        client_id=client_id,
        exercise_id=new_set.exercise_id,
        set_id=new_set.id,
        pr_type=PrTypeEnum.height_at_reps,
        reps=new_set.reps,
        value=new_set.height,
        distance_unit=new_set.height_unit or DistanceUnitEnum.inches,
        achieved_at=datetime.now(timezone.utc),
    )
    new_set.is_pr = True
    new_set.pr_type = PrTypeEnum.height_at_reps
    db.add(pr)
    return [pr]
