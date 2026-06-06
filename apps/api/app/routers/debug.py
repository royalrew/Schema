# -*- coding: utf-8 -*-
"""Debug-endpoint — komplett snapshot för felsökning."""
import calendar
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import EmployeeRow, SchedulePeriodRow, StaffingTemplateRow, UserRow, BemanningskravRow
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    SoftConstraint, WishShiftEntry, ShiftType, Bemanningskrav,
)
from app.engine.solver import validate_schedule
from app.routers.schedule import _row_to_employee, _dict_to_schedule_day

router = APIRouter(prefix="/api/debug", tags=["debug"])


@router.get("/{group}/{year}/{month}")
async def debug_snapshot(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Returnerar komplett debug-snapshot för en grupp och period."""

    # Anställda
    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]

    # Schema
    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == group,
            SchedulePeriodRow.year == year,
            SchedulePeriodRow.month == month,
        )
    )).scalar_one_or_none()

    # Staffing template
    tmpl_row = (await db.execute(
        select(StaffingTemplateRow).where(StaffingTemplateRow.group_name == group)
    )).scalar_one_or_none()

    # Hämta bemanningskrav
    krav_stmt = select(BemanningskravRow).where(
        BemanningskravRow.group_name == group,
        BemanningskravRow.year == year,
        BemanningskravRow.month == month,
    )
    krav_result = await db.execute(krav_stmt)
    krav_row = krav_result.scalar_one_or_none()

    krav = []
    if krav_row and krav_row.requirements:
        krav = [
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
    else:
        # Fallback på standardbehov via template eller default
        if tmpl_row and tmpl_row.per_weekday:
            from app.routers.staffing import DayKrav, StaffingTemplate, _krav_from_template
            tmpl = StaffingTemplate(
                group_name=group,
                per_weekday=[DayKrav(**d) for d in tmpl_row.per_weekday],
            )
            krav = _krav_from_template(tmpl, Group(group), year, month)
        else:
            from app.routers.staffing import _default_krav
            krav = _default_krav(Group(group), year, month)

    schedule_days = []
    validation_result = None
    stats = {}

    if period_row and period_row.schedule:
        try:
            schedule_days = [_dict_to_schedule_day(sd) for sd in period_row.schedule]
            validation_result = validate_schedule(schedule_days, employees, krav)
        except Exception as e:
            stats["validation_error"] = str(e)

    # Beräkna timsaldo per anställd
    _, last_day = calendar.monthrange(year, month)
    weeks = last_day / 7

    WEEKLY_HOURS = {
        "dagtid": 40.0, "varierande": 37.0, "kval": 30.0,
        "helg_fre_son": 26.0, "helg_lor_man": 26.0, "natt": 34.33,
    }

    emp_summary = []
    for emp in employees:
        target_h = WEEKLY_HOURS.get(emp.contract_type.value, 37.0) * weeks
        actual_h = 0.0
        helger = 0
        for sd in schedule_days:
            if sd.employee_id != emp.id or not sd.shift:
                continue
            if not sd.shift.is_unbooked:
                for seg in sd.shift.segments:
                    actual_h += (seg.end_time - seg.start_time).total_seconds() / 3600
            d = sd.date
            if d.weekday() >= 5 and not sd.shift.is_unbooked:
                helger += 1

        emp_summary.append({
            "id": emp.id,
            "name": emp.name,
            "contract_type": emp.contract_type.value,
            "is_dagansvarig": getattr(emp, "is_dagansvarig", False),
            "absences_count": len(emp.absences),
            "soft_constraints_count": len(emp.soft_constraints),
            "wish_schedule_count": len(emp.wish_schedule),
            "vetos": [v.isoformat() for v in emp.vetos],
            "hours": {
                "actual": round(actual_h, 1),
                "target": round(target_h, 1),
                "delta": round(actual_h - target_h, 1),
                "pct": round((actual_h / target_h * 100) if target_h > 0 else 0, 1),
            },
            "helger": helger,
        })

    # Daglig bemanning
    daily = []
    for d_num in range(1, last_day + 1):
        d = date(year, month, d_num)
        datestr = d.isoformat()
        dag_count = kval_count = natt_count = 0
        has_tidig = False
        has_lang = False
        for sd in schedule_days:
            if sd.date != d or not sd.shift or sd.shift.is_unbooked:
                continue
            t = sd.shift.shift_type
            if t in (ShiftType.DAG, ShiftType.DAG_TIDIG):
                dag_count += 1
            if t == ShiftType.DAG_TIDIG:
                has_tidig = True
            if t in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG):
                kval_count += 1
            if t == ShiftType.KVAL_LANG:
                has_lang = True
            if t == ShiftType.NATT:
                natt_count += 1

        flags = []
        if not has_tidig:
            flags.append("SAKNAR_06:45")
        if kval_count > 0 and not has_lang:
            flags.append("SAKNAR_21:30")

        daily.append({
            "date": datestr,
            "weekday": ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"][d.weekday()],
            "fm": dag_count,
            "kval": kval_count,
            "natt": natt_count,
            "flags": flags,
        })

    # Valideringsfel
    hard_errors = []
    soft_warnings = []
    if validation_result:
        for e in validation_result.errors:
            entry = {
                "rule": e.rule_name,
                "employee_id": e.employee_id,
                "date": e.date.isoformat(),
                "message": e.message,
            }
            if e.severity == "hard":
                hard_errors.append(entry)
            else:
                soft_warnings.append(entry)

    return {
        "meta": {
            "group": group,
            "year": year,
            "month": month,
            "phase": period_row.phase if period_row else "ingen period",
            "has_schedule": bool(period_row and period_row.schedule),
            "employee_count": len(employees),
            "scheduled_days": len(schedule_days),
        },
        "staffing_template": {
            "per_weekday": tmpl_row.per_weekday if tmpl_row else None,
            "note": "Ingen mall — använder standardvärden (2+2)" if not tmpl_row else None,
        },
        "employees": emp_summary,
        "daily_staffing": daily,
        "validation": {
            "is_valid": validation_result.is_valid if validation_result else None,
            "hard_errors_count": len(hard_errors),
            "soft_warnings_count": len(soft_warnings),
            "hard_errors": hard_errors,
            "soft_warnings": [w for w in soft_warnings if w["rule"] not in ("dag_tidig_saknas", "kval_lang_saknas")],
            "coverage_warnings": [w for w in soft_warnings if w["rule"] in ("dag_tidig_saknas", "kval_lang_saknas")],
        },
    }
