from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientError
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models.enums import RoleEnum
from .models.identity import TrainerProfile, User

bearer_scheme = HTTPBearer()


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    jwks_url = get_settings().clerk_jwks_url
    if not jwks_url:
        raise RuntimeError("CLERK_JWKS_URL not set in environment")
    return PyJWKClient(jwks_url)


def _verify_token(credentials: HTTPAuthorizationCredentials) -> dict:
    token = credentials.credentials
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except (jwt.InvalidTokenError, PyJWKClientError) as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


def get_current_trainer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate the Clerk JWT and return the trainer's `users` row, auto-provisioning
    a trainer account + profile on first sign-in (Clerk owns the auth identity; we
    just mirror it locally so every other table can scope by trainer_id)."""
    payload = _verify_token(credentials)
    clerk_user_id: str = payload["sub"]

    user = db.query(User).filter(User.clerk_user_id == clerk_user_id, User.role == RoleEnum.trainer).first()
    if user is not None:
        return user

    user = User(
        clerk_user_id=clerk_user_id,
        role=RoleEnum.trainer,
        email=payload.get("email"),
        name=payload.get("name"),
    )
    db.add(user)
    db.flush()
    db.add(TrainerProfile(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user
