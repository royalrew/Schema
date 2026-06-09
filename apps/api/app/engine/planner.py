# -*- coding: utf-8 -*-
"""
Deterministisk flerstegs-åtgärdsplanerare (best-first fixpoint).

Tar ett genererat schema med valideringsvarningar och bygger en sekvens av
deterministiska fixar som löser så många varningar som möjligt UTAN att öka
antalet hårda fel. Varje drag simuleras och omvalideras (look-ahead) innan det
väljs — planeraren "tänker i flera steg" genom att alltid välja det drag som
sänker den totala problempoängen mest, och stannar när inget drag längre hjälper.

Kärnan är helt deterministisk. Ingen LLM är inblandad här (LLM:en förklarar bara
den färdiga planen på svenska, i ai_analyze.py).
"""
import copy
import math
from datetime import date

from app.engine.schemas import Employee, ScheduleDay, Bemanningskrav, ValidationResult
from app.engine.solver import validate_schedule
from app.routers.autocorrect import (
    _simulate_dag_tidig, _simulate_kval_lang, _simulate_timbalans,
    _simulate_bemanning, _worst_understaffed_slot,
)

# Vikt per fixbar varningskategori (lägre total = bättre schema).
# Verksamhetskritisk täckning väger tyngst, timbalans lägst.
_WEIGHTS = {
    "bemanningskrav": 100,
    "dag_tidig_saknas": 50,
    "kval_lang_saknas": 50,
    "timbemanning": 40,
    "timbalans_underskott": 15,
    "timbalans_overskott": 15,
}

# Regler planeraren har en operator för
_FIXABLE = {"dag_tidig_saknas", "kval_lang_saknas", "timbalans_underskott", "bemanningskrav"}


def _to_days(schedule: list[dict]) -> list[ScheduleDay]:
    return [ScheduleDay.model_validate(sd) for sd in schedule]


def _score(validation: ValidationResult) -> tuple[int, float]:
    """Returnerar (antal hårda fel, viktad mjuk poäng). Lägre är bättre."""
    hard = 0
    soft = 0.0
    for e in validation.errors:
        if e.severity == "hard":
            hard += 1
        else:
            soft += _WEIGHTS.get(e.rule_name, 1)
    return hard, soft


def _fmt(date_str: str | None) -> str:
    if not date_str:
        return ""
    try:
        d = date.fromisoformat(date_str)
        return f"{d.day}/{d.month}"
    except Exception:
        return date_str


def _apply_operator(schedule, employees, krav, year, month, w):
    """
    Kör rätt operator för en varning (look-ahead, sparar inte).
    Returnerar (nytt_schema, emp_id, meta). emp_id=None betyder att fixen inte
    gick att utföra (t.ex. ingen ledig personal → kräver vikarie).
    """
    rule = w.rule_name
    if rule == "dag_tidig_saknas":
        new, emp_id = _simulate_dag_tidig(schedule, w.date, employees)
        return new, emp_id, {"op": "dag_tidig", "date": w.date.isoformat()}
    if rule == "kval_lang_saknas":
        new, emp_id = _simulate_kval_lang(schedule, w.date, employees)
        return new, emp_id, {"op": "kval_lang", "date": w.date.isoformat()}
    if rule == "timbalans_underskott":
        new, added = _simulate_timbalans(schedule, w.employee_id, employees, year, month)
        if added <= 0:
            return schedule, None, {"op": "timbalans"}
        return new, w.employee_id, {"op": "timbalans", "added_hours": added}
    if rule == "bemanningskrav":
        slot = _worst_understaffed_slot(schedule, krav, w.date)
        new, emp_id = _simulate_bemanning(schedule, w.date, employees, krav, slot=slot)
        return new, emp_id, {"op": "bemanning", "date": w.date.isoformat(), "slot": slot}
    return schedule, None, {}


def _build_step(n: int, w, emp_id: str, emp: Employee | None, meta: dict) -> dict:
    name = emp.name if emp else emp_id
    op = meta.get("op")
    ds = meta.get("date")
    if op == "dag_tidig":
        desc = f"Tilldela {name} ett 06:45-pass den {_fmt(ds)} (täcker nattrapporten)."
    elif op == "kval_lang":
        desc = f"Förläng {name}s kvällspass till 21:30 den {_fmt(ds)}."
    elif op == "timbalans":
        added = meta.get("added_hours", 0) or 0
        dagar = max(1, math.ceil(added / 8.5))  # obokad-pass är max 8,5 h/dag
        desc = (
            f"Fyll {name}s timunderskott med ca {added:.0f} h obokad tid, "
            f"fördelat på {dagar} lediga dagar (max 8,5 h per pass)."
        )
    elif op == "bemanning":
        desc = f"Omvandla {name}s obokade tid till ett bemanningspass den {_fmt(ds)}."
    else:
        desc = f"Åtgärd för {name}."
    return {
        "step_id": f"s{n}",
        "op": op,
        "employee_id": emp_id,
        "employee_name": name,
        "date": ds,
        "slot": meta.get("slot"),
        "added_hours": meta.get("added_hours"),
        "description": desc,
        "resolves_rule": w.rule_name,
    }


def plan_fixes(
    schedule: list[dict],
    employees: list[Employee],
    krav: list[Bemanningskrav] | None,
    year: int,
    month: int,
    max_steps: int = 300,
) -> tuple[list[dict], ValidationResult, list[dict]]:
    """
    Best-first fixpoint-planerare. Returnerar (steg, slutvalidering, olösta).
    Sparar inget — `schedule` är en lista dict-ScheduleDay.
    """
    krav = krav or []
    emp_map = {e.id: e for e in employees}
    current = copy.deepcopy(schedule)
    cur_val = validate_schedule(_to_days(current), employees, krav)
    cur_hard, cur_soft = _score(cur_val)

    steps: list[dict] = []
    step_n = 0

    while step_n < max_steps:
        soft_warnings = [
            e for e in cur_val.errors
            if e.severity == "soft" and e.rule_name in _FIXABLE
        ]
        if not soft_warnings:
            break

        best = None  # (improvement, sim, emp_id, meta, warning, new_val, new_hard, new_soft)
        seen: set = set()
        for w in soft_warnings:
            key = (w.rule_name, w.date.isoformat(), w.employee_id)
            if key in seen:
                continue
            seen.add(key)

            sim, emp_id, meta = _apply_operator(current, employees, krav, year, month, w)
            if emp_id is None:
                continue
            new_val = validate_schedule(_to_days(sim), employees, krav)
            new_hard, new_soft = _score(new_val)
            if new_hard > cur_hard:
                continue  # HÅRD INVARIANT: aldrig fler hårda fel
            improvement = cur_soft - new_soft
            if improvement <= 0:
                continue
            if best is None or improvement > best[0]:
                best = (improvement, sim, emp_id, meta, w, new_val, new_hard, new_soft)

        if best is None:
            break  # konvergerat — inget drag förbättrar längre

        _, sim, emp_id, meta, w, new_val, new_hard, new_soft = best
        current, cur_val = sim, new_val
        cur_hard, cur_soft = new_hard, new_soft
        step_n += 1
        steps.append(_build_step(step_n, w, emp_id, emp_map.get(emp_id), meta))

    unresolved = [
        {"rule_name": e.rule_name, "date": e.date.isoformat(), "message": e.message}
        for e in cur_val.errors
        if e.severity == "soft" and e.rule_name in _FIXABLE
    ]
    return steps, cur_val, unresolved


def apply_steps(
    schedule: list[dict],
    employees: list[Employee],
    krav: list[Bemanningskrav] | None,
    year: int,
    month: int,
    steps: list[dict],
) -> tuple[list[dict], int]:
    """
    Spelar upp en (eventuellt utvald delmängd) stegsekvens i ordning med forcerade
    targets. Returnerar (modifierat schema, antal tillämpade steg). Sparar inget.
    """
    krav = krav or []
    current = copy.deepcopy(schedule)
    applied = 0
    for st in steps:
        op = st.get("op")
        emp_id = st.get("employee_id")
        d = date.fromisoformat(st["date"]) if st.get("date") else None
        chosen = None
        if op == "dag_tidig" and d:
            current, chosen = _simulate_dag_tidig(current, d, employees, force_employee_id=emp_id)
        elif op == "kval_lang" and d:
            current, chosen = _simulate_kval_lang(current, d, employees, force_employee_id=emp_id)
        elif op == "timbalans" and emp_id:
            current, added = _simulate_timbalans(current, emp_id, employees, year, month)
            chosen = emp_id if added > 0 else None
        elif op == "bemanning" and d:
            current, chosen = _simulate_bemanning(
                current, d, employees, krav, force_employee_id=emp_id, slot=st.get("slot"),
            )
        if chosen is not None:
            applied += 1
    return current, applied
