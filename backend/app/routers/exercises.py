from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.exercises import Exercise, ExerciseFavorite, ExerciseSetting
from ..models.identity import User
from ..models.programs import ClientProgramExercise, ProgramExercise
from ..models.sessions import SetEntry
from ..schemas.exercises import ExerciseCreate, ExerciseOut, ExerciseUpdate, MeasurementUpdate

router = APIRouter(prefix="/exercises", tags=["exercises"])


def _to_out(e: Exercise, *, is_favorite: bool = False, measurement_override: str | None = None) -> ExerciseOut:
    # The trainer's per-exercise override (built-ins only) wins over the row's own
    # default. tracks_height is derived so old builds keep behaving consistently.
    measurement = measurement_override or e.measurement_type or ("height" if e.tracks_height else "weight")
    return ExerciseOut(
        id=e.id,
        name=e.name,
        category=e.category,
        subcategory=e.subcategory,
        muscle_group=e.muscle_group,
        secondary_muscles=e.secondary_muscles,
        equipment=e.equipment,
        exercise_type=e.exercise_type,
        demo_media_url=e.demo_media_url,
        images=e.images,
        level=e.level,
        instructions_steps=e.instructions_steps,
        measurement_type=measurement,
        tracks_height=measurement == "height",
        invert_difficulty=e.invert_difficulty,
        notes=e.notes,
        is_custom=e.trainer_id is not None,
        is_favorite=is_favorite,
    )


def _measurement_override(db: Session, trainer_id: int, exercise_id: int) -> str | None:
    row = (
        db.query(ExerciseSetting)
        .filter(ExerciseSetting.trainer_id == trainer_id, ExerciseSetting.exercise_id == exercise_id)
        .first()
    )
    return row.measurement_type if row else None


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    category: str | None = None,
    favorites_only: bool = False,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    query = db.query(Exercise).filter(
        or_(Exercise.trainer_id.is_(None), Exercise.trainer_id == trainer.id),
        Exercise.archived.is_(False),
    )
    if category:
        query = query.filter(Exercise.category == category)
    exercises = query.order_by(Exercise.category, Exercise.subcategory, Exercise.name).all()

    favorite_ids = {
        f.exercise_id for f in db.query(ExerciseFavorite).filter(ExerciseFavorite.trainer_id == trainer.id).all()
    }
    overrides = {
        s.exercise_id: s.measurement_type
        for s in db.query(ExerciseSetting).filter(ExerciseSetting.trainer_id == trainer.id).all()
    }

    out = [
        _to_out(e, is_favorite=e.id in favorite_ids, measurement_override=overrides.get(e.id))
        for e in exercises
    ]
    if favorites_only:
        out = [e for e in out if e.is_favorite]
    return out


def _sync_measurement_fields(data: dict) -> dict:
    """Keep measurement_type and the legacy tracks_height flag coherent no matter
    which one the client sent (older builds only know tracks_height)."""
    if data.get("measurement_type") is not None:
        data["tracks_height"] = data["measurement_type"] == "height"
    elif data.get("tracks_height"):
        data["measurement_type"] = "height"
    return data


@router.post("", response_model=ExerciseOut, status_code=201)
def create_exercise(
    body: ExerciseCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    exercise = Exercise(trainer_id=trainer.id, **_sync_measurement_fields(body.model_dump()))
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return _to_out(exercise)


def _get_own_exercise_or_404(db: Session, trainer_id: int, exercise_id: int) -> Exercise:
    exercise = (
        db.query(Exercise).filter(Exercise.id == exercise_id, Exercise.trainer_id == trainer_id).first()
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Custom exercise not found")
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
    exercise_id: int,
    body: ExerciseUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    exercise = _get_own_exercise_or_404(db, trainer.id, exercise_id)
    for field, value in _sync_measurement_fields(body.model_dump(exclude_unset=True)).items():
        setattr(exercise, field, value)
    db.commit()
    db.refresh(exercise)
    is_favorite = (
        db.query(ExerciseFavorite)
        .filter(ExerciseFavorite.trainer_id == trainer.id, ExerciseFavorite.exercise_id == exercise.id)
        .first()
        is not None
    )
    return _to_out(exercise, is_favorite=is_favorite)


@router.put("/{exercise_id}/measurement", response_model=ExerciseOut)
def set_measurement(
    exercise_id: int,
    body: MeasurementUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    """Change how an exercise is measured (weight / height / band color) — usable
    mid-workout. Own custom exercises are edited directly; built-ins get a
    per-trainer override so other trainers are unaffected."""
    exercise = (
        db.query(Exercise).filter(Exercise.id == exercise_id, Exercise.archived.is_(False)).first()
    )
    if exercise is None or (exercise.trainer_id is not None and exercise.trainer_id != trainer.id):
        raise HTTPException(status_code=404, detail="Exercise not found")

    is_favorite = (
        db.query(ExerciseFavorite.id)
        .filter(ExerciseFavorite.trainer_id == trainer.id, ExerciseFavorite.exercise_id == exercise_id)
        .first()
        is not None
    )

    if exercise.trainer_id == trainer.id:
        exercise.measurement_type = body.measurement_type
        exercise.tracks_height = body.measurement_type == "height"
        db.commit()
        db.refresh(exercise)
        return _to_out(exercise, is_favorite=is_favorite)

    setting = (
        db.query(ExerciseSetting)
        .filter(ExerciseSetting.trainer_id == trainer.id, ExerciseSetting.exercise_id == exercise_id)
        .first()
    )
    if setting is None:
        db.add(ExerciseSetting(trainer_id=trainer.id, exercise_id=exercise_id, measurement_type=body.measurement_type))
    else:
        setting.measurement_type = body.measurement_type
    db.commit()
    return _to_out(exercise, is_favorite=is_favorite, measurement_override=body.measurement_type)


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    """Delete a custom exercise. If it's referenced by workout history or programs it is
    soft-deleted (archived: hidden from future selection, history stays intact)."""
    exercise = _get_own_exercise_or_404(db, trainer.id, exercise_id)
    referenced = (
        db.query(SetEntry.id).filter(SetEntry.exercise_id == exercise_id).first() is not None
        or db.query(ProgramExercise.id).filter(ProgramExercise.exercise_id == exercise_id).first() is not None
        or db.query(ClientProgramExercise.id).filter(ClientProgramExercise.exercise_id == exercise_id).first()
        is not None
    )
    if referenced:
        exercise.archived = True
    else:
        db.query(ExerciseFavorite).filter(ExerciseFavorite.exercise_id == exercise_id).delete()
        db.delete(exercise)
    db.commit()


@router.post("/{exercise_id}/favorite", status_code=204)
def favorite_exercise(
    exercise_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    exists = (
        db.query(ExerciseFavorite)
        .filter(ExerciseFavorite.trainer_id == trainer.id, ExerciseFavorite.exercise_id == exercise_id)
        .first()
    )
    if not exists:
        db.add(ExerciseFavorite(trainer_id=trainer.id, exercise_id=exercise_id))
        db.commit()


@router.delete("/{exercise_id}/favorite", status_code=204)
def unfavorite_exercise(
    exercise_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    db.query(ExerciseFavorite).filter(
        ExerciseFavorite.trainer_id == trainer.id, ExerciseFavorite.exercise_id == exercise_id
    ).delete()
    db.commit()
