from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from ..models.enums import InviteStatusEnum
from ..models.roster import Invite

logger = logging.getLogger(__name__)

INVITE_EXPIRY = timedelta(hours=48)


class InviteError(Exception):
    """Base for invite validation failures. `detail` is safe to surface to the
    end user (the person tapping an invite link)."""

    detail = "This invite link isn't valid."


class InviteNotFoundError(InviteError):
    detail = "This invite link isn't valid — double-check it or ask your trainer to send a new one."


class InviteExpiredError(InviteError):
    detail = "This invite has expired — ask your trainer to send you a new one."


class InviteAlreadyUsedError(InviteError):
    detail = "This invite has already been used. If that wasn't you, ask your trainer to send a new one."


class InviteRevokedError(InviteError):
    detail = "This invite is no longer active — ask your trainer to send a new one."


class InviteDeliveryError(Exception):
    """Raised by a real delivery integration (email/SMS) when sending fails.

    No provider is wired up yet; this exists so callers of send_invite() already
    handle the failure path and a future Twilio/Postmark integration can raise it
    without touching every call site.
    """


def create_invite(client_id: int) -> Invite:
    return Invite(
        client_id=client_id,
        token=secrets.token_urlsafe(24),
        status=InviteStatusEnum.pending,
        expires_at=datetime.now(timezone.utc) + INVITE_EXPIRY,
    )


def send_invite(invite: Invite) -> Invite:
    """Deliver the invite to the client. May raise InviteDeliveryError once a real
    provider is integrated — callers should treat delivery failure as non-fatal
    (the invite link still works when shared manually).

    TODO(Phase 2): plug in real email/SMS delivery (e.g. Twilio, Postmark) here.
    For now delivery is a stub: the trainer shares the link manually, and we log
    so the no-op is visible in server logs rather than silent.
    """
    invite.delivered = False
    logger.warning(
        "Invite %s for client %s not delivered automatically (no delivery provider "
        "configured) — trainer must share the link manually.",
        invite.id,
        invite.client_id,
    )
    return invite


def validate_invite_for_redemption(invite: Invite | None) -> Invite:
    """Check an invite is redeemable right now. Raises a specific InviteError
    (not-found / already-used / revoked / expired) with a user-safe message.

    Side effect: a pending invite past its expiry is flipped to `expired` so the
    stored status catches up with reality (caller is expected to commit)."""
    if invite is None:
        raise InviteNotFoundError()
    if invite.status == InviteStatusEnum.accepted:
        raise InviteAlreadyUsedError()
    if invite.status == InviteStatusEnum.revoked:
        raise InviteRevokedError()
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if invite.status == InviteStatusEnum.expired or expires_at < datetime.now(timezone.utc):
        invite.status = InviteStatusEnum.expired
        raise InviteExpiredError()
    return invite
