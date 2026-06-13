# -*- coding: utf-8 -*-
"""
Enhetstester för det globala inlåningspasset (app/engine/borrowing.py) som ligger
till grund för POST /api/generate-all.

Testerna är rena (ingen DB) och verifierar:
- att personal lånas ut över gruppgränser för att täcka brist,
- att resultatet är deterministiskt oavsett indataordning,
- att olöslig brist rapporteras (utan olagligt lån),
- att motorns hårda regler (dygnsvila) STOPPAR ett lån som skulle bryta lag.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.engine.schemas import (
    Employee, ContractType, Group, ScheduleDay, Shift, ShiftSegment, ShiftType,
    Bemanningskrav,
)
from app.engine.generator import _build_templates, _make_shift
from app.engine.borrowing import run_global_borrowing

STOCKHOLM = ZoneInfo("Europe/Stockholm")
TEMPLATES = _build_templates([])


def _emp(emp_id: str, name: str, group: Group) -> Employee:
    return Employee(id=emp_id, name=name, contract_type=ContractType.VARIERANDE, group=group)


def _obokad_day(emp_id: str, d: date) -> ScheduleDay:
    start = datetime(d.year, d.month, d.day, 7, 0, tzinfo=STOCKHOLM)
    end = start + timedelta(hours=8, minutes=30)
    return ScheduleDay(
        date=d,
        employee_id=emp_id,
        shift=Shift(shift_type=ShiftType.OBOKAD, segments=[ShiftSegment(start_time=start, end_time=end)], is_unbooked=True),
    )


def _work_day(emp: Employee, d: date, stype: ShiftType) -> ScheduleDay:
    return ScheduleDay(date=d, employee_id=emp.id, shift=_make_shift(stype, d, TEMPLATES, employee=emp))


def _lent_day(days):
    return next((x for x in days if x.assigned_group is not None), None)


def test_global_borrowing_lends_across_groups():
    d = date(2026, 6, 1)
    sodra = _emp("S", "Anna Södra", Group.SODRA)
    ostra = _emp("O", "Erik Östra", Group.OSTRA)
    employees_by_id = {sodra.id: sodra, ostra.id: ostra}

    # Östra behöver 1 fm men har ingen egen som jobbar fm (bara OBOKAD).
    all_days = [_obokad_day(sodra.id, d), _obokad_day(ostra.id, d)]
    krav = [Bemanningskrav(group=Group.OSTRA, date=d, fm_heads=1)]

    res = run_global_borrowing(all_days, employees_by_id, krav, {}, TEMPLATES)

    assert res.loans == 1
    assert res.unfilled == 0
    sodra_day = next(x for x in all_days if x.employee_id == "S")
    assert str(sodra_day.assigned_group) == "Östra"
    assert sodra_day.shift.shift_type == ShiftType.DAG
    assert sodra_day.shift.is_unbooked is False
    # Östras egen OBOKAD ska INTE ha rörts (kan inte låna av sig själv).
    ostra_day = next(x for x in all_days if x.employee_id == "O")
    assert ostra_day.assigned_group is None
    assert any("[Inlåning]" in t for t in res.by_group.get("Östra", []))
    assert any("[Utlåning]" in t for t in res.by_group.get("Södra", []))


def test_borrowing_is_deterministic_regardless_of_order():
    d = date(2026, 6, 2)
    a = _emp("A", "A Hög", Group.SODRA)    # har extra arbetade timmar → lägre prioritet
    b = _emp("B", "B Låg", Group.NORRA)    # minst arbetade timmar → ska väljas
    ostra = _emp("O", "Erik", Group.OSTRA)
    employees_by_id = {a.id: a, b.id: b, ostra.id: ostra}
    krav = [Bemanningskrav(group=Group.OSTRA, date=d, fm_heads=1)]

    def build():
        return [
            _obokad_day(a.id, d),
            _work_day(a, d - timedelta(days=2), ShiftType.DAG),  # ger A mer ackumulerad tid
            _obokad_day(b.id, d),
            _obokad_day(ostra.id, d),
        ]

    days1 = build()
    res1 = run_global_borrowing(days1, employees_by_id, krav, {}, TEMPLATES)

    days2 = list(reversed(build()))
    res2 = run_global_borrowing(days2, employees_by_id, krav, {}, TEMPLATES)

    assert res1.loans == 1 and res2.loans == 1
    assert _lent_day(days1).employee_id == "B"   # lägst ackumulerad tid väljs
    assert _lent_day(days2).employee_id == "B"   # samma resultat oavsett ordning


def test_unfilled_shortage_when_no_candidates():
    d = date(2026, 6, 3)
    ostra = _emp("O", "Erik", Group.OSTRA)
    employees_by_id = {ostra.id: ostra}
    all_days = [_obokad_day(ostra.id, d)]  # ingen annan grupp att låna från
    krav = [Bemanningskrav(group=Group.OSTRA, date=d, fm_heads=1)]

    res = run_global_borrowing(all_days, employees_by_id, krav, {}, TEMPLATES)

    assert res.loans == 0
    assert res.unfilled == 1
    assert res.unfilled_by_group.get("Östra") == 1
    assert any("[Bemanningsbrist]" in t for t in res.by_group.get("Östra", []))


def test_loan_rejected_when_it_breaks_dygnsvila():
    """Motorn (inte människan) stoppar ett lån som skulle bryta 11h dygnsvila."""
    d = date(2026, 6, 4)
    prev = d - timedelta(days=1)
    donor = _emp("D", "Donator", Group.SODRA)
    ostra = _emp("O", "Erik", Group.OSTRA)
    employees_by_id = {donor.id: donor, ostra.id: ostra}

    all_days = [
        _work_day(donor, prev, ShiftType.KVAL_LANG),  # slutar 21:30
        _obokad_day(donor.id, d),                      # enda kandidaten
        _obokad_day(ostra.id, d),
    ]
    # fm → DAG kl 07:00 dagen efter 21:30 = 9,5h vila < 11h → hårt regelbrott
    krav = [Bemanningskrav(group=Group.OSTRA, date=d, fm_heads=1)]

    res = run_global_borrowing(all_days, employees_by_id, krav, {}, TEMPLATES)

    assert res.loans == 0
    assert res.unfilled == 1
    donor_day = next(x for x in all_days if x.employee_id == "D" and x.date == d)
    assert donor_day.shift.is_unbooked is True   # rullades tillbaka till OBOKAD
    assert donor_day.assigned_group is None
