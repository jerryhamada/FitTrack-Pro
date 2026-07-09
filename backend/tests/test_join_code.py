"""Trainer join codes: generate/rotate on the trainer side, join-by-code on the
client side."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth import get_clerk_payload, get_current_trainer
from app.database import get_db
from app.models.activity import ActivityEvent
from app.models.enums import ActivityEventTypeEnum, LinkRequestStatusEnum, RoleEnum
from app.models.identity import TrainerProfile, User
from app.models.roster import Client, TrainerLinkRequest
from app.routers.trainer import _JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH

SOLO_PAYLOAD = {"sub": "clerk_solo_client", "email": "solo@test.com", "name": "Solo Sam"}


@pytest.fixture()
def solo_api(db, trainer):
    """TestClient authenticated as a brand-new (unprovisioned) Clerk login."""
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_trainer] = lambda: trainer
    app.dependency_overrides[get_clerk_payload] = lambda: SOLO_PAYLOAD
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _register_solo_client(solo_api, db) -> Client:
    assert solo_api.post("/auth/register-client").status_code == 200
    user = db.query(User).filter(User.clerk_user_id == SOLO_PAYLOAD["sub"]).one()
    client = db.query(Client).filter(Client.user_id == user.id).one()

    from app.main import app
    from app.routers.client_portal import get_current_client

    app.dependency_overrides[get_current_client] = lambda: client
    return client


class TestGenerateJoinCode:
    def test_starts_null(self, api):
        assert api.get("/trainer/join-code").json() == {"code": None}

    def test_generate_and_read_back(self, api):
        code = api.post("/trainer/join-code").json()["code"]
        assert len(code) == JOIN_CODE_LENGTH
        assert all(ch in _JOIN_CODE_ALPHABET for ch in code)
        assert api.get("/trainer/join-code").json() == {"code": code}

    def test_regenerate_rotates(self, api, db, trainer):
        old = api.post("/trainer/join-code").json()["code"]
        new = api.post("/trainer/join-code").json()["code"]
        assert new != old
        profile = db.query(TrainerProfile).filter(TrainerProfile.user_id == trainer.id).one()
        assert profile.join_code == new


class TestJoinByCode:
    def _code(self, solo_api, db, trainer) -> str:
        profile = db.query(TrainerProfile).filter(TrainerProfile.user_id == trainer.id).one()
        profile.join_code = "ABC234"
        db.flush()
        return "ABC234"

    def test_join_links_client(self, solo_api, db, trainer):
        client = _register_solo_client(solo_api, db)
        code = self._code(solo_api, db, trainer)

        res = solo_api.post("/client-portal/join-by-code", json={"code": code})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["trainer_id"] == trainer.id
        assert body["trainer_name"] == "Test Trainer"

        db.refresh(client)
        assert client.trainer_id == trainer.id
        assert solo_api.get("/auth/whoami").json()["trainer_link_status"] == "linked"
        # Roster + activity feed reflect the join
        assert client.id in [c["id"] for c in solo_api.get("/clients").json()]
        event = (
            db.query(ActivityEvent)
            .filter(ActivityEvent.client_id == client.id, ActivityEvent.event_type == ActivityEventTypeEnum.client_added)
            .one()
        )
        assert event.payload["via"] == "join_code"

    def test_code_is_case_insensitive_and_trimmed(self, solo_api, db, trainer):
        client = _register_solo_client(solo_api, db)
        code = self._code(solo_api, db, trainer)
        res = solo_api.post("/client-portal/join-by-code", json={"code": f"  {code.lower()} "})
        assert res.status_code == 200
        db.refresh(client)
        assert client.trainer_id == trainer.id

    def test_wrong_code_404(self, solo_api, db, trainer):
        _register_solo_client(solo_api, db)
        self._code(solo_api, db, trainer)
        assert solo_api.post("/client-portal/join-by-code", json={"code": "WRONG9"}).status_code == 404

    def test_blank_code_422(self, solo_api, db, trainer):
        _register_solo_client(solo_api, db)
        assert solo_api.post("/client-portal/join-by-code", json={"code": "   "}).status_code == 422

    def test_already_linked_409(self, solo_api, db, trainer):
        client = _register_solo_client(solo_api, db)
        code = self._code(solo_api, db, trainer)
        assert solo_api.post("/client-portal/join-by-code", json={"code": code}).status_code == 200
        assert solo_api.post("/client-portal/join-by-code", json={"code": code}).status_code == 409

    def test_join_supersedes_pending_request(self, solo_api, db, trainer):
        """Joining by code resolves any pending link request: accepted if it was
        to the same trainer, declined (withdrawn) if it was to another."""
        client = _register_solo_client(solo_api, db)
        other = User(clerk_user_id="other_trainer", role=RoleEnum.trainer, name="Other Trainer")
        db.add(other)
        db.flush()
        req = TrainerLinkRequest(client_id=client.id, trainer_id=other.id)
        db.add(req)
        db.flush()

        code = self._code(solo_api, db, trainer)
        assert solo_api.post("/client-portal/join-by-code", json={"code": code}).status_code == 200
        db.refresh(req)
        assert req.status == LinkRequestStatusEnum.declined
        assert req.responded_at is not None
        # The superseded request no longer shows in the other trainer's pending list
        assert (
            db.query(TrainerLinkRequest)
            .filter(TrainerLinkRequest.trainer_id == other.id, TrainerLinkRequest.status == LinkRequestStatusEnum.pending)
            .count()
            == 0
        )
