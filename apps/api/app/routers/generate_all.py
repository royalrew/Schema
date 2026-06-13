# -*- coding: utf-8 -*-
"""
Global schemagenerering: ``POST /api/generate-all``.

Genererar alla (icke-attesterade) grupper i en körning och kör sedan ETT globalt
inlåningspass över hela bilden (se app/engine/borrowing.py). Resultatet är
deterministiskt och oberoende av gruppordning, och varje lån bär bevis i
beslutsloggen.
"""

import calendar
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import (
    EmployeeRow, BemanningskravRow, StaffingTemplateRow, ShiftConfigRow,
    SchedulePeriodRow, UserRow,
)
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import Bemanningskrav, Group, ScheduleDay
from app.engine.generator import generate_schedule, _build_templates
from app.engine.solver import validate_schedule, validate_staffing
from app.engine.borrowing import run_global_borrowing
from app.routers.schedule import _row_to_employee, _schedule_day_to_dict
from app.routers.staffing import _krav_from_template, _default_krav, DayKrav, StaffingTemplate

router = APIRouter(prefix="/api", tags=["generate-all"])
STOCKHOLM = ZoneInfo("Europe/Stockholm")


class GenerateAllRequest(BaseModel):
    year: int
    month: int


class GroupResult(BaseModel):
    group: str
    shifts: int
    obokad: int
    coverage_warnings: int


class GenerateAllResponse(BaseModel):
    year: int
    month: int
    regenerated: list[GroupResult]
    skipped_attested: list[str]
    loans: int
    unfilled_shortages: int
    hard_errors: int


async def _load_krav(db: AsyncSession, group_name: str, year: int, month: int) -> list[Bemanningskrav]:
    """Hämtar bemanningskrav för en grupp (explicit → mall → default)."""
    krav_row = (await db.execute(select(BemanningskravRow).where(
        BemanningskravRow.group_name == group_name,
        BemanningskravRow.year == year,
        BemanningskravRow.month == month,
    ))).scalar_one_or_none()

    if krav_row and krav_row.requirements:
        return [
            Bemanningskrav(
                group=Group(k["group"]),
                date=date.fromisoformat(k["date"]),
                fm_heads=k.get("fm_heads", 2),
                em_heads=k.get("em_heads", 0),
                kval_heads=k.get("kval_heads", 2),
                natt_heads=k.get("natt_heads", 0),
            )
            for k in krav_row.requirements
        ]

    tmpl_row = (await db.execute(select(StaffingTemplateRow).where(
        StaffingTemplateRow.group_name == group_name
    ))).scalar_one_or_none()
    if tmpl_row and tmpl_row.per_weekday:
        tmpl = StaffingTemplate(
            group_name=group_name,
            per_weekday=[DayKrav(**d) for d in tmpl_row.per_weekday],
        )
        return _krav_from_template(tmpl, Group(group_name), year, month)

    return _default_krav(Group(group_name), year, month)


async def _load_shift_configs(db: AsyncSession, group_name: str) -> list[dict]:
    """Passtider för en grupp: gruppspecifika overrides vinner över globala defaults."""
    cfg_rows = (await db.execute(select(ShiftConfigRow).where(
        (ShiftConfigRow.group_name == group_name) | ShiftConfigRow.group_name.is_(None)
    ))).scalars().all()
    seen: dict[str, dict] = {}
    for r in sorted(cfg_rows, key=lambda x: (x.group_name is None)):  # global sist → override vinner
        seen[r.shift_type] = {"shift_type": r.shift_type, "start_time": r.start_time, "end_time": r.end_time}
    return list(seen.values())


@router.post("/generate-all", response_model=GenerateAllResponse)
async def generate_all(
    req: GenerateAllRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Genererar alla icke-attesterade grupper i en gemensam körning + globalt lånepass.
    Attesterade perioder lämnas orörda (rapporteras som överhoppade).
    """
    # 1. Alla grupper (distinkta) i fast ordning.
    group_names = (await db.execute(select(EmployeeRow.group_name).distinct())).scalars().all()
    groups = sorted({g for g in group_names if g})

    # 2. Alla anställda en gång.
    all_emp_rows = (await db.execute(select(EmployeeRow))).scalars().all()
    employees_by_id = {r.id: _row_to_employee(r) for r in all_emp_rows}
    emps_by_group: dict[str, list] = {}
    for emp in employees_by_id.values():
        emps_by_group.setdefault(str(emp.group), []).append(emp)

    _, last_day = calendar.monthrange(req.year, req.month)
    period_start = date(req.year, req.month, 1)
    period_end = date(req.year, req.month, last_day)

    # 3. Befintliga perioder (för att hoppa över attesterade).
    period_rows = (await db.execute(select(SchedulePeriodRow).where(
        SchedulePeriodRow.year == req.year,
        SchedulePeriodRow.month == req.month,
    ))).scalars().all()
    period_by_group = {r.group_name: r for r in period_rows}

    skipped_attested: list[str] = []
    regenerated_groups: list[str] = []
    all_days: list[ScheduleDay] = []
    all_krav: list[Bemanningskrav] = []
    per_group_decisions: dict[str, list[str]] = {}
    templates_by_group: dict[str, dict] = {}
    default_templates = _build_templates([])

    # 4. Generera varje icke-attesterad grupp för sig (deterministiskt, per grupp).
    for g in groups:
        existing = period_by_group.get(g)
        if existing and existing.phase == "attested":
            skipped_attested.append(g)
            continue

        group_emps = emps_by_group.get(g, [])
        if not group_emps:
            continue

        krav = await _load_krav(db, g, req.year, req.month)
        shift_configs = await _load_shift_configs(db, g)
        templates_by_group[g] = _build_templates(shift_configs)

        sched_days, stats = generate_schedule(group_emps, krav, period_start, period_end, shift_configs)
        all_days.extend(sched_days)
        all_krav.extend(krav)
        per_group_decisions[g] = list(stats.get("decisions", []))
        regenerated_groups.append(g)

    # 5. Globalt inlåningspass över hela bilden.
    borrow = run_global_borrowing(
        all_days, employees_by_id, all_krav, templates_by_group, default_templates
    )

    # 6. Global validering = beviset (0 hårda fel om allt håller).
    all_employees = list(employees_by_id.values())
    validation = validate_schedule(all_days, all_employees, all_krav)
    hard_errors = sum(1 for e in validation.errors if e.severity == "hard")

    # 7. Persistens: spara varje regenererad grupps EGNA dagar (hemgrupp) till dess period.
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    gen_log = f"[{timestamp_str}] Globalt schema genererat av {current_user.full_name or current_user.username}."

    results: list[GroupResult] = []
    for g in regenerated_groups:
        own_days = [sd for sd in all_days if str(employees_by_id[sd.employee_id].group) == g]
        own_serialized = [_schedule_day_to_dict(sd) for sd in own_days]

        new_decisions = [gen_log] + per_group_decisions.get(g, []) + borrow.by_group.get(g, [])

        existing = period_by_group.get(g)
        if existing:
            existing.schedule = own_serialized
            existing.decisions = list(existing.decisions or []) + new_decisions
            existing.phase = "correction"
        else:
            db.add(SchedulePeriodRow(
                group_name=g,
                year=req.year,
                month=req.month,
                phase="correction",
                schedule=own_serialized,
                decisions=new_decisions,
            ))

        shifts = sum(1 for sd in own_days if sd.shift and not sd.shift.is_unbooked)
        obokad = sum(1 for sd in own_days if sd.shift and sd.shift.is_unbooked)
        results.append(GroupResult(
            group=g,
            shifts=shifts,
            obokad=obokad,
            coverage_warnings=borrow.unfilled_by_group.get(g, 0),
        ))

    await db.commit()

    return GenerateAllResponse(
        year=req.year,
        month=req.month,
        regenerated=results,
        skipped_attested=skipped_attested,
        loans=borrow.loans,
        unfilled_shortages=borrow.unfilled,
        hard_errors=hard_errors,
    )
