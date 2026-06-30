from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.exercises import Exercise, ExerciseFavorite
from ..models.identity import User
from ..schemas.exercises import ExerciseCreate, ExerciseOut, ExerciseUpdate

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    category: str | None = None,
    favorites_only: bool = False,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    query = db.query(Exercise).filter(or_(Exercise.trainer_id.is_(None), Exercise.trainer_id == trainer.id))
    if category:
        query = query.filter(Exercise.category == category)
    exercises = query.order_by(Exercise.category, Exercise.subcategory, Exercise.name).all()

    favorite_ids = {
        f.exercise_id for f in db.query(ExerciseFavorite).filter(ExerciseFavorite.trainer_id == trainer.id).all()
    }

    out = [
        ExerciseOut(
            **{
                "id": e.id,
                "name": e.name,
                "category": e.category,
                "subcategory": e.subcategory,
                "notes": e.notes,
                "is_custom": e.trainer_id is not None,
                "is_favorite": e.id in favorite_ids,
            }
        )
        for e in exercises
    ]
    if favorites_only:
        out = [e for e in out if e.is_favorite]
    return out


@router.post("", response_model=ExerciseOut, status_code=201)
def create_exercise(
    body: ExerciseCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    exercise = Exercise(trainer_id=trainer.id, **body.model_dump())
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return ExerciseOut(
        id=exercise.id,
        name=exercise.name,
        category=exercise.category,
        subcategory=exercise.subcategory,
        notes=exercise.notes,
        is_custom=True,
        is_favorite=False,
    )


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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(exercise, field, value)
    db.commit()
    db.refresh(exercise)
    return ExerciseOut(
        id=exercise.id,
        name=exercise.name,
        category=exercise.category,
        subcategory=exercise.subcategory,
        notes=exercise.notes,
        is_custom=True,
        is_favorite=False,
    )


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
