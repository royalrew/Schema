# -*- coding: utf-8 -*-
"""
Autokorrigering av kända schema-problem.
Utför riktade fixar utan att regenerera hela schemat.
"""
import copy
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import EmployeeRow, SchedulePeriodRow, UserRow
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    SoftConstraint, WishShiftEntry, Shift, ShiftSegment, ShiftType,
)
from app.engine.solver import validate_schedule
from app.routers.schedule import _row_to_employee, _dict_to_schedule_day, _schedule_day_to_dict

STOCKHOLM = ZoneInfo("Europe/Stockholm")
router = APIRouter(prefix="/api/autocorrect", tags=["autocorrect"])


class FixResult(BaseModel):
    fixed: int
    description: str
    hard_errors_after: int


def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def _simulate_dag_tidig(
    schedule: list[dict],
    target_date: date,
    employees: list[Employee],
    force_employee_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """
    Simulerar tillsättning av DAG_TIDIG på target_date utan att spara till DB.
    Returnerar (modifierat schema, vald emp_id) eller (oförändrat schema, None) om ingen kandidat finns.
    """
    schedule = copy.deepcopy(schedule)

    sched_idx: dict[tuple, int] = {}
    for i, sd in enumerate(schedule):
        sched_idx[(sd["employee_id"], sd["date"])] = i

    datestr = target_date.isoformat()

    has_tidig = any(
        schedule[sched_idx[(e.id, datestr)]].get("shift", {}).get("shift_type") == "dag_tidig"
        for e in employees
        if (e.id, datestr) in sched_idx
    )
    if has_tidig:
        return schedule, None

    helger_count: dict[str, int] = {e.id: 0 for e in employees}
    for sd in schedule:
        shift = sd.get("shift")
        if shift and not shift.get("is_unbooked"):
            d = date.fromisoformat(sd["date"])
            if _is_weekend(d):
                helger_count[sd["employee_id"]] = helger_count.get(sd["employee_id"], 0) + 1

    if force_employee_id:
        candidates = [e for e in employees if e.id == force_employee_id]
    else:
        candidates = []
        for emp in employees:
            if emp.contract_type != ContractType.VARIERANDE:
                continue
            idx = sched_idx.get((emp.id, datestr))
            if idx is not None:
                sd = schedule[idx]
                if sd.get("shift"):
                    continue
                if sd.get("absence"):
                    continue
            is_we = _is_weekend(target_date)
            if is_we and helger_count.get(emp.id, 0) >= 3:
                continue
            candidates.append(emp)
        candidates.sort(key=lambda e: helger_count.get(e.id, 0))

    if not candidates:
        return schedule, None

    chosen = candidates[0]
    start_dt = datetime(target_date.year, target_date.month, target_date.day, 6, 45, tzinfo=STOCKHOLM)
    end_dt = datetime(target_date.year, target_date.month, target_date.day, 16, 0, tzinfo=STOCKHOLM)
    shift_data = {
        "shift_type": "dag_tidig",
        "segments": [{"start_time": start_dt.isoformat(), "end_time": end_dt.isoformat()}],
        "is_unbooked": False,
        "note": "Autokorrigerad — 06:45-täckning",
    }

    key = (chosen.id, datestr)
    if key in sched_idx:
        schedule[sched_idx[key]] = {**schedule[sched_idx[key]], "shift": shift_data}
    else:
        schedule.append({"date": datestr, "employee_id": chosen.id, "shift": shift_data, "absence": None})

    return schedule, chosen.id


@router.post("/{group}/{year}/{month}/dag-tidig", response_model=FixResult)
async def fix_dag_tidig(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Fixar dagar som saknar 06:45-personal.
    Hittar den mest lämpliga tillgängliga VARIERANDE-personen och lägger DAG_TIDIG.
    """
    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == group,
            SchedulePeriodRow.year == year,
            SchedulePeriodRow.month == month,
        )
    )).scalar_one_or_none()

    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema att korrigera")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]

    # Index: (emp_id, date_str) → schedule_day_dict
    schedule = list(period_row.schedule)
    sched_idx: dict[tuple, dict] = {}
    for sd in schedule:
        sched_idx[(sd["employee_id"], sd["date"])] = sd

    # Helger per person
    helger_count: dict[str, int] = {e.id: 0 for e in employees}
    for sd in schedule:
        shift = sd.get("shift")
        if shift and not shift.get("is_unbooked"):
            d = date.fromisoformat(sd["date"])
            if _is_weekend(d):
                helger_count[sd["employee_id"]] = helger_count.get(sd["employee_id"], 0) + 1

    # Hitta dagar utan DAG_TIDIG
    from calendar import monthrange
    _, last = monthrange(year, month)
    days = [date(year, month, d) for d in range(1, last + 1)]

    fixed = 0
    for d in days:
        datestr = d.isoformat()
        has_tidig = any(
            sched_idx.get((e.id, datestr), {}).get("shift", {}).get("shift_type") == "dag_tidig"
            for e in employees
        )
        if has_tidig:
            continue

        # Hitta kandidat: VARIERANDE, tillgänglig, minst helger
        candidates = []
        for emp in employees:
            if emp.contract_type != ContractType.VARIERANDE:
                continue
            sd = sched_idx.get((emp.id, datestr), {})
            # Redan schemalagd denna dag?
            if sd.get("shift"):
                continue
            # Frånvaro?
            if sd.get("absence"):
                continue
            # Veto?
            if datestr in [v for v in (sd.get("vetos") or [])]:
                continue
            # Helger-kontroll (max 2 för varierande, men vi tillåter upp till 3 om inga andra alternativ)
            is_we = _is_weekend(d)
            if is_we and helger_count.get(emp.id, 0) >= 3:
                continue
            candidates.append(emp)

        if not candidates:
            continue

        # Välj den med minst helger (rättvisast)
        candidates.sort(key=lambda e: helger_count.get(e.id, 0))
        chosen = candidates[0]

        # Skapa DAG_TIDIG-pass
        start_dt = datetime(d.year, d.month, d.day, 6, 45, tzinfo=STOCKHOLM)
        end_dt = datetime(d.year, d.month, d.day, 16, 0, tzinfo=STOCKHOLM)
        shift_data = {
            "shift_type": "dag_tidig",
            "segments": [
                {"start_time": start_dt.isoformat(), "end_time": end_dt.isoformat()}
            ],
            "is_unbooked": False,
            "note": "Autokorrigerad — 06:45-täckning"
        }

        # Uppdatera eller lägg till i schemat
        key = (chosen.id, datestr)
        if key in sched_idx:
            sched_idx[key]["shift"] = shift_data
        else:
            new_sd = {"date": datestr, "employee_id": chosen.id, "shift": shift_data, "absence": None}
            sched_idx[key] = new_sd
            schedule.append(new_sd)

        if _is_weekend(d):
            helger_count[chosen.id] = helger_count.get(chosen.id, 0) + 1
        fixed += 1

    # Validera och spara
    try:
        schedule_days = [_dict_to_schedule_day(sd) for sd in schedule]
        validation = validate_schedule(schedule_days, employees)
        hard_errors = sum(1 for e in validation.errors if e.severity == "hard")
    except Exception:
        hard_errors = -1

    desc = f"Lade till DAG_TIDIG på {fixed} dag{'ar' if fixed != 1 else ''} som saknade 06:45-personal."
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    log_entry = f"[{timestamp_str}] Autokorrigering utförd av {current_user.full_name or current_user.username}: {desc}"

    current_decisions = list(period_row.decisions or [])
    current_decisions.append(log_entry)
    period_row.decisions = current_decisions

    period_row.schedule = schedule
    await db.commit()

    return FixResult(
        fixed=fixed,
        description=desc,
        hard_errors_after=hard_errors,
    )
