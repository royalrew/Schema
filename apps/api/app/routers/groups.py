# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.db_models import EmployeeRow, UserRow
from app.auth_utils import get_current_user

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("", response_model=list[str])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(get_current_user),
):
    """Returnerar alla unika gruppers namn, sorterade."""
    if current_user.username.startswith("demo_"):
        return [f"Granbacken ({current_user.username})"]

    rows = (await db.execute(
        select(distinct(EmployeeRow.group_name))
        .where(~EmployeeRow.group_name.like("Granbacken (demo_%"))
        .order_by(EmployeeRow.group_name)
    )).scalars().all()
    return list(rows)
