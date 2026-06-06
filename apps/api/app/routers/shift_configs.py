# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import ShiftConfigRow, UserRow
from app.auth_utils import get_current_user, require_admin_or_schemaansvarig

router = APIRouter(prefix="/api/shift-configs", tags=["shift-configs"])

# Globala grundtider — används om ingen grupp-override finns
DEFAULTS: list[dict] = [
    {"shift_type": "dag_tidig", "start_time": "06:45", "end_time": "16:00", "label": "Dag tidig"},
    {"shift_type": "dag",       "start_time": "07:00", "end_time": "16:00", "label": "Dag"},
    {"shift_type": "kval_kort", "start_time": "13:45", "end_time": "20:00", "label": "Kväll kort"},
    {"shift_type": "kval_lang", "start_time": "13:45", "end_time": "21:30", "label": "Kväll lång"},
    {"shift_type": "natt",      "start_time": "21:15", "end_time": "07:00", "label": "Natt"},
]


class ShiftConfig(BaseModel):
    shift_type: str
    start_time: str   # "HH:MM"
    end_time: str     # "HH:MM"
    label: str | None = None
    group_name: str | None = None


class ShiftConfigsResponse(BaseModel):
    configs: list[ShiftConfig]


def _row_to_config(row: ShiftConfigRow) -> ShiftConfig:
    return ShiftConfig(
        shift_type=row.shift_type,
        start_time=row.start_time,
        end_time=row.end_time,
        label=row.label,
        group_name=row.group_name,
    )


@router.get("", response_model=ShiftConfigsResponse)
async def get_configs(
    group: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(get_current_user),
):
    """
    Returnerar effektiva passtider för en grupp.
    Prioritet: gruppspecifik override > global default i DB > inbyggd fallback.
    """
    # Hämta globala defaults från DB
    global_stmt = select(ShiftConfigRow).where(ShiftConfigRow.group_name.is_(None))
    global_rows = {r.shift_type: r for r in (await db.execute(global_stmt)).scalars().all()}

    # Hämta gruppspecifika overrides
    group_rows: dict[str, ShiftConfigRow] = {}
    if group:
        grp_stmt = select(ShiftConfigRow).where(ShiftConfigRow.group_name == group)
        group_rows = {r.shift_type: r for r in (await db.execute(grp_stmt)).scalars().all()}

    # Slå ihop: fallback-kedja
    result: list[ShiftConfig] = []
    for d in DEFAULTS:
        st = d["shift_type"]
        row = group_rows.get(st) or global_rows.get(st)
        if row:
            result.append(_row_to_config(row))
        else:
            result.append(ShiftConfig(**d, group_name=None))

    return ShiftConfigsResponse(configs=result)


@router.put("", response_model=ShiftConfigsResponse)
async def save_configs(
    body: ShiftConfigsResponse,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Sparar en lista passtider. group_name=null → global, annars grupspecifik."""
    for cfg in body.configs:
        stmt = select(ShiftConfigRow).where(
            ShiftConfigRow.group_name == cfg.group_name,
            ShiftConfigRow.shift_type == cfg.shift_type,
        )
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            row.start_time = cfg.start_time
            row.end_time = cfg.end_time
            row.label = cfg.label
        else:
            db.add(ShiftConfigRow(
                group_name=cfg.group_name,
                shift_type=cfg.shift_type,
                start_time=cfg.start_time,
                end_time=cfg.end_time,
                label=cfg.label,
            ))
    await db.commit()
    return body
