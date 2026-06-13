# -*- coding: utf-8 -*-
"""
AI-lager för varningshantering.
Förklarar valideringsvarningar på svenska och föreslår deterministiska fixar med look-ahead.
"""
import json
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from app.database import get_db
from app.db_models import (
    EmployeeRow, SchedulePeriodRow, UserRow, BemanningskravRow, StaffingTemplateRow, ShiftConfigRow,
)
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    SoftConstraint, WishShiftEntry, Bemanningskrav, ScheduleDay, ShiftType,
)
from app.engine.solver import validate_schedule
from app.engine.generator import _build_templates, _make_shift
from app.engine.planner import plan_fixes, apply_steps
from app.routers.schedule import _row_to_employee, _dict_to_schedule_day, _schedule_day_to_dict
from app.routers.autocorrect import _simulate_dag_tidig, _simulate_timbalans
from app.routers.staffing import _default_krav, _krav_from_template

router = APIRouter(prefix="/api/ai", tags=["ai"])
STOCKHOLM = ZoneInfo("Europe/Stockholm")

# Mappning: rule_name → fix_type
_FIX_TYPE_MAP = {
    "dag_tidig_saknas": "dag_tidig",
    "kval_lang_saknas": "kval_lang",
    "timbalans_underskott": "timbalans",
}


class WarningInput(BaseModel):
    rule_name: str
    employee_id: str
    date: str        # ISO-datum
    message: str
    severity: str


class ExplainRequest(BaseModel):
    group: str
    year: int
    month: int
    warning: WarningInput


class SideEffect(BaseModel):
    date: str
    message: str


class ExplainResponse(BaseModel):
    explanation: str
    fix_type: str            # "dag_tidig" | "timbalans" | "manual"
    fix_possible: bool
    fix_summary: str | None   # Kort beskrivning av föreslagen åtgärd
    affected_employee_id: str | None
    affected_employee_name: str | None
    affected_date: str
    side_effects: list[SideEffect]


class ApplyFixRequest(BaseModel):
    group: str
    year: int
    month: int
    fix_type: str
    affected_employee_id: str
    affected_date: str       # ISO-datum


class ApplyFixResponse(BaseModel):
    ok: bool
    message: str


class ScenarioRequest(BaseModel):
    group: str
    year: int
    month: int
    employee_id: str
    date: str
    desired_shift: str  # DAG | KVAL | LEDIG | dag | dag_tidig | kval_kort | kval_lang


class ScenarioRuleChange(BaseModel):
    rule_name: str
    severity: str
    date: str
    employee_id: str
    message: str


class ScenarioResponse(BaseModel):
    verdict: str
    score: int
    employee_id: str
    employee_name: str
    date: str
    desired_shift: str
    direct: list[str]
    chain: list[str]
    risks: list[str]
    decisionLog: list[str]
    new_errors: list[ScenarioRuleChange]
    resolved_errors: list[ScenarioRuleChange]
    hard_errors_before: int
    hard_errors_after: int
    soft_warnings_before: int
    soft_warnings_after: int


class WishReportRequest(BaseModel):
    year: int
    month: int
    group: str | None = None  # None = alla grupper


class WishReportItem(BaseModel):
    employee_id: str
    employee_name: str
    group: str
    date: str
    desired: str
    actual: str
    fulfilled: bool
    reason: str


class WishReportGroup(BaseModel):
    group: str
    total_wishes: int
    fulfilled: int
    unfulfilled: int
    fulfillment_rate: float


class WishReportResponse(BaseModel):
    year: int
    month: int
    group: str | None
    total_wishes: int
    fulfilled: int
    unfulfilled: int
    fulfillment_rate: float
    items: list[WishReportItem]
    summary: list[str]
    group_breakdown: list[WishReportGroup] = []
    blocker_counts: dict[str, int] = {}


class StaffingReportRequest(BaseModel):
    year: int
    month: int
    group: str | None = None


class StaffingReportRow(BaseModel):
    group: str
    date: str
    slot: str
    required: int
    staffed: int
    diff: int
    status: str


class StaffingReportResponse(BaseModel):
    year: int
    month: int
    group: str | None
    rows: list[StaffingReportRow]
    total_required: int
    total_staffed: int
    shortage_slots: int
    surplus_slots: int
    ok_slots: int
    summary: list[str]


class FairnessReportRequest(BaseModel):
    year: int
    month: int
    group: str | None = None
    agent: str = "rattviseagent_0645"


class FairnessReportProposal(BaseModel):
    agent: str
    group: str
    date: str
    from_employee_id: str
    from_employee_name: str
    to_employee_id: str
    to_employee_name: str
    action: str
    reason: str
    proof: str
    effect: str
    status: str
    hard_errors_before: int
    hard_errors_after: int


class FairnessReportResponse(BaseModel):
    year: int
    month: int
    group: str | None
    agent: str
    proposals: list[FairnessReportProposal]
    can_apply: int
    stopped: int
    summary: list[str]


def _error_key(err) -> tuple[str, str, str]:
    return (err.date.isoformat(), err.rule_name, err.employee_id or "")


def _error_to_scenario(err) -> ScenarioRuleChange:
    return ScenarioRuleChange(
        rule_name=err.rule_name,
        severity=err.severity,
        date=err.date.isoformat(),
        employee_id=err.employee_id or "",
        message=err.message,
    )


def _scenario_shift_type(value: str) -> ShiftType | None:
    normalized = value.strip().lower()
    aliases = {
        "dag": ShiftType.DAG,
        "dag_tidig": ShiftType.DAG_TIDIG,
        "dagtidig": ShiftType.DAG_TIDIG,
        "kval": ShiftType.KVAL_KORT,
        "kväll": ShiftType.KVAL_KORT,
        "kvall": ShiftType.KVAL_KORT,
        "kval_kort": ShiftType.KVAL_KORT,
        "kval_lang": ShiftType.KVAL_LANG,
        "kväll_lång": ShiftType.KVAL_LANG,
        "ledig": None,
    }
    if normalized.upper() in ("DAG", "KVAL", "LEDIG"):
        return aliases[normalized]
    if normalized in aliases:
        return aliases[normalized]
    return ShiftType(normalized)


def _shift_label(shift_type: ShiftType | None) -> str:
    if shift_type is None:
        return "ledig"
    labels = {
        ShiftType.DAG_TIDIG: "dag tidig",
        ShiftType.DAG: "dag",
        ShiftType.KVAL_KORT: "kväll kort",
        ShiftType.KVAL_LANG: "kväll lång",
        ShiftType.NATT: "natt",
        ShiftType.OBOKAD: "obokad",
        ShiftType.APT: "APT",
        ShiftType.KONTORSTID: "kontorstid",
        ShiftType.PLANERINGSTID: "planeringstid",
        ShiftType.DELAD_TUR: "delad tur",
    }
    return labels.get(shift_type, shift_type.value)


def _wish_category(shift_type: str | None) -> str:
    if shift_type is None:
        return "ledig"
    val = str(shift_type).lower()
    if val in {"dag", "dag_tidig"}:
        return "dag"
    if val in {"kval", "kval_kort", "kval_lang"}:
        return "kväll"
    return val


def _actual_category(day: ScheduleDay | None) -> str:
    if not day or not day.shift:
        return "ledig"
    return _wish_category(day.shift.shift_type.value)


def _staffing_slot(shift_type: ShiftType | None) -> str | None:
    if shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG):
        return "FM"
    if shift_type == ShiftType.DELAD_TUR:
        return "EM"
    if shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG, ShiftType.APT):
        return "Kväll"
    if shift_type == ShiftType.NATT:
        return "Natt"
    return None


def _wish_fulfilled(desired: str, actual: str) -> bool:
    if desired == "ledig":
        return actual == "ledig"
    return desired == actual


def _wish_reason(emp: Employee, d: date, desired: str, actual: str, fulfilled: bool) -> str:
    if fulfilled:
        return "Önskemålet uppfylldes."
    if d in emp.vetos and actual != "ledig":
        return "Veto bröts i schemat och behöver kontrolleras."
    if any(a.date == d for a in emp.absences):
        return "Medarbetaren hade registrerad frånvaro den dagen."
    if desired == "ledig":
        return f"Önskade ledigt men fick {actual}."
    if actual == "ledig":
        return f"Önskade {desired} men blev ledig, troligen på grund av bemanning, kontrakt eller vila."
    return f"Önskade {desired} men fick {actual}."


def _wish_blocker(reason: str) -> str:
    lower = reason.lower()
    if "veto" in lower:
        return "Veto"
    if "frånvaro" in lower:
        return "Frånvaro"
    if "bemanning" in lower or "kontrakt" in lower or "vila" in lower:
        return "Bemanning/regler"
    if "ledig" in lower:
        return "Ledig i schema"
    if "fick" in lower:
        return "Annat pass"
    return "Oklar orsak"


@router.post("/wish-report", response_model=WishReportResponse)
async def wish_report(
    req: WishReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Rapport över vilka önskemål som uppfylldes eller inte efter schemagenerering."""
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"

    emp_stmt = select(EmployeeRow)
    if req.group:
        emp_stmt = emp_stmt.where(EmployeeRow.group_name == req.group)
    emp_rows = (await db.execute(emp_stmt)).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    emp_by_id = {emp.id: emp for emp in employees}

    period_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.year == req.year,
        SchedulePeriodRow.month == req.month,
    )
    if req.group:
        period_stmt = period_stmt.where(SchedulePeriodRow.group_name == req.group)
    period_rows = (await db.execute(period_stmt)).scalars().all()

    schedule_index: dict[tuple[str, str], ScheduleDay] = {}
    for row in period_rows:
        for sd in row.schedule or []:
            try:
                day = _dict_to_schedule_day(sd)
                schedule_index[(day.employee_id, day.date.isoformat())] = day
            except Exception:
                continue

    items: list[WishReportItem] = []
    seen: set[tuple[str, str]] = set()
    for emp in employees:
        for wish in emp.wish_schedule:
            try:
                d = date.fromisoformat(wish.date)
            except ValueError:
                continue
            if d.year != req.year or d.month != req.month:
                continue
            key = (emp.id, d.isoformat())
            seen.add(key)
            desired = _wish_category(wish.shift_type if wish.start_time else None)
            actual_day = schedule_index.get(key)
            actual = _actual_category(actual_day)
            fulfilled = _wish_fulfilled(desired, actual)
            items.append(WishReportItem(
                employee_id=emp.id,
                employee_name=emp.name,
                group=emp.group.value,
                date=d.isoformat(),
                desired=desired,
                actual=actual,
                fulfilled=fulfilled,
                reason=_wish_reason(emp, d, desired, actual, fulfilled),
            ))

        for d in emp.wishes:
            if d.year != req.year or d.month != req.month:
                continue
            key = (emp.id, d.isoformat())
            if key in seen:
                continue
            desired = "arbeta"
            actual_day = schedule_index.get(key)
            actual = _actual_category(actual_day)
            fulfilled = actual != "ledig"
            items.append(WishReportItem(
                employee_id=emp.id,
                employee_name=emp.name,
                group=emp.group.value,
                date=d.isoformat(),
                desired=desired,
                actual=actual,
                fulfilled=fulfilled,
                reason="Önskade att arbeta och fick pass." if fulfilled else "Önskade att arbeta men blev ledig.",
            ))

    total = len(items)
    fulfilled_count = sum(1 for item in items if item.fulfilled)
    unfulfilled_count = total - fulfilled_count
    rate = round((fulfilled_count / total) * 100, 1) if total else 100.0

    by_group: dict[str, tuple[int, int]] = {}
    blocker_counts: dict[str, int] = {}
    for item in items:
        f, t = by_group.get(item.group, (0, 0))
        by_group[item.group] = (f + (1 if item.fulfilled else 0), t + 1)
        if not item.fulfilled:
            blocker = _wish_blocker(item.reason)
            blocker_counts[blocker] = blocker_counts.get(blocker, 0) + 1

    group_breakdown = [
        WishReportGroup(
            group=group,
            total_wishes=total_for_group,
            fulfilled=fulfilled_for_group,
            unfulfilled=total_for_group - fulfilled_for_group,
            fulfillment_rate=round((fulfilled_for_group / total_for_group) * 100, 1) if total_for_group else 100.0,
        )
        for group, (fulfilled_for_group, total_for_group) in sorted(by_group.items())
    ]

    summary = [
        f"{fulfilled_count} av {total} önskemål uppfylldes ({rate}%).",
        f"{unfulfilled_count} önskemål behöver förklaras eller hanteras manuellt.",
    ]
    if not req.group and by_group:
        worst = sorted(by_group.items(), key=lambda kv: (kv[1][0] / kv[1][1]) if kv[1][1] else 1.0)[0]
        wf, wt = worst[1]
        summary.append(f"Lägst uppfyllnad just nu: {worst[0]} ({wf}/{wt}).")

    return WishReportResponse(
        year=req.year,
        month=req.month,
        group=req.group,
        total_wishes=total,
        fulfilled=fulfilled_count,
        unfulfilled=unfulfilled_count,
        fulfillment_rate=rate,
        items=items,
        summary=summary,
        group_breakdown=group_breakdown,
        blocker_counts=dict(sorted(blocker_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
    )


@router.post("/staffing-report", response_model=StaffingReportResponse)
async def staffing_report(
    req: StaffingReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Tabellrapport för bemanning. Frontend ska bara rita dessa färdigräknade rader."""
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"

    emp_stmt = select(EmployeeRow)
    emp_rows = (await db.execute(emp_stmt)).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    emp_by_id = {emp.id: emp for emp in employees}

    available_groups = sorted({emp.group.value for emp in employees})
    groups = [req.group] if req.group else available_groups

    period_rows = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalars().all()

    staffed: dict[tuple[str, str, str], int] = {}
    for period in period_rows:
        for raw_day in period.schedule or []:
            try:
                day = _dict_to_schedule_day(raw_day)
            except Exception:
                continue
            emp = emp_by_id.get(day.employee_id)
            if not emp or not day.shift or day.shift.is_unbooked:
                continue
            actual_group = day.assigned_group or emp.group.value
            if req.group and actual_group != req.group:
                continue
            slot = _staffing_slot(day.shift.shift_type)
            if not slot:
                continue
            key = (actual_group, day.date.isoformat(), slot)
            staffed[key] = staffed.get(key, 0) + 1

    rows: list[StaffingReportRow] = []
    slot_fields = [
        ("FM", "fm_heads"),
        ("EM", "em_heads"),
        ("Kväll", "kval_heads"),
        ("Natt", "natt_heads"),
    ]
    for group in groups:
        if not group:
            continue
        krav_rows = await _load_krav(db, group, req.year, req.month)
        for krav in sorted(krav_rows, key=lambda item: item.date):
            for slot, field in slot_fields:
                required = int(getattr(krav, field, 0) or 0)
                actual = staffed.get((group, krav.date.isoformat(), slot), 0)
                diff = actual - required
                status = "brist" if diff < 0 else "överskott" if diff > 0 else "ok"
                if required == 0 and actual == 0:
                    continue
                rows.append(StaffingReportRow(
                    group=group,
                    date=krav.date.isoformat(),
                    slot=slot,
                    required=required,
                    staffed=actual,
                    diff=diff,
                    status=status,
                ))

    total_required = sum(row.required for row in rows)
    total_staffed = sum(row.staffed for row in rows)
    shortage_slots = sum(1 for row in rows if row.diff < 0)
    surplus_slots = sum(1 for row in rows if row.diff > 0)
    ok_slots = sum(1 for row in rows if row.diff == 0)
    summary = [
        f"{ok_slots} passrader matchar bemanningskravet exakt.",
        f"{shortage_slots} passrader har brist och behöver åtgärd eller vikarie.",
        f"{surplus_slots} passrader har fler bemannade än krav.",
    ]

    return StaffingReportResponse(
        year=req.year,
        month=req.month,
        group=req.group,
        rows=rows,
        total_required=total_required,
        total_staffed=total_staffed,
        shortage_slots=shortage_slots,
        surplus_slots=surplus_slots,
        ok_slots=ok_slots,
        summary=summary,
    )


@router.post("/fairness-report", response_model=FairnessReportResponse)
async def fairness_report(
    req: FairnessReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Rapport för 06:45-rättvisa. Skriver aldrig schema, returnerar bara motorvaliderade bevisrader."""
    if req.agent != "rattviseagent_0645":
        raise HTTPException(status_code=422, detail="Endast rattviseagent_0645 stöds i första dry-run-versionen.")
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"

    emp_stmt = select(EmployeeRow)
    if req.group:
        emp_stmt = emp_stmt.where(EmployeeRow.group_name == req.group)
    emp_rows = (await db.execute(emp_stmt)).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    employees_by_group: dict[str, list[Employee]] = {}
    for emp in employees:
        employees_by_group.setdefault(emp.group.value, []).append(emp)

    period_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.year == req.year,
        SchedulePeriodRow.month == req.month,
    )
    if req.group:
        period_stmt = period_stmt.where(SchedulePeriodRow.group_name == req.group)
    period_rows = (await db.execute(period_stmt)).scalars().all()

    proposals: list[FairnessReportProposal] = []
    for period in period_rows:
        group = period.group_name
        group_employees = employees_by_group.get(group, [])
        if not group_employees or not period.schedule:
            continue
        emp_by_id = {emp.id: emp for emp in group_employees}
        days = []
        for raw_day in period.schedule or []:
            try:
                day = _dict_to_schedule_day(raw_day)
            except Exception:
                continue
            if day.employee_id in emp_by_id and not day.assigned_group:
                days.append(day)

        if not days:
            continue

        early_counts = {emp.id: 0 for emp in group_employees}
        for day in days:
            if day.shift and day.shift.shift_type == ShiftType.DAG_TIDIG:
                early_counts[day.employee_id] = early_counts.get(day.employee_id, 0) + 1

        ordered_pairs = sorted(
            [
                (from_id, to_id, early_counts[from_id] - early_counts[to_id])
                for from_id in early_counts
                for to_id in early_counts
                if from_id != to_id and early_counts[from_id] - early_counts[to_id] > 1
            ],
            key=lambda item: (-item[2], emp_by_id[item[0]].name, emp_by_id[item[1]].name),
        )
        if not ordered_pairs:
            continue

        krav = await _load_krav(db, group, req.year, req.month)
        before_validation = validate_schedule(days, group_employees, krav)
        hard_before = sum(1 for err in before_validation.errors if err.severity == "hard")
        day_index = {(day.employee_id, day.date.isoformat()): idx for idx, day in enumerate(days)}

        for from_id, to_id, gap in ordered_pairs:
            if len([p for p in proposals if p.group == group]) >= 5:
                break
            candidate_dates = sorted(
                day.date
                for day in days
                if day.employee_id == from_id
                and day.shift
                and day.shift.shift_type == ShiftType.DAG_TIDIG
                and (to_id, day.date.isoformat()) in day_index
                and days[day_index[(to_id, day.date.isoformat())]].shift
                and days[day_index[(to_id, day.date.isoformat())]].shift.shift_type == ShiftType.DAG
            )
            for target_date in candidate_dates:
                trial = [day.model_copy(deep=True) for day in days]
                from_idx = day_index[(from_id, target_date.isoformat())]
                to_idx = day_index[(to_id, target_date.isoformat())]
                trial[from_idx].shift, trial[to_idx].shift = trial[to_idx].shift, trial[from_idx].shift
                after_validation = validate_schedule(trial, group_employees, krav)
                hard_after = sum(1 for err in after_validation.errors if err.severity == "hard")
                can_apply = hard_after <= hard_before
                from_emp = emp_by_id[from_id]
                to_emp = emp_by_id[to_id]
                proposals.append(FairnessReportProposal(
                    agent="Rättviseagent 06:45",
                    group=group,
                    date=target_date.isoformat(),
                    from_employee_id=from_id,
                    from_employee_name=from_emp.name,
                    to_employee_id=to_id,
                    to_employee_name=to_emp.name,
                    action=f"Byt 06:45-pass från {from_emp.name} till {to_emp.name}.",
                    reason=f"{from_emp.name} har {early_counts[from_id]} 06:45-pass och {to_emp.name} har {early_counts[to_id]}.",
                    proof="Motorvaliderat: inga nya hårda regelbrott." if can_apply else "Stoppad av regelmotorn: bytet skapar hårt regelbrott.",
                    effect=f"06:45-gap minskar från {gap} till {gap - 2}.",
                    status="kan appliceras" if can_apply else "stoppad",
                    hard_errors_before=hard_before,
                    hard_errors_after=hard_after,
                ))
                break

    can_apply_count = sum(1 for proposal in proposals if proposal.status == "kan appliceras")
    stopped_count = len(proposals) - can_apply_count
    summary = [
        f"Rättviseagenten hittade {len(proposals)} möjliga 06:45-byte.",
        f"{can_apply_count} byte kan appliceras enligt regelmotorn.",
        f"{stopped_count} byte stoppades eller behöver annan lösning.",
    ]
    return FairnessReportResponse(
        year=req.year,
        month=req.month,
        group=req.group,
        agent=req.agent,
        proposals=proposals,
        can_apply=can_apply_count,
        stopped=stopped_count,
        summary=summary,
    )


@router.post("/scenario", response_model=ScenarioResponse)
async def scenario_analysis(
    req: ScenarioRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Simulerar en enskild ändring i minnet och visar regel-/kedjeeffekt utan att spara."""
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"

    target_date = date.fromisoformat(req.date)
    if target_date.year != req.year or target_date.month != req.month:
        raise HTTPException(status_code=400, detail="Datumet ligger inte i vald schemaperiod")

    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == req.group,
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalar_one_or_none()
    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema genererat för denna period")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == req.group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    emp_map = {e.id: e for e in employees}
    employee = emp_map.get(req.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Medarbetaren hittades inte i gruppen")

    desired_shift = _scenario_shift_type(req.desired_shift)
    krav = await _load_krav(db, req.group, req.year, req.month)
    schedule = list(period_row.schedule or [])

    before_days = [_dict_to_schedule_day(sd) for sd in schedule]
    before_val = validate_schedule(before_days, employees, krav)

    existing = next(
        (
            _dict_to_schedule_day(sd)
            for sd in schedule
            if sd.get("employee_id") == req.employee_id and sd.get("date") == req.date
        ),
        None,
    )

    cfg_rows = (await db.execute(
        select(ShiftConfigRow).where(
            (ShiftConfigRow.group_name == req.group) | ShiftConfigRow.group_name.is_(None)
        )
    )).scalars().all()
    seen: dict[str, dict] = {}
    for r in sorted(cfg_rows, key=lambda x: (x.group_name is None)):
        seen[r.shift_type] = {
            "shift_type": r.shift_type,
            "start_time": r.start_time,
            "end_time": r.end_time,
        }
    templates = _build_templates(list(seen.values()))

    new_shift = _make_shift(desired_shift, target_date, templates, employee) if desired_shift else None
    simulated_day = ScheduleDay(
        date=target_date,
        employee_id=req.employee_id,
        shift=new_shift,
        absence=existing.absence if existing and desired_shift is None else None,
        assigned_group=existing.assigned_group if existing else None,
        note=f"Scenario: {employee.name} önskar {_shift_label(desired_shift)}",
    )
    simulated_day_dict = _schedule_day_to_dict(simulated_day)

    simulated = list(schedule)
    found_idx = -1
    for idx, sd in enumerate(simulated):
        if sd.get("employee_id") == req.employee_id and sd.get("date") == req.date:
            found_idx = idx
            break
    if found_idx >= 0:
        simulated[found_idx] = simulated_day_dict
    else:
        simulated.append(simulated_day_dict)

    after_days = [_dict_to_schedule_day(sd) for sd in simulated]
    after_val = validate_schedule(after_days, employees, krav)

    before_errors = {_error_key(e): e for e in before_val.errors}
    after_errors = {_error_key(e): e for e in after_val.errors}
    new_errors_raw = [e for key, e in after_errors.items() if key not in before_errors]
    resolved_errors_raw = [e for key, e in before_errors.items() if key not in after_errors]

    hard_before = _hard_count(before_val)
    hard_after = _hard_count(after_val)
    soft_before = _soft_count(before_val)
    soft_after = _soft_count(after_val)

    old_label = _shift_label(existing.shift.shift_type) if existing and existing.shift else "ledig"
    new_label = _shift_label(desired_shift)
    direct = [
        f"{employee.name}: {old_label} → {new_label} {req.date}.",
        f"Hårda fel: {hard_before} → {hard_after}. Varningar: {soft_before} → {soft_after}.",
    ]

    chain: list[str] = []
    if resolved_errors_raw:
        for err in resolved_errors_raw[:3]:
            chain.append(f"Löser: {err.message}")
    if new_errors_raw:
        for err in new_errors_raw[:4]:
            prefix = "Stoppar" if err.severity == "hard" else "Följdeffekt"
            chain.append(f"{prefix}: {err.message}")
    if not chain:
        chain.append("Ingen negativ kedjereaktion upptäcktes i regelmotorn.")

    risks: list[str] = []
    for err in new_errors_raw:
        if err.severity == "hard":
            risks.append(f"Hårt regelbrott: {err.message}")
        elif err.rule_name in {"bemanningskrav", "timbemanning"}:
            risks.append(f"Bemanningsrisk: {err.message}")
        else:
            risks.append(err.message)
    if not risks:
        risks.append("Inga nya risker hittades jämfört med nuvarande schema.")

    decision_log = [
        "Scenario kördes i minnet. Inget schema sparades.",
        f"Ändringen testades för {employee.name} den {req.date}.",
        "Regelmotorn validerade dygnsvila, veckovila, kontrakt, bemanning och timsaldo före/efter.",
    ]
    if hard_after > hard_before:
        verdict = "Stoppas av hårda regler"
        score = 20
        decision_log.append("Rekommendation: acceptera inte utan annan kedjelösning.")
    elif soft_after > soft_before:
        verdict = "Möjligt, men skapar följdvarningar"
        score = max(45, 80 - ((soft_after - soft_before) * 10))
        decision_log.append("Rekommendation: låt AI hitta ersättare eller kompenserande flytt.")
    elif soft_after < soft_before:
        verdict = "Bra ändring"
        score = 95
        decision_log.append("Rekommendation: ändringen förbättrar schemat.")
    else:
        verdict = "Möjligt"
        score = 88
        decision_log.append("Rekommendation: ändringen kan göras utan nya regelproblem.")

    return ScenarioResponse(
        verdict=verdict,
        score=score,
        employee_id=req.employee_id,
        employee_name=employee.name,
        date=req.date,
        desired_shift=req.desired_shift,
        direct=direct,
        chain=chain,
        risks=risks,
        decisionLog=decision_log,
        new_errors=[_error_to_scenario(e) for e in new_errors_raw],
        resolved_errors=[_error_to_scenario(e) for e in resolved_errors_raw],
        hard_errors_before=hard_before,
        hard_errors_after=hard_after,
        soft_warnings_before=soft_before,
        soft_warnings_after=soft_after,
    )


@router.post("/explain-warning", response_model=ExplainResponse)
async def explain_warning(
    req: ExplainRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY saknas i miljövariablerna")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == req.group)
    )).scalars().all()
    if not emp_rows:
        raise HTTPException(status_code=404, detail=f"Inga anställda i {req.group}")
    employees = [_row_to_employee(r) for r in emp_rows]
    emp_map = {e.id: e for e in employees}

    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == req.group,
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalar_one_or_none()
    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema genererat för denna period")

    schedule = list(period_row.schedule)
    fix_type = _FIX_TYPE_MAP.get(req.warning.rule_name, "manual")

    # --- Look-ahead: simulera fix ---
    chosen_emp_id: str | None = None
    side_effects: list[SideEffect] = []
    fix_possible = False
    fix_summary: str | None = None
    simulated: list[dict] | None = None

    if fix_type == "dag_tidig":
        target_date = date.fromisoformat(req.warning.date)
        simulated, chosen_emp_id = _simulate_dag_tidig(schedule, target_date, employees)
        if chosen_emp_id:
            fix_possible = True
            name = emp_map[chosen_emp_id].name if chosen_emp_id in emp_map else chosen_emp_id
            fix_summary = f"Tilldela {name} ett 06:45-pass den {req.warning.date}."

    elif fix_type == "timbalans":
        chosen_emp_id = req.warning.employee_id or None
        if chosen_emp_id and chosen_emp_id in emp_map:
            simulated, added_hours = _simulate_timbalans(
                schedule, chosen_emp_id, employees, req.year, req.month,
            )
            if added_hours > 0:
                fix_possible = True
                name = emp_map[chosen_emp_id].name
                fix_summary = (
                    f"Lägg till {added_hours:.0f} h OBOKAD-tid på lediga dagar för {name} "
                    f"så att kontraktstimmarna fylls."
                )
            else:
                chosen_emp_id = None

    # Jämför varningar före/efter för att hitta bieffekter
    if fix_possible and simulated is not None:
        before_days = [_dict_to_schedule_day(sd) for sd in schedule]
        after_days = [_dict_to_schedule_day(sd) for sd in simulated]
        before_warnings = {
            (e.date.isoformat(), e.rule_name, e.employee_id)
            for e in validate_schedule(before_days, employees).errors
        }
        after_validation = validate_schedule(after_days, employees)
        for err in after_validation.errors:
            key = (err.date.isoformat(), err.rule_name, err.employee_id)
            if key not in before_warnings:
                prefix = "⚠ HÅRT FEL: " if err.severity == "hard" else ""
                side_effects.append(SideEffect(date=err.date.isoformat(), message=f"{prefix}{err.message}"))

    affected_emp = emp_map.get(chosen_emp_id) if chosen_emp_id else None

    # --- AI-förklaring ---
    context_lines = [
        f"Varning: {req.warning.message}",
        f"Datum: {req.warning.date}",
        f"Regelnamn: {req.warning.rule_name}",
    ]
    if fix_possible and fix_summary:
        context_lines.append(f"Föreslagen åtgärd: {fix_summary}")
    else:
        context_lines.append("Ingen automatisk åtgärd är möjlig för denna varning.")
    if side_effects:
        context_lines.append("Bieffekter av åtgärden:")
        for se in side_effects:
            context_lines.append(f"  - {se.date}: {se.message}")

    prompt = f"""Du är ett schemaläggningssystem för Töreboda hemvård. Förklara följande varning på enkel, tydlig svenska för en chef utan teknisk bakgrund. Max 3 meningar. Förklara varför varningen uppstod och vad som händer om den åtgärdas.

{chr(10).join(context_lines)}

Svara ENBART med en JSON med nyckeln "explanation" och värdet som en textsträng på svenska."""

    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        explanation = json.loads(raw).get("explanation", req.warning.message)
    except Exception:
        explanation = req.warning.message

    return ExplainResponse(
        explanation=explanation,
        fix_type=fix_type,
        fix_possible=fix_possible,
        fix_summary=fix_summary,
        affected_employee_id=chosen_emp_id,
        affected_employee_name=affected_emp.name if affected_emp else None,
        affected_date=req.warning.date,
        side_effects=side_effects,
    )


@router.post("/apply-fix", response_model=ApplyFixResponse)
async def apply_fix(
    req: ApplyFixRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == req.group,
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalar_one_or_none()
    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema att uppdatera")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == req.group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    emp_map = {e.id: e for e in employees}

    schedule = list(period_row.schedule)

    if req.fix_type == "dag_tidig":
        target_date = date.fromisoformat(req.affected_date)
        new_schedule, chosen_id = _simulate_dag_tidig(
            schedule, target_date, employees,
            force_employee_id=req.affected_employee_id,
        )
        if not chosen_id:
            return ApplyFixResponse(ok=False, message="Kunde inte tilldela passet — kontrollera att personen är tillgänglig.")

        emp_name = emp_map.get(chosen_id, type("x", (), {"name": chosen_id})()).name
        timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
        log_entry = (
            f"[{timestamp_str}] AI-åtgärd godkänd av {current_user.full_name or current_user.username}: "
            f"Tilldelat {emp_name} DAG_TIDIG den {req.affected_date} (06:45-täckning)."
        )
        current_decisions = list(period_row.decisions or [])
        current_decisions.append(log_entry)
        period_row.decisions = current_decisions
        period_row.schedule = new_schedule
        await db.commit()
        return ApplyFixResponse(ok=True, message=f"{emp_name} har tilldelats 06:45-passet den {req.affected_date}.")

    if req.fix_type == "timbalans":
        new_schedule, added = _simulate_timbalans(
            schedule, req.affected_employee_id, employees, req.year, req.month,
        )
        if added <= 0:
            return ApplyFixResponse(ok=False, message="Kunde inte fylla timunderskottet — inga lediga dagar utan att bryta dygnsvila.")

        emp_name = emp_map.get(req.affected_employee_id, type("x", (), {"name": req.affected_employee_id})()).name
        timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
        log_entry = (
            f"[{timestamp_str}] AI-åtgärd godkänd av {current_user.full_name or current_user.username}: "
            f"Lade till {added:.0f} h OBOKAD-tid för {emp_name} för att nå kontraktstimmarna."
        )
        current_decisions = list(period_row.decisions or [])
        current_decisions.append(log_entry)
        period_row.decisions = current_decisions
        period_row.schedule = new_schedule
        await db.commit()
        return ApplyFixResponse(ok=True, message=f"{added:.0f} h OBOKAD-tid tillagd för {emp_name}.")

    return ApplyFixResponse(ok=False, message=f"Fix-typ '{req.fix_type}' stöds inte ännu.")


# ── Flerstegs-åtgärdsplanerare ───────────────────────────────────────────────

async def _load_krav(db: AsyncSession, group: str, year: int, month: int) -> list[Bemanningskrav]:
    """Laddar bemanningskrav för gruppen (samma logik som schedule.get_validation)."""
    krav_row = (await db.execute(
        select(BemanningskravRow).where(
            BemanningskravRow.group_name == group,
            BemanningskravRow.year == year,
            BemanningskravRow.month == month,
        )
    )).scalar_one_or_none()
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
    tmpl_row = (await db.execute(
        select(StaffingTemplateRow).where(StaffingTemplateRow.group_name == group)
    )).scalar_one_or_none()
    if tmpl_row and tmpl_row.per_weekday:
        from app.routers.staffing import DayKrav, StaffingTemplate
        tmpl = StaffingTemplate(
            group_name=group,
            per_weekday=[DayKrav(**d) for d in tmpl_row.per_weekday],
        )
        return _krav_from_template(tmpl, Group(group), year, month)
    return _default_krav(Group(group), year, month)


class PlanFixesRequest(BaseModel):
    group: str
    year: int
    month: int


class FixStep(BaseModel):
    step_id: str
    op: str | None = None
    employee_id: str | None = None
    employee_name: str | None = None
    date: str | None = None
    slot: str | None = None
    added_hours: float | None = None
    description: str
    resolves_rule: str


class UnresolvedItem(BaseModel):
    rule_name: str
    date: str
    message: str


class FixPlanResponse(BaseModel):
    steps: list[FixStep]
    warnings_before: int
    warnings_after_if_all: int
    new_hard_errors: int
    unresolved: list[UnresolvedItem]
    explanation: str


class ApplyPlanRequest(BaseModel):
    group: str
    year: int
    month: int
    steps: list[FixStep]


class ApplyPlanResponse(BaseModel):
    ok: bool
    applied_count: int
    warnings_after: int
    hard_errors_after: int


def _soft_count(validation) -> int:
    return sum(1 for e in validation.errors if e.severity == "soft")


def _hard_count(validation) -> int:
    return sum(1 for e in validation.errors if e.severity == "hard")


def _fallback_explanation(steps: list[dict], resolved: int, unresolved: list[dict]) -> str:
    if not steps and not unresolved:
        return "Schemat har inga åtgärdbara varningar — allt ser bra ut."
    cat = {"dag_tidig": 0, "kval_lang": 0, "timbalans": 0, "bemanning": 0}
    for s in steps:
        cat[s.get("op", "")] = cat.get(s.get("op", ""), 0) + 1
    parts = []
    if cat["dag_tidig"]:
        parts.append(f"{cat['dag_tidig']} dag(ar) får 06:45-täckning")
    if cat["kval_lang"]:
        parts.append(f"{cat['kval_lang']} kvällspass förlängs till 21:30")
    if cat["bemanning"]:
        parts.append(f"{cat['bemanning']} bemanningshål täcks med obokad tid")
    if cat["timbalans"]:
        parts.append(f"{cat['timbalans']} personer får sina kontraktstimmar fyllda")
    body = ", ".join(parts) if parts else "inga ändringar behövs"
    msg = f"Planen löser {resolved} varningar i {len(steps)} steg utan att skapa nya regelbrott: {body}."
    if unresolved:
        msg += f" {len(unresolved)} varningar kvarstår och kräver vikarie eller manuell hantering."
    return msg


async def _ai_plan_explanation(steps: list[dict], resolved: int, unresolved: list[dict]) -> str:
    """Holistisk svensk förklaring av planen. Faller tillbaka på mall utan OpenAI."""
    fallback = _fallback_explanation(steps, resolved, unresolved)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not steps:
        return fallback

    cat: dict[str, int] = {}
    for s in steps:
        cat[s.get("op", "")] = cat.get(s.get("op", ""), 0) + 1
    context = (
        f"Antal steg: {len(steps)}. Lösta varningar: {resolved}. "
        f"Kvarstående (kräver vikarie/manuellt): {len(unresolved)}. "
        f"Stegtyper: {cat}."
    )
    prompt = (
        "Du är ett schemaläggningssystem för Töreboda hemvård. Förklara på enkel, "
        "tydlig svenska för en chef vad denna åtgärdsplan gör och varför den är säker "
        "(inga nya regelbrott). Max 3 meningar, ingen teknisk jargong.\n\n"
        f"{context}\n\n"
        'Svara ENBART med JSON: {"explanation": "..."}'
    )
    try:
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=250,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        return json.loads(raw).get("explanation", fallback)
    except Exception:
        return fallback


@router.post("/plan-fixes", response_model=FixPlanResponse)
async def plan_fixes_endpoint(
    req: PlanFixesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Bygger en deterministisk flerstegsplan som löser varningar utan att spara."""
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"

    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == req.group,
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalar_one_or_none()
    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema genererat för denna period")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == req.group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    krav = await _load_krav(db, req.group, req.year, req.month)

    schedule = list(period_row.schedule)
    before_val = validate_schedule([_dict_to_schedule_day(sd) for sd in schedule], employees, krav)

    steps, final_val, unresolved = plan_fixes(schedule, employees, krav, req.year, req.month)

    warnings_before = _soft_count(before_val)
    warnings_after = _soft_count(final_val)
    resolved = max(0, warnings_before - warnings_after)
    new_hard = max(0, _hard_count(final_val) - _hard_count(before_val))

    explanation = await _ai_plan_explanation(steps, resolved, unresolved)

    return FixPlanResponse(
        steps=[FixStep(**s) for s in steps],
        warnings_before=warnings_before,
        warnings_after_if_all=warnings_after,
        new_hard_errors=new_hard,
        unresolved=[UnresolvedItem(**u) for u in unresolved],
        explanation=explanation,
    )


@router.post("/apply-plan", response_model=ApplyPlanResponse)
async def apply_plan_endpoint(
    req: ApplyPlanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Spelar upp de valda planstegen, validerar och sparar i ett enda steg."""
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"

    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == req.group,
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalar_one_or_none()
    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema att uppdatera")

    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == req.group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]
    krav = await _load_krav(db, req.group, req.year, req.month)

    schedule = list(period_row.schedule)
    step_dicts = [s.model_dump() for s in req.steps]
    new_schedule, applied = apply_steps(schedule, employees, krav, req.year, req.month, step_dicts)

    final_val = validate_schedule([_dict_to_schedule_day(sd) for sd in new_schedule], employees, krav)

    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    log_entry = (
        f"[{timestamp_str}] AI-åtgärdsplan godkänd av {current_user.full_name or current_user.username}: "
        f"{applied} steg tillämpade i ett svep (flerstegsplanerare)."
    )
    current_decisions = list(period_row.decisions or [])
    current_decisions.append(log_entry)
    period_row.decisions = current_decisions
    period_row.schedule = new_schedule
    await db.commit()

    return ApplyPlanResponse(
        ok=True,
        applied_count=applied,
        warnings_after=_soft_count(final_val),
        hard_errors_after=_hard_count(final_val),
    )
