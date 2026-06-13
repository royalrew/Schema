# -*- coding: utf-8 -*-
"""
Enhetstester för produkt-swarmen (app/engine/swarm.py) och rättvise-operatorn
(_simulate_swap_dag_tidig i autocorrect.py).

Verifierar att:
- Täcknings- och Timbalansagenten attribueras drag (Fas A),
- Rättviseagenten jämnar ut 06:45-rotationen utan att försämra schemat (Fas B),
- ett byte som skulle bryta 11h dygnsvila STOPPAS av motorn,
- rapporten är deterministisk oavsett indataordning.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.engine.schemas import Employee, ContractType, Group
from app.engine.swarm import run_swarm
from app.routers.autocorrect import _simulate_swap_dag_tidig

STOCKHOLM = ZoneInfo("Europe/Stockholm")


def _emp(emp_id: str, name: str, percentage: float = 1.0) -> Employee:
    return Employee(id=emp_id, name=name, contract_type=ContractType.VARIERANDE, group=Group.NORRA, percentage=percentage)


def _shift(stype: str, d: date, sh: int, sm: int, eh: int, em: int, unbooked: bool = False) -> dict:
    start = datetime(d.year, d.month, d.day, sh, sm, tzinfo=STOCKHOLM)
    end = datetime(d.year, d.month, d.day, eh, em, tzinfo=STOCKHOLM)
    return {
        "shift_type": stype,
        "segments": [{"start_time": start.isoformat(), "end_time": end.isoformat()}],
        "is_unbooked": unbooked,
        "note": None,
    }


def _day(emp_id: str, d: date, shift: dict | None = None) -> dict:
    return {"date": d.isoformat(), "employee_id": emp_id, "shift": shift, "absence": None, "assigned_group": None}


def _dag_tidig(d):  return _shift("dag_tidig", d, 6, 45, 16, 0)
def _dag(d):        return _shift("dag", d, 7, 0, 16, 0)
def _kval_lang(d):  return _shift("kval_lang", d, 13, 45, 21, 30)


def _agent_count(report, name: str) -> int:
    return next(c.count for c in report.agents if c.agent == name)


def test_fairness_agent_evens_out_0645_rotation():
    a = _emp("A", "Anna")
    b = _emp("B", "Bertil")
    employees = [a, b]
    days = [date(2026, 6, d) for d in (1, 2, 3, 4)]  # mån–tor
    schedule = []
    for d in days:
        schedule.append(_day("A", d, _dag_tidig(d)))  # Anna håller alla 06:45
        schedule.append(_day("B", d, _dag(d)))         # Bertil har vanliga dagpass

    report = run_swarm(schedule, employees, [], 2026, 6)

    assert report.fairness_before == 4          # Anna 4, Bertil 0
    assert _agent_count(report, "Rättviseagent") >= 1
    assert report.fairness_after < report.fairness_before
    assert report.hard_after <= report.hard_before  # motorn = grind


def test_coverage_agent_is_attributed():
    a = _emp("A", "Anna")
    b = _emp("B", "Bertil")
    employees = [a, b]
    d = date(2026, 6, 1)  # måndag
    # Anna jobbar dag (ingen 06:45 den dagen → dag_tidig_saknas). Bertil är ledig.
    schedule = [_day("A", d, _dag(d)), _day("B", d, None)]

    report = run_swarm(schedule, employees, [], 2026, 6)

    assert _agent_count(report, "Täckningsagent") >= 1   # lade 06:45
    assert report.hard_after <= report.hard_before


def test_timbalans_agent_is_attributed():
    c = _emp("C", "Cecilia")
    b = _emp("B", "Bertil", percentage=0.15)
    employees = [c, b]
    # Cecilia håller 06:45 varje vardag (många distinkta datum → reellt timmål).
    # Bertil jobbar bara en dag → stort timunderskott → Timbalansagenten fyller.
    schedule = []
    for dnum in range(1, 29):
        d = date(2026, 6, dnum)
        if d.weekday() < 5:  # vardag
            schedule.append(_day("C", d, _dag_tidig(d)))
            schedule.append(_day("B", d, None))  # Bertil närvarande men ledig → reellt timmål

    report = run_swarm(schedule, employees, [], 2026, 6)

    assert _agent_count(report, "Timbalansagent") >= 1   # fyllde Bertils timunderskott
    assert report.hard_after <= report.hard_before


def test_swap_rejected_when_it_breaks_dygnsvila():
    a = _emp("A", "Anna")
    b = _emp("B", "Bertil")
    employees = [a, b]
    d1 = date(2026, 6, 1)  # Anna 06:45
    d2 = date(2026, 6, 2)  # Bertil kväll lång (slutar 21:30)
    d3 = date(2026, 6, 3)  # Anna 06:45, Bertil dag → bytkandidat
    schedule = [
        _day("A", d1, _dag_tidig(d1)),
        _day("B", d2, _kval_lang(d2)),
        _day("A", d3, _dag_tidig(d3)),
        _day("B", d3, _dag(d3)),
    ]
    # Anna har 2 st 06:45, Bertil 0 → gap 2 på d3. Men Bertil tog 06:45 dagen efter
    # 21:30 ger 9,25h vila < 11h → motorn stoppar bytet.
    _new, swap = _simulate_swap_dag_tidig(schedule, employees)
    assert swap is None


def test_swap_allowed_without_dygnsvila_conflict():
    a = _emp("A", "Anna")
    b = _emp("B", "Bertil")
    employees = [a, b]
    d1 = date(2026, 6, 1)
    d3 = date(2026, 6, 3)
    schedule = [
        _day("A", d1, _dag_tidig(d1)),
        _day("A", d3, _dag_tidig(d3)),
        _day("B", d3, _dag(d3)),
    ]
    _new, swap = _simulate_swap_dag_tidig(schedule, employees)
    assert swap is not None
    from_id, to_id, datestr = swap
    assert (from_id, to_id, datestr) == ("A", "B", d3.isoformat())


def test_swarm_report_is_deterministic_regardless_of_order():
    a = _emp("A", "Anna")
    b = _emp("B", "Bertil")
    employees = [a, b]
    days = [date(2026, 6, d) for d in (1, 2, 3, 4)]

    def build():
        s = []
        for d in days:
            s.append(_day("A", d, _dag_tidig(d)))
            s.append(_day("B", d, _dag(d)))
        return s

    r1 = run_swarm(build(), employees, [], 2026, 6)
    r2 = run_swarm(list(reversed(build())), employees, [], 2026, 6)

    assert r1.model_dump() == r2.model_dump()
