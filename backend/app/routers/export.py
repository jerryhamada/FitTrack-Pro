from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import get_current_trainer
from ..database import get_db
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.roster import Client
from ..models.sessions import SetEntry, WorkoutSession

router = APIRouter(tags=["export"])

# Phase 1 lightweight first pass per spec T11 -- a real shareable PDF and richer CSV
# layout (plus persisted export history) is Phase 3 scope.


def _client_or_404(db: Session, trainer_id: int, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/clients/{client_id}/export/csv")
def export_csv(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    client = _client_or_404(db, trainer.id, client_id)

    rows = (
        db.query(WorkoutSession.started_at, Exercise.name, SetEntry)
        .join(SetEntry, SetEntry.session_id == WorkoutSession.id)
        .join(Exercise, SetEntry.exercise_id == Exercise.id)
        .filter(WorkoutSession.client_id == client_id)
        .order_by(WorkoutSession.started_at)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["date", "exercise", "set_number", "weight", "unit", "reps", "modifier", "status", "is_pr"])
    for started_at, exercise_name, s in rows:
        writer.writerow(
            [
                started_at.date().isoformat(),
                exercise_name,
                s.set_number,
                s.weight,
                s.weight_unit.value if s.weight_unit else "",
                s.reps,
                s.set_modifier or "",
                s.status.value,
                s.is_pr,
            ]
        )
    buffer.seek(0)
    filename = f"{client.name.replace(' ', '_')}_sessions.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/clients/{client_id}/export/pdf")
def export_pdf(client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    _client_or_404(db, trainer.id, client_id)
    # TODO(Phase 3): real PDF generation (reportlab/weasyprint) with charts and branding.
    raise HTTPException(status_code=501, detail="PDF export lands in Phase 3 -- CSV export is available now.")
