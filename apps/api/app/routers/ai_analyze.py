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
    EmployeeRow, SchedulePeriodRow, UserRow, BemanningskravRow, StaffingTemplateRow,
)
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    SoftConstraint, WishShiftEntry, Bemanningskrav,
)
from app.engine.solver import validate_schedule
from app.engine.planner import plan_fixes, apply_steps
from app.routers.schedule import _row_to_employee, _dict_to_schedule_day
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
