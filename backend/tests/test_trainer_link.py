"""Self-signup client flow: register-client, trainer search, link requests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.auth import get_clerk_payload, get_current_trainer
from app.database import get_db
from app.models.enums import LinkRequestStatusEnum, RoleEnum, UnitEnum
from app.models.identity import TrainerProfile, User
from app.models.notifications import Notification
from app.models.roster import Client, TrainerLinkRequest

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


def _register(solo_api) -> dict:
    res = solo_api.post("/auth/register-client")
    assert res.status_code == 200, res.text
    return res.json()


def _solo_client(db) -> Client:
    user = db.query(User).filter(User.clerk_user_id == SOLO_PAYLOAD["sub"]).one()
    return db.query(Client).filter(Client.user_id == user.id).one()


def _as_client(db, trainer, client: Client):
    """Swap the portal auth override to the given client row."""
    from app.main import app
    from app.routers.client_portal import get_current_client

    app.dependency_overrides[get_current_client] = lambda: client


class TestRegisterClient:
    def test_creates_unlinked_client(self, solo_api, db):
        out = _register(solo_api)
        client = _solo_client(db)
        assert out == {"client_id": client.id, "client_name": "Solo Sam"}
        assert client.trainer_id is None
        assert client.email == "solo@test.com"

    def test_idempotent(self, solo_api, db):
        first = _register(solo_api)
        second = _register(solo_api)
        assert first == second
        assert db.query(Client).filter(Client.email == "solo@test.com").count() == 1

    def test_trainer_login_rejected(self, solo_api, db, trainer):
        from app.main import app

        app.dependency_overrides[get_clerk_payload] = lambda: {
            "sub": trainer.clerk_user_id,
            "email": trainer.email,
        }
        res = solo_api.post("/auth/register-client")
        assert res.status_code == 409

    def test_whoami_reports_unlinked_client(self, solo_api):
        _register(solo_api)
        res = solo_api.get("/auth/whoami")
        assert res.status_code == 200
        body = res.json()
        assert body["role"] == "client"
        assert body["trainer_link_status"] == "none"


class TestTrainerSearch:
    def test_finds_by_name_and_business(self, solo_api, db, trainer):
        profile = db.query(TrainerProfile).filter(TrainerProfile.user_id == trainer.id).one()
        profile.business_name = "Iron Temple Gym"
        db.flush()

        by_name = solo_api.get("/client-portal/trainer-search", params={"q": "Test Tr"}).json()
        assert [r["trainer_id"] for r in by_name] == [trainer.id]
        assert by_name[0]["business_name"] == "Iron Temple Gym"

        by_biz = solo_api.get("/client-portal/trainer-search", params={"q": "iron temple"}).json()
        assert [r["trainer_id"] for r in by_biz] == [trainer.id]

    def test_no_match_and_min_length(self, solo_api):
        assert solo_api.get("/client-portal/trainer-search", params={"q": "zzzz"}).json() == []
        assert solo_api.get("/client-portal/trainer-search", params={"q": "z"}).status_code == 422

    def test_clients_not_searchable(self, solo_api, db, client_row):
        res = solo_api.get("/client-portal/trainer-search", params={"q": "Test Client"})
        assert res.json() == []


class TestLinkRequests:
    def _request_link(self, solo_api, db, trainer) -> dict:
        _register(solo_api)
        _as_client(db, trainer, _solo_client(db))
        res = solo_api.post("/client-portal/link-requests", json={"trainer_id": trainer.id})
        assert res.status_code == 201, res.text
        return res.json()

    def test_creates_pending_request_and_notifies_trainer(self, solo_api, db, trainer):
        out = self._request_link(solo_api, db, trainer)
        assert out["status"] == "pending"
        assert out["trainer_name"] == "Test Trainer"

        note = (
            db.query(Notification)
            .filter(Notification.trainer_id == trainer.id, Notification.dedup_key == f"link_request:{out['id']}")
            .one()
        )
        assert "Solo Sam" in note.message

        whoami = solo_api.get("/auth/whoami").json()
        assert whoami["trainer_link_status"] == "pending"

    def test_same_trainer_is_idempotent(self, solo_api, db, trainer):
        first = self._request_link(solo_api, db, trainer)
        res = solo_api.post("/client-portal/link-requests", json={"trainer_id": trainer.id})
        assert res.status_code == 201
        assert res.json()["id"] == first["id"]
        assert db.query(TrainerLinkRequest).count() == 1

    def test_second_trainer_while_pending_conflicts(self, solo_api, db, trainer):
        self._request_link(solo_api, db, trainer)
        other = User(clerk_user_id="other_trainer", role=RoleEnum.trainer, name="Other Trainer")
        db.add(other)
        db.flush()
        res = solo_api.post("/client-portal/link-requests", json={"trainer_id": other.id})
        assert res.status_code == 409

    def test_linked_client_cannot_request(self, solo_api, db, trainer, client_row):
        _as_client(db, trainer, client_row)  # client_row is already linked to trainer
        res = solo_api.post("/client-portal/link-requests", json={"trainer_id": trainer.id})
        assert res.status_code == 409

    def test_unknown_trainer_404(self, solo_api, db, trainer):
        _register(solo_api)
        _as_client(db, trainer, _solo_client(db))
        res = solo_api.post("/client-portal/link-requests", json={"trainer_id": 999999})
        assert res.status_code == 404


class TestTrainerAcceptDecline:
    def _pending_request(self, solo_api, db, trainer) -> int:
        _register(solo_api)
        _as_client(db, trainer, _solo_client(db))
        res = solo_api.post("/client-portal/link-requests", json={"trainer_id": trainer.id})
        return res.json()["id"]

    def test_list_pending(self, solo_api, db, trainer):
        req_id = self._pending_request(solo_api, db, trainer)
        rows = solo_api.get("/clients/link-requests").json()
        assert [r["id"] for r in rows] == [req_id]
        assert rows[0]["client_name"] == "Solo Sam"

    def test_accept_links_client(self, solo_api, db, trainer):
        req_id = self._pending_request(solo_api, db, trainer)
        res = solo_api.post(f"/clients/link-requests/{req_id}/accept")
        assert res.status_code == 200
        assert res.json()["status"] == "accepted"

        client = _solo_client(db)
        assert client.trainer_id == trainer.id
        assert solo_api.get("/auth/whoami").json()["trainer_link_status"] == "linked"
        # Now on the trainer's roster
        roster = solo_api.get("/clients").json()
        assert client.id in [c["id"] for c in roster]

    def test_decline_returns_to_none(self, solo_api, db, trainer):
        req_id = self._pending_request(solo_api, db, trainer)
        res = solo_api.post(f"/clients/link-requests/{req_id}/decline")
        assert res.status_code == 200
        assert _solo_client(db).trainer_id is None
        assert solo_api.get("/auth/whoami").json()["trainer_link_status"] == "none"

    def test_already_handled_conflicts(self, solo_api, db, trainer):
        req_id = self._pending_request(solo_api, db, trainer)
        solo_api.post(f"/clients/link-requests/{req_id}/decline")
        assert solo_api.post(f"/clients/link-requests/{req_id}/accept").status_code == 409


class TestUnlinkedPortalAccess:
    def test_dashboard_works_without_trainer(self, solo_api, db, trainer):
        _register(solo_api)
        _as_client(db, trainer, _solo_client(db))
        res = solo_api.get("/client-portal/dashboard")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["client_name"] == "Solo Sam"
        assert body["trainer_name"] is None

    def test_my_workouts_works_without_trainer(self, solo_api, db, trainer):
        _register(solo_api)
        _as_client(db, trainer, _solo_client(db))
        res = solo_api.get("/client-portal/my-workouts")
        assert res.status_code == 200, res.text
        assert res.json()["trainer_name"] is None
