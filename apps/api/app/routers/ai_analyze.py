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
from app.db_models import EmployeeRow, SchedulePeriodRow, UserRow
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    SoftConstraint, WishShiftEntry,
)
from app.engine.solver import validate_schedule
from app.routers.schedule import _row_to_employee, _dict_to_schedule_day
from app.routers.autocorrect import _simulate_dag_tidig

router = APIRouter(prefix="/api/ai", tags=["ai"])
STOCKHOLM = ZoneInfo("Europe/Stockholm")

# Mappning: rule_name → fix_type
_FIX_TYPE_MAP = {
    "dag_tidig_saknas": "dag_tidig",
    "kval_lang_saknas": "kval_lang",
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
    fix_type: str            # "dag_tidig" | "kval_lang" | "manual"
    fix_possible: bool
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

    if fix_type == "dag_tidig":
        target_date = date.fromisoformat(req.warning.date)
        simulated, chosen_emp_id = _simulate_dag_tidig(schedule, target_date, employees)

        if chosen_emp_id:
            fix_possible = True
            # Jämför varningar före/efter
            before_days = [_dict_to_schedule_day(sd) for sd in schedule]
            after_days = [_dict_to_schedule_day(sd) for sd in simulated]
            before_warnings = {
                (e.date.isoformat(), e.rule_name, e.employee_id)
                for e in validate_schedule(before_days, employees).errors
                if e.severity == "soft"
            }
            after_validation = validate_schedule(after_days, employees)
            for err in after_validation.errors:
                if err.severity == "soft":
                    key = (err.date.isoformat(), err.rule_name, err.employee_id)
                    if key not in before_warnings:
                        side_effects.append(SideEffect(date=err.date.isoformat(), message=err.message))

    affected_emp = emp_map.get(chosen_emp_id) if chosen_emp_id else None

    # --- AI-förklaring ---
    context_lines = [
        f"Varning: {req.warning.message}",
        f"Datum: {req.warning.date}",
        f"Regelnamn: {req.warning.rule_name}",
    ]
    if fix_possible and affected_emp:
        context_lines.append(f"Föreslagen åtgärd: tilldela {affected_emp.name} ett 06:45-pass denna dag.")
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

    return ApplyFixResponse(ok=False, message=f"Fix-typ '{req.fix_type}' stöds inte ännu.")
