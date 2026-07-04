from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app import models  # noqa: F401 -- registers all model tables on Base.metadata
from app.auth import get_current_trainer
from app.models.enums import RoleEnum, UnitEnum
from app.models.exercises import Exercise
from app.models.identity import TrainerProfile, User
from app.models.roster import Client

TEST_DATABASE_URL = "postgresql://jerryhamada@localhost:5432/fittrack_pro_test"


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    """Each test runs inside its own transaction that's rolled back afterward, so
    tests stay isolated and fast without recreating the schema every time.

    join_transaction_mode="create_savepoint" lets endpoint code call db.commit()
    freely (each commit only releases a savepoint) while the outer transaction
    rollback still undoes everything at teardown."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def trainer(db) -> User:
    t = User(clerk_user_id="test_trainer", role=RoleEnum.trainer, email="trainer@test.com", name="Test Trainer")
    db.add(t)
    db.flush()
    db.add(TrainerProfile(user_id=t.id))
    db.flush()
    return t


@pytest.fixture()
def client_row(db, trainer) -> Client:
    c = Client(trainer_id=trainer.id, name="Test Client", email="client@test.com", preferred_unit=UnitEnum.lbs)
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def exercise(db) -> Exercise:
    e = Exercise(name="Bench Press", category="Upper Body — Compound Push", muscle_group="chest")
    db.add(e)
    db.flush()
    return e


@pytest.fixture()
def exercise2(db) -> Exercise:
    e = Exercise(name="Barbell Row", category="Upper Body — Compound Pull", muscle_group="back")
    db.add(e)
    db.flush()
    return e


@pytest.fixture()
def api(db, trainer):
    """FastAPI TestClient with get_db and the trainer auth dependency overridden to
    the test session/trainer — no Clerk JWT or dev bypass involved."""
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_trainer] = lambda: trainer
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def client_api(db, trainer, client_row):
    """TestClient scoped as the given client (get_current_client overridden)."""
    from app.main import app
    from app.routers.client_portal import get_current_client

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_trainer] = lambda: trainer
    app.dependency_overrides[get_current_client] = lambda: client_row
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
