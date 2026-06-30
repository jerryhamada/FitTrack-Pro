from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_trainer
from ..database import get_db
from ..models.exercises import Exercise
from ..models.identity import User
from ..models.programs import (
    ClientProgram,
    ClientProgramDay,
    ClientProgramExercise,
    Program,
    ProgramDay,
    ProgramExercise,
)
from ..models.roster import Client
from ..schemas.programs import (
    ClientProgramDayUpdate,
    ClientProgramOut,
    ClientProgramUpdate,
    ProgramAssignRequest,
    ProgramCreate,
    ProgramOut,
    ProgramSummaryOut,
)

router = APIRouter(tags=["programs"])


def _exercise_name_map(db: Session, exercise_ids: set[int]) -> dict[int, str]:
    if not exercise_ids:
        return {}
    rows = db.query(Exercise.id, Exercise.name).filter(Exercise.id.in_(exercise_ids)).all()
    return {r.id: r.name for r in rows}


def _program_out(db: Session, program: Program) -> ProgramOut:
    out = ProgramOut.model_validate(program)
    ex_ids = {pe.exercise_id for d in program.days for pe in d.exercises}
    names = _exercise_name_map(db, ex_ids)
    for day_out, day in zip(out.days, program.days):
        for pe_out, pe in zip(day_out.exercises, day.exercises):
            pe_out.exercise_name = names.get(pe.exercise_id, "")
    return out


def _client_program_out(db: Session, cp: ClientProgram) -> ClientProgramOut:
    out = ClientProgramOut.model_validate(cp)
    ex_ids = {pe.exercise_id for d in cp.days for pe in d.exercises}
    names = _exercise_name_map(db, ex_ids)
    for day_out, day in zip(out.days, cp.days):
        for pe_out, pe in zip(day_out.exercises, day.exercises):
            pe_out.exercise_name = names.get(pe.exercise_id, "")
    return out


@router.get("/programs", response_model=list[ProgramSummaryOut])
def list_programs(trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)):
    programs = (
        db.query(Program, func.count(ProgramDay.id).label("day_count"))
        .outerjoin(ProgramDay, ProgramDay.program_id == Program.id)
        .filter(Program.trainer_id == trainer.id)
        .group_by(Program.id)
        .order_by(Program.created_at.desc())
        .all()
    )
    return [
        ProgramSummaryOut(
            id=p.id, name=p.name, description=p.description, day_count=count, created_at=p.created_at
        )
        for p, count in programs
    ]


@router.post("/programs", response_model=ProgramOut, status_code=201)
def create_program(
    body: ProgramCreate, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    program = Program(trainer_id=trainer.id, name=body.name, description=body.description)
    for day_in in body.days:
        day = ProgramDay(label=day_in.label, order_index=day_in.order_index)
        for ex_in in day_in.exercises:
            day.exercises.append(ProgramExercise(**ex_in.model_dump()))
        program.days.append(day)
    db.add(program)
    db.commit()
    db.refresh(program)
    return _program_out(db, program)


def _get_program_or_404(db: Session, trainer_id: int, program_id: int) -> Program:
    program = (
        db.query(Program)
        .options(joinedload(Program.days).joinedload(ProgramDay.exercises))
        .filter(Program.id == program_id, Program.trainer_id == trainer_id)
        .first()
    )
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.get("/programs/{program_id}", response_model=ProgramOut)
def get_program(
    program_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    program = _get_program_or_404(db, trainer.id, program_id)
    return _program_out(db, program)


@router.put("/programs/{program_id}", response_model=ProgramOut)
def update_program(
    program_id: int,
    body: ProgramCreate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    program = _get_program_or_404(db, trainer.id, program_id)
    program.name = body.name
    program.description = body.description
    program.days.clear()
    db.flush()
    for day_in in body.days:
        day = ProgramDay(label=day_in.label, order_index=day_in.order_index)
        for ex_in in day_in.exercises:
            day.exercises.append(ProgramExercise(**ex_in.model_dump()))
        program.days.append(day)
    db.commit()
    db.refresh(program)
    return _program_out(db, program)


@router.delete("/programs/{program_id}", status_code=204)
def delete_program(
    program_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    program = _get_program_or_404(db, trainer.id, program_id)
    db.delete(program)
    db.commit()


@router.post("/programs/{program_id}/assign", response_model=ClientProgramOut, status_code=201)
def assign_program(
    program_id: int,
    body: ProgramAssignRequest,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    program = _get_program_or_404(db, trainer.id, program_id)
    client = db.query(Client).filter(Client.id == body.client_id, Client.trainer_id == trainer.id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")

    # Clone the template into client-owned rows so per-client edits never mutate the
    # shared template or other clients' copies (see plan's "program assignment" note).
    client_program = ClientProgram(
        client_id=client.id, source_program_id=program.id, name=program.name, start_date=body.start_date
    )
    for day in program.days:
        cp_day = ClientProgramDay(label=day.label, order_index=day.order_index)
        for pe in day.exercises:
            cp_day.exercises.append(
                ClientProgramExercise(
                    exercise_id=pe.exercise_id,
                    order_index=pe.order_index,
                    target_sets=pe.target_sets,
                    target_reps=pe.target_reps,
                    target_weight=pe.target_weight,
                    target_weight_unit=pe.target_weight_unit,
                    target_rpe=pe.target_rpe,
                    target_rest_seconds=pe.target_rest_seconds,
                    notes=pe.notes,
                )
            )
        client_program.days.append(cp_day)
    db.add(client_program)
    db.commit()
    db.refresh(client_program)
    return _client_program_out(db, client_program)


@router.get("/clients/{client_id}/programs", response_model=list[ClientProgramOut])
def list_client_programs(
    client_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.id == client_id, Client.trainer_id == trainer.id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    programs = (
        db.query(ClientProgram)
        .options(joinedload(ClientProgram.days).joinedload(ClientProgramDay.exercises))
        .filter(ClientProgram.client_id == client_id)
        .order_by(ClientProgram.assigned_at.desc())
        .all()
    )
    return [_client_program_out(db, cp) for cp in programs]


def _get_client_program_or_404(db: Session, trainer_id: int, client_program_id: int) -> ClientProgram:
    cp = (
        db.query(ClientProgram)
        .join(Client, ClientProgram.client_id == Client.id)
        .options(joinedload(ClientProgram.days).joinedload(ClientProgramDay.exercises))
        .filter(ClientProgram.id == client_program_id, Client.trainer_id == trainer_id)
        .first()
    )
    if cp is None:
        raise HTTPException(status_code=404, detail="Assigned program not found")
    return cp


@router.get("/client-programs/{client_program_id}", response_model=ClientProgramOut)
def get_client_program(
    client_program_id: int, trainer: User = Depends(get_current_trainer), db: Session = Depends(get_db)
):
    cp = _get_client_program_or_404(db, trainer.id, client_program_id)
    return _client_program_out(db, cp)


@router.put("/client-programs/{client_program_id}", response_model=ClientProgramOut)
def update_client_program(
    client_program_id: int,
    body: ClientProgramUpdate,
    trainer: User = Depends(get_current_trainer),
    db: Session = Depends(get_db),
):
    cp = _get_client_program_or_404(db, trainer.id, client_program_id)
    if body.name is not None:
        cp.name = body.name
    if body.active is not None:
        cp.active = body.active
    if body.days is not None:
        cp.days.clear()
        db.flush()
        for day_in in body.days:
            day = ClientProgramDay(
                label=day_in.label, order_index=day_in.order_index, day_of_week=day_in.day_of_week
            )
            for ex_in in day_in.exercises:
                day.exercises.append(ClientProgramExercise(**ex_in.model_dump()))
            cp.days.append(day)
    db.commit()
    db.refresh(cp)
    return _client_program_out(db, cp)
