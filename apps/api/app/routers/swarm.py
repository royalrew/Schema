# -*- coding: utf-8 -*-
"""
Produkt-swarm: ``POST /api/swarm/{group}/{year}/{month}`` (dry-run).

Kör svärmen (app/engine/swarm.py) över en grupps genererade schema och returnerar
en attribuerad bevis-rapport — vilken agent som skulle göra vad, allt motorvaliderat.
Skiva 1 skriver INTE till databasen (dry-run); apply blir nästa skiva.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import EmployeeRow, SchedulePeriodRow, UserRow
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.swarm import run_swarm, SwarmReport
from app.routers.schedule import _row_to_employee
from app.routers.generate_all import _load_krav

router = APIRouter(prefix="/api/swarm", tags=["swarm"])


@router.post("/{group}/{year}/{month}", response_model=SwarmReport)
async def swarm_optimize(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Dry-run: kör svärmens agenter över gruppens schema och returnerar en
    attribuerad bevis-rapport (Täckning / Timbalans / Rättvisa). Sparar inget.
    """
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"

    period_row = (await db.execute(select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    ))).scalar_one_or_none()

    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema att optimera för perioden.")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]

    krav = await _load_krav(db, group, year, month)

    return run_swarm(list(period_row.schedule), employees, krav, year, month)
