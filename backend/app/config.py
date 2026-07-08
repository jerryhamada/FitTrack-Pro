from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""
    # DEV ONLY: skip JWT verification and act as the first trainer in the DB.
    dev_auth_bypass: bool = False

    # --- Invite email delivery (Resend) ---------------------------------------
    # When resend_api_key is set, invites are emailed to the client on creation.
    # Left blank, delivery is a graceful no-op and the trainer shares the link
    # manually (see services/invites.send_invite).
    resend_api_key: str = ""
    # Verified sender. Resend's shared sandbox address "onboarding@resend.dev"
    # works without a domain but can only deliver to your own account email —
    # set a verified-domain sender (e.g. "LiftIQ <invites@yourdomain.com>") to
    # email real clients.
    invite_from_email: str = "LiftIQ <onboarding@resend.dev>"
    # Landing page the invite link points at (walks the client through install +
    # entering the code). The ?t=<token> is appended by the invites service.
    invite_landing_base_url: str = "https://jerryhamada.github.io/FitTrack-Pro/invite.html"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
