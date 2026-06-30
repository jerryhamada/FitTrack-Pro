from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
