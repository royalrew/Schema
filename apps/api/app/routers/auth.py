# -*- coding: utf-8 -*-
"""
Auth-router: inloggning, användarhantering och inbjudningar.
"""
import uuid
import re
import unicodedata
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import UserRow, EmployeeRow
from app.auth_utils import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_superadmin, require_admin_or_schemaansvarig,
)

class UpdateRoleRequest(BaseModel):
    role: str  # superadmin | schemaansvarig | personal

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Modeller ──────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    employee_id: str | None
    full_name: str
    user_id: int


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    employee_id: str | None
    invite_accepted: bool
    last_login: datetime | None


class CreateUserRequest(BaseModel):
    username: str
    full_name: str
    role: str  # superadmin | schemaansvarig | personal
    employee_id: str | None = None


class AcceptInviteRequest(BaseModel):
    token: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(
        select(UserRow).where(UserRow.username == req.username)
    )).scalar_one_or_none()

    if not row or not row.password_hash:
        raise HTTPException(status_code=401, detail="Felaktigt användarnamn eller lösenord.")
    if not verify_password(req.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Felaktigt användarnamn eller lösenord.")
    if not row.invite_accepted:
        raise HTTPException(status_code=401, detail="Inbjudan ej accepterad — öppna länken du fick.")

    row.last_login = datetime.utcnow()
    await db.commit()

    token = create_access_token(row.id, row.username, row.role, row.employee_id)
    return LoginResponse(
        access_token=token,
        role=row.role,
        employee_id=row.employee_id,
        full_name=row.full_name,
        user_id=row.id,
    )


@router.get("/me", response_model=UserOut)
async def me(user: UserRow = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        employee_id=user.employee_id,
        invite_accepted=user.invite_accepted,
        last_login=user.last_login,
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(
    _: UserRow = Depends(require_admin_or_schemaansvarig),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(UserRow).order_by(UserRow.full_name))).scalars().all()
    return [UserOut(
        id=r.id, username=r.username, full_name=r.full_name, role=r.role,
        employee_id=r.employee_id, invite_accepted=r.invite_accepted, last_login=r.last_login,
    ) for r in rows]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    req: CreateUserRequest,
    _: UserRow = Depends(require_admin_or_schemaansvarig),
    db: AsyncSession = Depends(get_db),
):
    # Kontrollera att username inte redan finns
    existing = (await db.execute(
        select(UserRow).where(UserRow.username == req.username)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Användarnamnet '{req.username}' är redan taget.")

    # Kontrollera att employee_id finns om personal-roll
    if req.role == "personal" and req.employee_id:
        emp = await db.get(EmployeeRow, req.employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail=f"Anställd {req.employee_id} hittades inte.")

    row = UserRow(
        username=req.username,
        full_name=req.full_name,
        role=req.role,
        employee_id=req.employee_id,
        invite_token=str(uuid.uuid4()),
        invite_accepted=False,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    return UserOut(
        id=row.id, username=row.username, full_name=row.full_name, role=row.role,
        employee_id=row.employee_id, invite_accepted=row.invite_accepted, last_login=row.last_login,
    )


@router.post("/users/{user_id}/invite")
async def get_invite_link(
    user_id: int,
    _: UserRow = Depends(require_admin_or_schemaansvarig),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(UserRow, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")

    # Generera nytt token (giltig att använda om och om igen tills accepterat)
    row.invite_token = str(uuid.uuid4())
    await db.commit()

    return {"invite_token": row.invite_token, "full_name": row.full_name}


@router.post("/accept")
async def accept_invite(req: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(
        select(UserRow).where(UserRow.invite_token == req.token)
    )).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Ogiltig eller redan använd inbjudningslänk.")

    if len(req.password) < 6:
        raise HTTPException(status_code=422, detail="Lösenordet måste vara minst 6 tecken.")

    row.password_hash = hash_password(req.password)
    row.invite_accepted = True
    row.invite_token = None  # Ogiltigförklara token efter användning
    await db.commit()

    token = create_access_token(row.id, row.username, row.role, row.employee_id)
    return LoginResponse(
        access_token=token,
        role=row.role,
        employee_id=row.employee_id,
        full_name=row.full_name,
        user_id=row.id,
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    current: UserRow = Depends(require_admin_or_schemaansvarig),
    db: AsyncSession = Depends(get_db),
):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Du kan inte ta bort ditt eget konto.")
    row = await db.get(UserRow, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
    await db.delete(row)
    await db.commit()


@router.put("/password")
async def change_password(
    req: ChangePasswordRequest,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.password_hash or not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Nuvarande lösenord stämmer inte.")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=422, detail="Lösenordet måste vara minst 6 tecken.")
    user.password_hash = hash_password(req.new_password)
    await db.commit()
    return {"ok": True}


@router.put("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    req: UpdateRoleRequest,
    current: UserRow = Depends(require_admin_or_schemaansvarig),
    db: AsyncSession = Depends(get_db),
):
    """Uppdaterar rollen för en användare. Endast administratörer tillåts ändra roller."""
    if req.role not in ("superadmin", "schemaansvarig", "personal"):
        raise HTTPException(status_code=422, detail="Ogiltig roll.")
        
    row = await db.get(UserRow, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Användaren hittades inte.")
        
    if current.id == user_id and req.role != current.role:
        raise HTTPException(status_code=400, detail="Du kan inte ändra din egen roll.")

    row.role = req.role
    await db.commit()
    await db.refresh(row)

    return UserOut(
        id=row.id, username=row.username, full_name=row.full_name, role=row.role,
        employee_id=row.employee_id, invite_accepted=row.invite_accepted, last_login=row.last_login,
    )


def _name_to_username(name: str) -> str:
    """Konverterar "Anna Karlsson" → "anna.karlsson" med svenska tecken hanterade."""
    # Normalisera unicode → decompose å→a+combining, ä→a+combining etc.
    normalized = unicodedata.normalize("NFD", name.lower())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    # Ersätt mellanslag med punkt, ta bort allt utom bokstäver och punkter
    parts = ascii_only.split()
    cleaned = ".".join(re.sub(r"[^a-z0-9]", "", p) for p in parts if p)
    return cleaned or "anvandare"


@router.get("/suggest-username")
async def suggest_username(name: str, db: AsyncSession = Depends(get_db)):
    """
    Föreslår ett ledigt användarnamn baserat på ett fullständigt namn.
    Exempel: "Anna Karlsson" → "anna.karlsson" (eller "anna.karlsson.2" om taget).
    Kräver ingen autentisering — används i formulär.
    """
    base = _name_to_username(name)
    if not base:
        return {"username": "anvandare"}

    # Kontrollera om basnamnet är ledigt
    existing = (await db.execute(
        select(UserRow.username).where(UserRow.username.like(f"{base}%"))
    )).scalars().all()
    taken = set(existing)

    if base not in taken:
        return {"username": base}

    # Hitta nästa lediga nummer
    for n in range(2, 100):
        candidate = f"{base}.{n}"
        if candidate not in taken:
            return {"username": candidate}

    return {"username": f"{base}.{uuid.uuid4().hex[:4]}"}
