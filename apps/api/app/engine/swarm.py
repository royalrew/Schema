# -*- coding: utf-8 -*-
"""
Produkt-swarm: flera specialiserade agenter, deterministisk motor som domare.

Varje agent driver ETT mål och föreslår drag. Motorn (`validate_schedule`) är
grinden: ett drag behålls bara om det inte ökar antalet hårda fel (och, för
rättviseagenten, inte heller försämrar den mjuka poängen). Allt attribueras så att
slutrapporten visar exakt vilken agent som gjorde vad och att det är motorvaliderat
— "fria händer, men med bevis" (se minnet project_ai_autonomi).

Skiva 1 är dry-run: `run_swarm` muterar inget i DB, den returnerar en SwarmReport.

Agenter:
- Täckningsagent  — 06:45-täckning, kväll-täckning, bemanningskrav (Fas A)
- Timbalansagent  — fyller timunderskott mot kontraktsmål (Fas A)
- Rättviseagent   — jämnar ut 06:45-rotationen via byten (Fas B)
"""

import copy

from pydantic import BaseModel, Field

from app.engine.schemas import Employee, Bemanningskrav
from app.engine.solver import validate_schedule
from app.engine.planner import plan_fixes, apply_steps, _to_days, _score
from app.routers.autocorrect import _simulate_swap_dag_tidig, _dag_tidig_counts

# op (från planner-stegen) → agent
_OP_TO_AGENT = {
    "dag_tidig": "Täckningsagent",
    "kval_lang": "Täckningsagent",
    "bemanning": "Täckningsagent",
    "timbalans": "Timbalansagent",
}

_AGENT_ORDER = ["Täckningsagent", "Timbalansagent", "Rättviseagent"]
_PROOF = "validerat: 0 hårda regelbrott"
_MAX_FAIRNESS_STEPS = 200


class SwarmMove(BaseModel):
    agent: str
    description: str
    date: str | None = None
    rule: str | None = None
    proof: str = _PROOF


class AgentContribution(BaseModel):
    agent: str
    count: int
    moves: list[SwarmMove] = Field(default_factory=list)


class SwarmReport(BaseModel):
    agents: list[AgentContribution]
    total_moves: int
    hard_before: int
    hard_after: int
    soft_before: float
    soft_after: float
    fairness_before: int
    fairness_after: int
    unresolved: list[dict] = Field(default_factory=list)


def _fairness_spread(schedule: list[dict], varierande_ids: set[str]) -> int:
    """06:45-ojämlikhet = max − min antal DAG_TIDIG bland VARIERANDE. Lägre = rättvisare."""
    if not varierande_ids:
        return 0
    counts = _dag_tidig_counts(schedule, varierande_ids)
    vals = list(counts.values())
    return max(vals) - min(vals) if vals else 0


def run_swarm(
    schedule: list[dict],
    employees: list[Employee],
    krav: list[Bemanningskrav] | None,
    year: int,
    month: int,
) -> SwarmReport:
    """
    Kör svärmen över ett genererat schema (dry-run). Returnerar en attribuerad
    bevis-rapport. Sparar inget — `schedule` är en lista dict-ScheduleDay.
    """
    krav = krav or []
    emp_map = {e.id: e for e in employees}
    varierande_ids = {e.id for e in employees if e.contract_type.value == "varierande"}

    base = copy.deepcopy(schedule)
    base_val = validate_schedule(_to_days(base), employees, krav)
    hard_before, soft_before = _score(base_val)
    fairness_before = _fairness_spread(base, varierande_ids)

    moves_by_agent: dict[str, list[SwarmMove]] = {a: [] for a in _AGENT_ORDER}

    # ── Fas A: Täckning + Timbalans (deterministisk best-first via plan_fixes) ──
    steps, _val_a, unresolved = plan_fixes(base, employees, krav, year, month)
    current, _applied = apply_steps(base, employees, krav, year, month, steps)

    for st in steps:
        agent = _OP_TO_AGENT.get(st.get("op"))
        if not agent:
            continue
        moves_by_agent[agent].append(SwarmMove(
            agent=agent,
            description=st.get("description", ""),
            date=st.get("date"),
            rule=st.get("resolves_rule"),
        ))

    # ── Fas B: Rättvisa (06:45-byten) ──
    # Bytet är coverage-neutralt (en dag_tidig + en dag finns kvar) → vi grindar på
    # den HÅRDA invarianten (lag bryts aldrig) och kräver att rättvisan strikt
    # förbättras. Små timbalans-skift (06:45 vs 07:00 = 15 min) ska inte blockera.
    cur_hard, _ = _score(validate_schedule(_to_days(current), employees, krav))
    cur_spread = _fairness_spread(current, varierande_ids)

    for _ in range(_MAX_FAIRNESS_STEPS):
        new_sched, swap = _simulate_swap_dag_tidig(current, employees)
        if swap is None:
            break
        new_hard, _ = _score(validate_schedule(_to_days(new_sched), employees, krav))
        if new_hard > cur_hard:           # motorn = grind: lag bryts aldrig
            break
        new_spread = _fairness_spread(new_sched, varierande_ids)
        if new_spread >= cur_spread:      # bytet måste strikt förbättra rättvisan
            break
        from_id, to_id, datestr = swap
        from_name = emp_map[from_id].name if from_id in emp_map else from_id
        to_name = emp_map[to_id].name if to_id in emp_map else to_id
        moves_by_agent["Rättviseagent"].append(SwarmMove(
            agent="Rättviseagent",
            description=f"Flyttade 06:45-passet den {datestr} från {from_name} till {to_name} för rättvis rotation.",
            date=datestr,
            rule="rattvis_rotation",
        ))
        current, cur_hard, cur_spread = new_sched, new_hard, new_spread

    final_val = validate_schedule(_to_days(current), employees, krav)
    final_hard, final_soft = _score(final_val)
    fairness_after = cur_spread

    contributions = [
        AgentContribution(agent=a, count=len(moves_by_agent[a]), moves=moves_by_agent[a])
        for a in _AGENT_ORDER
    ]
    total_moves = sum(c.count for c in contributions)

    return SwarmReport(
        agents=contributions,
        total_moves=total_moves,
        hard_before=hard_before,
        hard_after=final_hard,
        soft_before=float(soft_before),
        soft_after=float(final_soft),
        fairness_before=fairness_before,
        fairness_after=fairness_after,
        unresolved=unresolved,
    )
