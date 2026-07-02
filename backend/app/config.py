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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
