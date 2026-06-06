# -*- coding: utf-8 -*-
"""
Ingångssaldo per anställd och period.
Fylls i manuellt av schema-ansvarig från Medvind — ej lönegrundande.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import EmployeeBalanceRow, UserRow
from app.auth_utils import get_current_user, require_admin_or_schemaansvarig

router = APIRouter(prefix="/api/balances", tags=["balances"])


class BalanceEntry(BaseModel):
    employee_id: str
    year: int
    month: int
    opening_balance_h: float = 0.0
    note: str | None = None


@router.get("/{employee_id}/{year}/{month}", response_model=BalanceEntry)
async def get_balance(
    employee_id: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(get_current_user),
):
    if current_user.role not in ("superadmin", "schemaansvarig") and current_user.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Behörighet saknas.")
    row = (await db.execute(
        select(EmployeeBalanceRow).where(
            EmployeeBalanceRow.employee_id == employee_id,
            EmployeeBalanceRow.year == year,
            EmployeeBalanceRow.month == month,
        )
    )).scalar_one_or_none()
    if not row:
        return BalanceEntry(employee_id=employee_id, year=year, month=month)
    return BalanceEntry(
        employee_id=row.employee_id,
        year=row.year,
        month=row.month,
        opening_balance_h=row.opening_balance_h,
        note=row.note,
    )


@router.put("/{employee_id}/{year}/{month}", response_model=BalanceEntry)
async def set_balance(
    employee_id: str, year: int, month: int,
    entry: BalanceEntry,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    row = (await db.execute(
        select(EmployeeBalanceRow).where(
            EmployeeBalanceRow.employee_id == employee_id,
            EmployeeBalanceRow.year == year,
            EmployeeBalanceRow.month == month,
        )
    )).scalar_one_or_none()

    if row:
        row.opening_balance_h = entry.opening_balance_h
        row.note = entry.note
    else:
        db.add(EmployeeBalanceRow(
            employee_id=employee_id,
            year=year,
            month=month,
            opening_balance_h=entry.opening_balance_h,
            note=entry.note,
        ))
    await db.commit()
    return entry


@router.get("/group/{group}/{year}/{month}", response_model=list[BalanceEntry])
async def get_group_balances(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Hämtar alla saldon för en grupp och period på en gång."""
    from app.db_models import EmployeeRow
    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == group)
    )).scalars().all()
    emp_ids = [r.id for r in emp_rows]

    bal_rows = (await db.execute(
        select(EmployeeBalanceRow).where(
            EmployeeBalanceRow.employee_id.in_(emp_ids),
            EmployeeBalanceRow.year == year,
            EmployeeBalanceRow.month == month,
        )
    )).scalars().all()

    bal_map = {r.employee_id: r for r in bal_rows}
    return [
        BalanceEntry(
            employee_id=eid,
            year=year,
            month=month,
            opening_balance_h=bal_map[eid].opening_balance_h if eid in bal_map else 0.0,
            note=bal_map[eid].note if eid in bal_map else None,
        )
        for eid in emp_ids
    ]
