# -*- coding: utf-8 -*-
"""
JWT-autentisering och lösenordshantering.
"""
import os
from datetime import datetime, timedelta, timezone, UTC
from typing import Optional

from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import UserRow

# ── Konfiguration ─────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-byt-i-produktion-till-random-256-bit")
ALGORITHM = "HS256"
EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

bearer_scheme = HTTPBearer(auto_error=False)


# ── Lösenord ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hasherar ett lösenord i klartext med bcrypt."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verifierar ett lösenord mot en lagrad bcrypt-hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, username: str, role: str, employee_id: Optional[str]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "employee_id": employee_id,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ogiltig eller utgången session — logga in igen.",
        )


# ── FastAPI-dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> UserRow:
    token_str = None
    if credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token

    if not token_str:
        raise HTTPException(status_code=401, detail="Inloggning krävs.")
    payload = decode_token(token_str)
    user_id = int(payload["sub"])
    row = await db.get(UserRow, user_id)
    if not row:
        raise HTTPException(status_code=401, detail="Användaren hittades inte.")
    return row


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserRow]:
    """Returnerar None om inte inloggad (används för sidor utan hård auth-spärr lokalt)."""
    token_str = None
    if credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token

    if not token_str:
        return None
    try:
        payload = decode_token(token_str)
        return await db.get(UserRow, int(payload["sub"]))
    except Exception:
        return None


def require_superadmin(user: UserRow = Depends(get_current_user)) -> UserRow:
    if user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Kräver superadmin-behörighet.")
    return user


def require_admin_or_schemaansvarig(user: UserRow = Depends(get_current_user)) -> UserRow:
    if user.role not in ("superadmin", "schemaansvarig"):
        raise HTTPException(status_code=403, detail="Kräver schemaläggarbehörighet.")
    return user
