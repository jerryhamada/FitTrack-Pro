from __future__ import annotations

import html
import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx

from ..config import get_settings
from ..models.enums import DeliveryMethodEnum, InviteStatusEnum
from ..models.roster import Invite

logger = logging.getLogger(__name__)

INVITE_EXPIRY = timedelta(hours=48)

RESEND_ENDPOINT = "https://api.resend.com/emails"


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
    """Raised by the email delivery layer (Resend) when sending fails or no
    provider is configured. send_invite() catches this and marks the invite
    undelivered rather than failing the request — the link still works when the
    trainer shares it manually."""


def create_invite(client_id: int) -> Invite:
    return Invite(
        client_id=client_id,
        token=secrets.token_urlsafe(24),
        status=InviteStatusEnum.pending,
        expires_at=datetime.now(timezone.utc) + INVITE_EXPIRY,
    )


def invite_link(token: str) -> str:
    """Public URL a client taps to accept an invite. Points at the landing page
    that walks them through installing the app and entering the code; the ?t=
    token is what the signup screen redeems."""
    base = get_settings().invite_landing_base_url.rstrip("/")
    return f"{base}?t={token}"


def _invite_email_html(client_name: str, trainer_name: str | None, link: str) -> str:
    who = html.escape(trainer_name) if trainer_name else "Your trainer"
    name = html.escape(client_name.split()[0]) if client_name.strip() else "there"
    safe_link = html.escape(link, quote=True)
    return f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0f1115">
  <h2 style="margin:0 0 8px">Hi {name},</h2>
  <p style="font-size:15px;line-height:1.6;color:#333">
    {who} invited you to train with them on <strong>LiftIQ</strong> — your workouts,
    programs, and progress, all in one place.
  </p>
  <p style="margin:28px 0">
    <a href="{safe_link}"
       style="background:#0a7d3c;color:#fff;text-decoration:none;font-weight:700;
              font-size:15px;padding:13px 22px;border-radius:12px;display:inline-block">
      Accept your invite
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#777">
    Or paste this link into your browser:<br>
    <a href="{safe_link}" style="color:#0a7d3c">{safe_link}</a>
  </p>
  <p style="font-size:12px;color:#999;margin-top:24px">
    This invite expires in 48 hours. If you weren't expecting it, you can ignore this email.
  </p>
</div>"""


def _deliver_email(to_email: str, subject: str, html_body: str) -> None:
    """Send one transactional email via Resend. Raises InviteDeliveryError on any
    failure (unconfigured provider, network error, non-2xx) so send_invite can
    record the invite as undelivered."""
    settings = get_settings()
    if not settings.resend_api_key:
        raise InviteDeliveryError("No email provider configured (RESEND_API_KEY unset).")
    try:
        resp = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.invite_from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        detail = getattr(getattr(e, "response", None), "text", "") or str(e)
        raise InviteDeliveryError(detail) from e


def send_invite(invite: Invite, client_name: str, client_email: str | None, trainer_name: str | None) -> Invite:
    """Email the invite link to the client. Delivery failure is non-fatal: the
    invite is flagged undelivered (invite.delivered = False) and the trainer can
    still share the link manually. Callers persist the invite either way.

    Returns the same invite with delivery_method / delivered updated in place."""
    invite.delivery_method = DeliveryMethodEnum.email
    if not client_email:
        invite.delivered = False
        logger.warning("Invite %s has no client email — cannot deliver.", invite.id)
        return invite

    link = invite_link(invite.token)
    subject = (
        f"{trainer_name} invited you to LiftIQ" if trainer_name else "You've been invited to LiftIQ"
    )
    try:
        _deliver_email(client_email, subject, _invite_email_html(client_name, trainer_name, link))
        invite.delivered = True
        logger.info("Invite %s emailed to %s", invite.id, client_email)
    except InviteDeliveryError as e:
        invite.delivered = False
        logger.warning("Invite %s not delivered to %s: %s", invite.id, client_email, e)
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
