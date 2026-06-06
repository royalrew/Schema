# -*- coding: utf-8 -*-
"""
AI-analysrouter: analyserar schemat mot personkortens mjuka krav
och returnerar validerade förslag på byten/justeringar.
"""
import json
import calendar
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
    ScheduleDay, Shift, ShiftSegment, ShiftType, SoftConstraint,
)
from app.engine.solver import validate_schedule

import os

router = APIRouter(prefix="/api/ai", tags=["ai"])
STOCKHOLM = ZoneInfo("Europe/Stockholm")


class AISuggestion(BaseModel):
    id: str
    reason: str           # Förklaring på svenska
    employee_a_id: str
    employee_a_name: str
    date_a: str           # ISO-datum
    employee_b_id: str
    employee_b_name: str
    date_b: str           # ISO-datum (vanligtvis samma dag)
    shift_a_label: str    # Vad A jobbar (för visning)
    shift_b_label: str    # Vad B jobbar


class AnalyzeRequest(BaseModel):
    group: str
    year: int
    month: int


class AnalyzeResponse(BaseModel):
    suggestions: list[AISuggestion]
    summary: str   # Kort sammanfattning från AI


SHIFT_ABBREV = {
    "dag_tidig": "06:45", "dag": "DAG", "kval_kort": "K",
    "kval_lang": "KL", "delad_tur": "DT", "natt": "N",
    "obokad": "OB", "APT": "APT",
}


def _row_to_employee(row: EmployeeRow) -> Employee:
    return Employee(
        id=row.id,
        name=row.name,
        contract_type=ContractType(row.contract_type),
        group=Group(row.group_name),
        absences=[
            Absence(date=date.fromisoformat(a["date"]),
                    absence_type=AbsenceType(a["absence_type"]))
            for a in (row.absences or [])
        ],
        wishes=[date.fromisoformat(w) for w in (row.wishes or [])],
        vetos=[date.fromisoformat(v) for v in (row.vetos or [])],
        soft_constraints=[SoftConstraint(**c) for c in (row.soft_constraints or [])],
    )


import re as _re

def _sanitize_for_prompt(text: str, max_len: int = 120) -> str:
    """Tar bort tecken som kan användas för prompt injection och begränsar längden."""
    # Ta bort tecken som kan bryta ut ur promptkontext
    cleaned = _re.sub(r'[{}\[\]<>]', '', str(text))
    # Begränsa längd
    return cleaned[:max_len]


def _anonymize_text(text: str, employees: list[Employee]) -> str:
    """Ersätter eventuella förekomster av medarbetares namn med deras ID-kod (PII-tvätt)."""
    if not text:
        return text
    # Sortera efter namnlängd fallande så att vi inte matchar delar av längre namn först
    sorted_emps = sorted(employees, key=lambda e: len(e.name), reverse=True)
    for emp in sorted_emps:
        if emp.name and len(emp.name) > 2:
            # Ersätt "Maria Svensson" med "Anställd [ID]"
            text = _re.sub(_re.escape(emp.name), f"Anställd {emp.id}", text, flags=_re.IGNORECASE)
            # Ersätt även enbart förnamn "Maria" om det är tillräckligt unikt och långt
            first_name = emp.name.split()[0]
            if len(first_name) > 2:
                text = _re.sub(r'\b' + _re.escape(first_name) + r'\b', f"Anställd {emp.id}", text, flags=_re.IGNORECASE)
    return text


def _deanonymize_text(text: str, employees: list[Employee]) -> str:
    """Ersätter ID-koder (t.ex. Anställd EMP_001 eller EMP_001) med riktiga namn."""
    if not text:
        return text
    for emp in employees:
        # Ersätt "Anställd EMP_001" med "Jimmy Berndtsson"
        text = _re.sub(r'Anställd\s+' + _re.escape(emp.id), emp.name, text, flags=_re.IGNORECASE)
        # Ersätt enbart "EMP_001" med "Jimmy Berndtsson"
        text = _re.sub(r'\b' + _re.escape(emp.id) + r'\b', emp.name, text)
    return text


def _build_schedule_summary(
    employees: list[Employee],
    schedule: list[dict],
    year: int,
    month: int,
) -> str:
    """Bygger en kompakt textrepresentation av schemat för AI-prompten med maskerad PII."""
    _, last = calendar.monthrange(year, month)
    days = [date(year, month, d) for d in range(1, last + 1)]

    # Index: emp_id → date_str → shift_abbrev
    sched: dict[str, dict[str, str]] = {}
    for sd in schedule:
        eid = sd.get("employee_id", "")
        d = sd.get("date", "")
        shift = sd.get("shift")
        if shift and not shift.get("is_unbooked"):
            abbrev = SHIFT_ABBREV.get(shift.get("shift_type", ""), "?")
            if eid not in sched:
                sched[eid] = {}
            sched[eid][d] = abbrev

    lines = []
    for emp in employees:
        sc_text = ""
        if emp.soft_constraints:
            parts = []
            for c in emp.soft_constraints:
                days_str = ",".join(["Mån","Tis","Ons","Tor","Fre","Lör","Sön"][d] for d in c.weekdays)
                parity = {"all": "alla veckor", "odd": "udda veckor", "even": "jämna veckor"}.get(c.week_parity, c.week_parity)
                safe_note = _sanitize_for_prompt(c.note)
                # PII-tvätt på KRAV-noteringen
                safe_note = _anonymize_text(safe_note, employees)
                parts.append(f"{c.constraint_type}({days_str},{parity}): {safe_note}")
            sc_text = " | KRAV: " + "; ".join(parts)

        emp_days = sched.get(emp.id, {})
        # Komprimera: bara dagar med pass
        work_days = []
        for d in days:
            ds = d.isoformat()
            if ds in emp_days:
                wd = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"][d.weekday()]
                week = int(d.strftime("%V"))
                work_days.append(f"{d.day}/{month}({wd},v{week}):{emp_days[ds]}")

        helger = sum(1 for d in days if d.isoformat() in emp_days and d.weekday() >= 5)
        # Använd anonyma ID-koder i prompten för 100% PII-tvätt
        anonymized_label = f"Anställd {emp.id}"
        lines.append(
            f"{anonymized_label} [{emp.contract_type.value}]{sc_text}\n"
            f"  Schema: {', '.join(work_days) if work_days else 'inga pass'}\n"
            f"  Helger: {helger}"
        )

    return "\n\n".join(lines)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    req: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY saknas i miljövariablerna")

    # Hämta anställda
    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == req.group)
    )).scalars().all()
    if not emp_rows:
        raise HTTPException(status_code=404, detail=f"Inga anställda i {req.group}")

    employees = [_row_to_employee(r) for r in emp_rows]

    # Hämta schema
    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == req.group,
            SchedulePeriodRow.year == req.year,
            SchedulePeriodRow.month == req.month,
        )
    )).scalar_one_or_none()

    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema genererat för denna period")

    schedule = period_row.schedule
    emp_map = {e.id: e for e in employees}

    # Bygg prompt-sammanfattning (med anonymiserad data)
    summary_text = _build_schedule_summary(employees, schedule, req.year, req.month)

    month_name = date(req.year, req.month, 1).strftime("%B %Y")
    # Kontrollera om någon faktiskt har mjuka krav
    has_constraints = any(emp.soft_constraints for emp in employees)

    prompt = f"""Du är ett schemaläggningsassistentsystem för Töreboda hemvård.

Analysera schemat för grupp {req.group} ({month_name}).

VIKTIGT: Basera din analys ENBART på de KRAV som anges under varje persons ID nedan.
Hitta INTE på krav, preferenser eller önskemål som inte är dokumenterade.
Om en person saknar dokumenterade krav ska du INTE kommentera deras schema.

SCHEMA OCH DOKUMENTERADE KRAV:
{summary_text}

{"Notera: Ingen av de anställda har dokumenterade mjuka krav ännu. Returnera tom suggestions-lista och förklara detta i summary." if not has_constraints else "Hitta MAXIMALT 5 konkreta förbättringsförslag baserade på de dokumenterade kraven ovan."}

Returnera ENBART giltig JSON enligt följande format:
{{
  "summary": "Kort sammanfattning på svenska (max 2 meningar).",
  "suggestions": [
    {{
      "employee_a_id": "ID-koden för första medarbetaren (t.ex. EMP_001)",
      "employee_b_id": "ID-koden för andra medarbetaren (t.ex. EMP_002)",
      "date_a": "ISO-datum för första passet",
      "date_b": "ISO-datum för andra passet (oftast samma som date_a)",
      "reason": "En kort förklaring på svenska varför detta byte underlättar utifrån medarbetarnas angivna KRAV. Referera till dem som 'Anställd [ID]' (t.ex. 'Anställd EMP_001')."
    }}
  ]
}}

Regler:
- Föreslå ENDAST byten där båda anställda har ett schemalagt pass den aktuella dagen.
- Föreslå ALDRIG för anställda utan dokumenterade KRAV.
- Använd uteslutande ID-koder (t.ex. EMP_001) för employee_a_id och employee_b_id.
- Hitta inte på önskemål eller preferenser som inte finns i datan.
"""

    # Anropa OpenAI
    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        ai_result = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI-anrop misslyckades: {str(e)}")

    ai_summary = ai_result.get("summary", "Analysen är klar.")
    raw_suggestions = ai_result.get("suggestions", [])

    # Avmaska PII i sammanfattningen (ersätt t.ex. EMP_001 -> Riktigt namn)
    ai_summary = _deanonymize_text(ai_summary, employees)

    # Validera varje förslag mot den deterministiska motorn
    sched_idx: dict[str, dict[str, dict]] = {}
    for sd in schedule:
        eid = sd["employee_id"]
        d = sd["date"]
        if eid not in sched_idx:
            sched_idx[eid] = {}
        sched_idx[eid][d] = sd

    valid_suggestions: list[AISuggestion] = []

    for i, s in enumerate(raw_suggestions[:5]):
        emp_a_id = s.get("employee_a_id", "")
        emp_b_id = s.get("employee_b_id", "")
        date_a   = s.get("date_a", "")
        date_b   = s.get("date_b", "")
        reason   = s.get("reason", "")

        if not all([emp_a_id, emp_b_id, date_a, date_b, reason]):
            continue

        emp_a = emp_map.get(emp_a_id)
        emp_b = emp_map.get(emp_b_id)
        if not emp_a or not emp_b:
            continue

        sd_a = sched_idx.get(emp_a_id, {}).get(date_a)
        sd_b = sched_idx.get(emp_b_id, {}).get(date_b)
        if not sd_a or not sd_b:
            continue
        if not sd_a.get("shift") or not sd_b.get("shift"):
            continue

        shift_a = sd_a["shift"].get("shift_type", "")
        shift_b = sd_b["shift"].get("shift_type", "")

        # Avmaska PII i förslagets motivering
        clean_reason = _deanonymize_text(reason, employees)

        valid_suggestions.append(AISuggestion(
            id=f"sug_{i}",
            reason=clean_reason,
            employee_a_id=emp_a_id,
            employee_a_name=emp_a.name,
            date_a=date_a,
            employee_b_id=emp_b_id,
            employee_b_name=emp_b.name,
            date_b=date_b,
            shift_a_label=SHIFT_ABBREV.get(shift_a, shift_a),
            shift_b_label=SHIFT_ABBREV.get(shift_b, shift_b),
        ))

    return AnalyzeResponse(suggestions=valid_suggestions, summary=ai_summary)


class SwapRequest(BaseModel):
    employee_a_id: str
    date_a: str
    employee_b_id: str
    date_b: str


class SwapResponse(BaseModel):
    ok: bool
    message: str
    hard_errors: int


@router.post("/swap/{group}/{year}/{month}", response_model=SwapResponse)
async def apply_swap(
    group: str, year: int, month: int,
    req: SwapRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """Byter pass mellan två anställda och validerar mot hårda regler."""
    period_row = (await db.execute(
        select(SchedulePeriodRow).where(
            SchedulePeriodRow.group_name == group,
            SchedulePeriodRow.year == year,
            SchedulePeriodRow.month == month,
        )
    )).scalar_one_or_none()

    if not period_row or not period_row.schedule:
        raise HTTPException(status_code=404, detail="Inget schema att uppdatera")

    schedule = list(period_row.schedule)

    # Hitta de aktuella dagarna
    idx_a = next((i for i, sd in enumerate(schedule)
                  if sd["employee_id"] == req.employee_a_id and sd["date"] == req.date_a), None)
    idx_b = next((i for i, sd in enumerate(schedule)
                  if sd["employee_id"] == req.employee_b_id and sd["date"] == req.date_b), None)

    if idx_a is None or idx_b is None:
        return SwapResponse(ok=False, message="Kunde inte hitta passen att byta", hard_errors=0)

    # Byt shift mellan de två dagarna
    shift_a = schedule[idx_a].get("shift")
    shift_b = schedule[idx_b].get("shift")
    schedule[idx_a] = {**schedule[idx_a], "shift": shift_b}
    schedule[idx_b] = {**schedule[idx_b], "shift": shift_a}

    # Hämta anställda och validera
    emp_rows = (await db.execute(
        select(EmployeeRow).where(EmployeeRow.group_name == group)
    )).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]

    # Bygg ScheduleDay-objekt för validering
    from app.routers.schedule import _dict_to_schedule_day
    try:
        schedule_days = [_dict_to_schedule_day(sd) for sd in schedule]
    except Exception as e:
        return SwapResponse(ok=False, message=f"Valideringsfel: {str(e)}", hard_errors=0)

    validation = validate_schedule(schedule_days, employees)
    hard_errors = sum(1 for e in validation.errors if e.severity == "hard")

    if hard_errors > 0:
        error_msgs = [e.message for e in validation.errors if e.severity == "hard"][:2]
        return SwapResponse(
            ok=False,
            message=f"Bytet skapar regelbrott: {'; '.join(error_msgs)}",
            hard_errors=hard_errors,
        )

    # Skapa beslutsloggspost för bytet (PII-anonymiserad internt i DB om nödvändigt, men här sparas det i interna beslutsloggen för Sara)
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    emp_a_name = next((e.name for e in employees if e.id == req.employee_a_id), req.employee_a_id)
    emp_b_name = next((e.name for e in employees if e.id == req.employee_b_id), req.employee_b_id)
    
    shift_a_type = shift_a.get("shift_type", "obokad") if shift_a else "obokad"
    shift_b_type = shift_b.get("shift_type", "obokad") if shift_b else "obokad"
    shift_a_lbl = SHIFT_ABBREV.get(shift_a_type, shift_a_type)
    shift_b_lbl = SHIFT_ABBREV.get(shift_b_type, shift_b_type)
    
    log_entry = (
        f"[{timestamp_str}] Manuell korrigering av {current_user.full_name or current_user.username}: "
        f"Bytte pass den {req.date_a} för {emp_a_name} ({shift_a_lbl}) mot passet den {req.date_b} för {emp_b_name} ({shift_b_lbl})."
    )
    
    current_decisions = list(period_row.decisions or [])
    current_decisions.append(log_entry)
    period_row.decisions = current_decisions

    # Spara
    period_row.schedule = schedule
    await db.commit()
    return SwapResponse(ok=True, message="Bytet genomfört och validerat.", hard_errors=0)
