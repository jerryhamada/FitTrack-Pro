from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from ..models.enums import InviteStatusEnum
from ..models.roster import Invite

INVITE_EXPIRY = timedelta(hours=48)


def create_invite(client_id: int) -> Invite:
    return Invite(
        client_id=client_id,
        token=secrets.token_urlsafe(24),
        status=InviteStatusEnum.pending,
        expires_at=datetime.now(timezone.utc) + INVITE_EXPIRY,
    )


def send_invite(invite: Invite) -> Invite:
    """TODO(Phase 2): plug in real email/SMS delivery (e.g. Twilio, Postmark) here.

    For Phase 1, Clerk client-auth isn't wired up yet, so we stub delivery and just
    surface the invite link in the UI for the trainer to share manually.
    """
    invite.delivered = False
    return invite
