from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import app.auth as auth_module
from app.auth import get_clerk_payload
from app.config import get_settings
from app.database import get_db
from app.models.enums import InviteStatusEnum, RoleEnum, UnitEnum
from app.models.identity import User
from app.models.roster import Client, Invite
from app.services.invites import create_invite

CLIENT_LOGIN = {"sub": "clerk_client_login", "email": "newclient@test.com", "name": "New Client"}


@pytest.fixture()
def invite(db, client_row) -> Invite:
    inv = create_invite(client_row.id)
    db.add(inv)
    db.flush()
    return inv


@pytest.fixture()
def raw_api(db):
    """TestClient with ONLY get_db overridden — auth dependencies stay real so
    these tests exercise the actual role-resolution/redemption logic."""
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def as_login(raw_api):
    """Returns a helper that scopes subsequent requests to a given Clerk payload."""
    from app.main import app

    def _set(payload: dict):
        app.dependency_overrides[get_clerk_payload] = lambda: payload
        return raw_api

    return _set


@pytest.fixture()
def real_auth(monkeypatch):
    """Force dev_auth_bypass off (the local .env sets it) so token-verifying
    paths run for real, with _verify_token stubbed per-test."""
    monkeypatch.setattr(get_settings(), "dev_auth_bypass", False)


# ---------------------------------------------------------------- redemption


def test_redeem_creates_client_user_and_links(db, as_login, invite, client_row, trainer):
    api = as_login(CLIENT_LOGIN)
    resp = api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert resp.status_code == 200
    body = resp.json()
    assert body["client_id"] == client_row.id
    assert body["client_name"] == client_row.name
    assert body["trainer_name"] == trainer.name

    user = db.query(User).filter(User.clerk_user_id == CLIENT_LOGIN["sub"]).one()
    assert user.role == RoleEnum.client
    assert user.email == CLIENT_LOGIN["email"]
    db.refresh(client_row)
    assert client_row.user_id == user.id
    db.refresh(invite)
    assert invite.status == InviteStatusEnum.accepted
    assert invite.accepted_at is not None


def test_redeem_is_idempotent_for_same_login(db, as_login, invite, client_row):
    api = as_login(CLIENT_LOGIN)
    first = api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert first.status_code == 200
    again = api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert again.status_code == 200
    assert again.json()["client_id"] == client_row.id
    # Still exactly one client user for this login
    assert db.query(User).filter(User.clerk_user_id == CLIENT_LOGIN["sub"]).count() == 1


def test_redeem_used_invite_different_login_conflicts(db, as_login, invite):
    as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    api = as_login({"sub": "someone_else", "email": "other@test.com"})
    resp = api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert resp.status_code == 409


def test_redeem_expired_invite_410_and_status_flip(db, as_login, invite):
    invite.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.flush()
    resp = as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    assert resp.status_code == 410
    db.refresh(invite)
    assert invite.status == InviteStatusEnum.expired


def test_redeem_revoked_invite_409(db, as_login, invite):
    invite.status = InviteStatusEnum.revoked
    db.flush()
    resp = as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    assert resp.status_code == 409


def test_redeem_unknown_token_404(as_login):
    resp = as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": "nope"})
    assert resp.status_code == 404


def test_redeem_client_already_linked_to_another_login_409(db, as_login, invite, client_row):
    other = User(clerk_user_id="prior_login", role=RoleEnum.client, email="prior@test.com")
    db.add(other)
    db.flush()
    client_row.user_id = other.id
    db.flush()
    resp = as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    assert resp.status_code == 409


def test_redeem_login_already_linked_to_a_different_client_409(db, as_login, invite, trainer):
    # CLIENT_LOGIN is already linked to some other client of the same trainer
    existing_user = User(clerk_user_id=CLIENT_LOGIN["sub"], role=RoleEnum.client, email="x@test.com")
    db.add(existing_user)
    db.flush()
    other_client = Client(
        trainer_id=trainer.id, name="Other Client", preferred_unit=UnitEnum.lbs, user_id=existing_user.id
    )
    db.add(other_client)
    db.flush()
    resp = as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    assert resp.status_code == 409


def test_redeem_with_trainer_login_409(db, as_login, invite, trainer):
    resp = as_login({"sub": trainer.clerk_user_id}).post(
        "/client-portal/redeem-invite", json={"token": invite.token}
    )
    assert resp.status_code == 409
    # No client user was created for the trainer's identity
    assert (
        db.query(User)
        .filter(User.clerk_user_id == trainer.clerk_user_id, User.role == RoleEnum.client)
        .count()
        == 0
    )


# ---------------------------------------------------------------- whoami


def test_whoami_trainer(as_login, trainer):
    resp = as_login({"sub": trainer.clerk_user_id}).get("/auth/whoami")
    assert resp.status_code == 200
    assert resp.json() == {
        "role": "trainer",
        "client_id": None,
        "client_name": None,
        "trainer_link_status": None,
    }


def test_whoami_client_after_redeem(db, as_login, invite, client_row):
    api = as_login(CLIENT_LOGIN)
    assert api.post("/client-portal/redeem-invite", json={"token": invite.token}).status_code == 200
    resp = api.get("/auth/whoami")
    assert resp.status_code == 200
    assert resp.json() == {
        "role": "client",
        "client_id": client_row.id,
        "client_name": client_row.name,
        "trainer_link_status": "linked",
    }


def test_whoami_unknown_login_has_no_role(as_login):
    resp = as_login({"sub": "brand_new_login"}).get("/auth/whoami")
    assert resp.status_code == 200
    assert resp.json()["role"] is None


# ---------------------------------------------------------------- invite preview


def test_preview_valid_invite(raw_api, invite, client_row, trainer):
    resp = raw_api.get(f"/client-portal/invites/{invite.token}")
    assert resp.status_code == 200
    assert resp.json() == {
        "client_name": client_row.name,
        "client_email": client_row.email,
        "trainer_name": trainer.name,
    }


def test_preview_unknown_token_404(raw_api):
    assert raw_api.get("/client-portal/invites/nope").status_code == 404


def test_preview_expired_410(db, raw_api, invite):
    invite.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.flush()
    assert raw_api.get(f"/client-portal/invites/{invite.token}").status_code == 410


def test_preview_accepted_409(db, raw_api, as_login, invite):
    as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    assert raw_api.get(f"/client-portal/invites/{invite.token}").status_code == 409


# --------------------------------------------- trainer auto-provision guard


def test_trainer_endpoint_rejects_client_login(db, raw_api, as_login, invite, real_auth, monkeypatch):
    as_login(CLIENT_LOGIN).post("/client-portal/redeem-invite", json={"token": invite.token})
    monkeypatch.setattr(auth_module, "_verify_token", lambda credentials: CLIENT_LOGIN)
    resp = raw_api.get("/trainer/me", headers={"Authorization": "Bearer fake"})
    assert resp.status_code == 403
    # Crucially: no trainer user was auto-provisioned for the client's identity
    assert (
        db.query(User)
        .filter(User.clerk_user_id == CLIENT_LOGIN["sub"], User.role == RoleEnum.trainer)
        .count()
        == 0
    )


def test_trainer_endpoint_still_autoprovisions_fresh_login(db, raw_api, real_auth, monkeypatch):
    fresh = {"sub": "fresh_trainer_login", "email": "new@trainer.com", "name": "New Trainer"}
    monkeypatch.setattr(auth_module, "_verify_token", lambda credentials: fresh)
    resp = raw_api.get("/trainer/me", headers={"Authorization": "Bearer fake"})
    assert resp.status_code == 200
    user = db.query(User).filter(User.clerk_user_id == fresh["sub"]).one()
    assert user.role == RoleEnum.trainer
