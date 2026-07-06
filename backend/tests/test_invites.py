"""Invite redemption: the endpoint that links a client's Clerk login to their
Client row, plus the expiry/reuse validation around it."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import pytest

from app.models.enums import InviteStatusEnum, RoleEnum
from app.models.identity import User
from app.models.roster import Client, Invite
from app.services.invites import create_invite, send_invite

CLERK_SUB = "clerk_client_abc"


@pytest.fixture()
def invite(db, client_row) -> Invite:
    inv = create_invite(client_row.id)
    db.add(inv)
    db.flush()
    return inv


@pytest.fixture()
def redeem_api(db, trainer):
    """TestClient with the Clerk-payload dependency overridden — redemption runs
    before any Client link exists, so it can't use the client_api fixture."""
    from app.main import app
    from app.database import get_db
    from app.auth import get_current_trainer
    from app.routers.client_portal import get_clerk_payload

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_trainer] = lambda: trainer
    app.dependency_overrides[get_clerk_payload] = lambda: {
        "sub": CLERK_SUB,
        "email": "newclient@test.com",
        "name": "New Client",
    }
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_redeem_happy_path(redeem_api, db, invite, client_row):
    res = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["client_id"] == client_row.id
    assert body["client_name"] == client_row.name

    db.refresh(invite)
    db.refresh(client_row)
    assert invite.status == InviteStatusEnum.accepted
    assert invite.accepted_at is not None
    user = db.query(User).filter(User.clerk_user_id == CLERK_SUB).first()
    assert user is not None
    assert user.role == RoleEnum.client
    assert client_row.user_id == user.id


def test_redeem_expired_invite(redeem_api, db, invite):
    invite.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.flush()

    res = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert res.status_code == 410
    assert "expired" in res.json()["detail"].lower()

    db.refresh(invite)
    assert invite.status == InviteStatusEnum.expired  # status caught up with reality


def test_redeem_already_used_by_other_login(redeem_api, db, invite, client_row):
    # Simulate a previous redemption by a different login.
    other = User(clerk_user_id="clerk_someone_else", role=RoleEnum.client, email="x@test.com", name="X")
    db.add(other)
    db.flush()
    client_row.user_id = other.id
    invite.status = InviteStatusEnum.accepted
    invite.accepted_at = datetime.now(timezone.utc)
    db.flush()

    res = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert res.status_code == 409
    assert "already been used" in res.json()["detail"].lower()


def test_redeem_is_idempotent_for_same_login(redeem_api, db, invite):
    first = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert first.status_code == 200
    again = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert again.status_code == 200
    assert again.json()["client_id"] == first.json()["client_id"]


def test_redeem_invalid_token(redeem_api):
    res = redeem_api.post("/client-portal/redeem-invite", json={"token": "not-a-real-token"})
    assert res.status_code == 404
    assert "valid" in res.json()["detail"].lower()


def test_redeem_revoked_invite(redeem_api, db, invite):
    invite.status = InviteStatusEnum.revoked
    db.flush()

    res = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert res.status_code == 409
    assert "no longer active" in res.json()["detail"].lower()


def test_login_already_linked_to_other_client_rejected(redeem_api, db, trainer, invite):
    # The redeeming login is already the portal user for a *different* client.
    user = User(clerk_user_id=CLERK_SUB, role=RoleEnum.client, email="c@test.com", name="C")
    db.add(user)
    db.flush()
    other_client = Client(trainer_id=trainer.id, name="Other Client", user_id=user.id)
    db.add(other_client)
    db.flush()

    res = redeem_api.post("/client-portal/redeem-invite", json={"token": invite.token})
    assert res.status_code == 409
    assert "different client" in res.json()["detail"].lower()


def test_send_invite_logs_undelivered_warning(db, invite, caplog):
    """Delivery is still a stub — make sure the no-op is loud in logs, not silent."""
    with caplog.at_level(logging.WARNING, logger="app.services.invites"):
        send_invite(invite)
    assert invite.delivered is False
    assert any("not delivered" in r.message for r in caplog.records)
