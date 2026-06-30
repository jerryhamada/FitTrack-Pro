from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app import models  # noqa: F401 -- registers all model tables on Base.metadata
from app.models.enums import RoleEnum, UnitEnum
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
    tests stay isolated and fast without recreating the schema every time."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
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
