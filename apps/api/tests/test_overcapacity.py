# -*- coding: utf-8 -*-
"""
Enhetstester för avancerad timbemanning, överkapacitetshantering och shift-splitting.
"""

import pytest
from datetime import date, datetime
from zoneinfo import ZoneInfo
from app.engine.schemas import (
    Employee, ContractType, Group, Bemanningskrav, HourlyRequirement,
    Shift, ShiftSegment, ShiftType
)
from app.engine.generator import generate_schedule

STOCKHOLM = ZoneInfo("Europe/Stockholm")


def test_allocate_overcapacity_splitting_and_priority():
    # ── 1. Skapa testdata ──
    # Medarbetare 1: Ordinarie, planerare
    emp_planerare = Employee(
        id="EMP_PLANERARE",
        name="Anna Planerare",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        is_dagansvarig=False,
        is_planerare=True,
        percentage=1.0,
    )
    # Medarbetare 2: Ordinarie, ej planerare
    emp_regular1 = Employee(
        id="EMP_REGULAR1",
        name="Bengt Regular",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        is_dagansvarig=False,
        is_planerare=False,
        percentage=1.0,
    )
    # Medarbetare 3: Ordinarie, ej planerare
    emp_regular2 = Employee(
        id="EMP_REGULAR2",
        name="Cecilia Regular",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        is_dagansvarig=False,
        is_planerare=False,
        percentage=1.0,
    )
    # Medarbetare 4: Vikarie (ska aldrig få planeringstid/kontorstid)
    emp_vikarie = Employee(
        id="EMP_VIKARIE",
        name="Viktor Vikarie",
        contract_type=ContractType.VIKARIE,
        group=Group.OSTRA,
        is_dagansvarig=False,
        is_planerare=False,
        percentage=1.0,
    )

    employees = [emp_planerare, emp_regular1, emp_regular2, emp_vikarie]

    test_date = date(2026, 6, 1)

    # Bemanningskrav med timkrav: mellan 14:00 och 16:00 behövs endast 2 aktiva personer
    timkrav = HourlyRequirement(
        start_time="14:00",
        end_time="16:00",
        needed_heads=2,
        prioritized_activities=["planeringstid", "kontorstid"]
    )
    
    krav = [
        Bemanningskrav(
            group=Group.OSTRA,
            date=test_date,
            fm_heads=4,  # Vi schemalägger 4 personer
            em_heads=0,
            kval_heads=0,
            natt_heads=0,
            hourly_requirements=[timkrav]
        )
    ]

    # Kör schemagenereringen
    # (Alla 4 kommer att schemaläggas på ett DAG-pass under förmiddagen eftersom fm_heads=4)
    # Detta skapar en överkapacitet på 2 personer under intervallet 14:00-16:00.
    period_start = test_date
    period_end = test_date
    
    schedule_days, stats = generate_schedule(employees, krav, period_start, period_end)

    # ── 2. Verifiera resultat ──
    # Kontrollera att det finns beslut i loggen om överkapacitet
    overcap_decisions = [d for d in stats["decisions"] if "[Överkapacitet]" in d]
    assert len(overcap_decisions) == 2

    # Verify that Anna Planerare got PLANERINGSTID because is_planerare = True
    planerare_day = next(sd for sd in schedule_days if sd.employee_id == emp_planerare.id)
    assert planerare_day.shift is not None
    # Passet ska vara splittat i 2 segment: 07:00-14:00 (aktiv) och 14:00-16:00 (planeringstid)
    assert len(planerare_day.shift.segments) == 2
    seg1, seg2 = planerare_day.shift.segments
    assert seg1.start_time in (
        datetime(2026, 6, 1, 7, 0, tzinfo=STOCKHOLM),
        datetime(2026, 6, 1, 6, 45, tzinfo=STOCKHOLM)
    )
    assert seg1.end_time == datetime(2026, 6, 1, 14, 0, tzinfo=STOCKHOLM)
    assert seg1.activity is None  # standard pass
    
    assert seg2.start_time == datetime(2026, 6, 1, 14, 0, tzinfo=STOCKHOLM)
    assert seg2.end_time == datetime(2026, 6, 1, 16, 0, tzinfo=STOCKHOLM)
    assert seg2.activity == ShiftType.PLANERINGSTID

    # Verify that Viktor Vikarie did NOT get planeringstid or kontorstid
    vikarie_day = next(sd for sd in schedule_days if sd.employee_id == emp_vikarie.id)
    if vikarie_day.shift:
        for seg in vikarie_day.shift.segments:
            assert seg.activity not in (ShiftType.PLANERINGSTID, ShiftType.KONTORSTID)

    # Kontrollera att en av de andra ordinarie (t.ex. Bengt eller Cecilia) fick planeringstid
    reg1_day = next(sd for sd in schedule_days if sd.employee_id == emp_regular1.id)
    reg2_day = next(sd for sd in schedule_days if sd.employee_id == emp_regular2.id)

    has_planning_reg = False
    for rday in (reg1_day, reg2_day):
        if rday.shift and len(rday.shift.segments) == 2:
            if rday.shift.segments[1].activity == ShiftType.PLANERINGSTID:
                has_planning_reg = True
                
    assert has_planning_reg


def test_allocate_overcapacity_fairness_rotation():
    from app.engine.generator import allocate_overcapacity
    from app.engine.schemas import ScheduleDay
    
    emp_regular1 = Employee(
        id="EMP_REG1",
        name="Bengt Regular",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        is_dagansvarig=False,
        is_planerare=False,
        percentage=1.0,
    )
    emp_regular2 = Employee(
        id="EMP_REG2",
        name="Cecilia Regular",
        contract_type=ContractType.VARIERANDE,
        group=Group.OSTRA,
        is_dagansvarig=False,
        is_planerare=False,
        percentage=1.0,
    )
    
    test_date = date(2026, 6, 1)
    
    # Båda har ett DAG-pass på test_date (07:00-16:00)
    shift1 = Shift(
        shift_type=ShiftType.DAG,
        segments=[ShiftSegment(
            start_time=datetime(2026, 6, 1, 7, 0, tzinfo=STOCKHOLM),
            end_time=datetime(2026, 6, 1, 16, 0, tzinfo=STOCKHOLM)
        )]
    )
    shift2 = Shift(
        shift_type=ShiftType.DAG,
        segments=[ShiftSegment(
            start_time=datetime(2026, 6, 1, 7, 0, tzinfo=STOCKHOLM),
            end_time=datetime(2026, 6, 1, 16, 0, tzinfo=STOCKHOLM)
        )]
    )
    
    sd1 = ScheduleDay(date=test_date, employee_id=emp_regular1.id, shift=shift1)
    sd2 = ScheduleDay(date=test_date, employee_id=emp_regular2.id, shift=shift2)
    
    # Bengt (EMP_REG1) har REDAN fått planeringstid den 2026-06-02 (en annan dag i perioden)
    # Det innebär att han har 1 planeringsdag, medan Cecilia (EMP_REG2) har 0.
    shift_planning = Shift(
        shift_type=ShiftType.DAG,
        segments=[ShiftSegment(
            start_time=datetime(2026, 6, 2, 7, 0, tzinfo=STOCKHOLM),
            end_time=datetime(2026, 6, 2, 16, 0, tzinfo=STOCKHOLM),
            activity=ShiftType.PLANERINGSTID
        )]
    )
    sd1_already_planning = ScheduleDay(date=date(2026, 6, 2), employee_id=emp_regular1.id, shift=shift_planning)
    
    schedule_days = [sd1, sd2, sd1_already_planning]
    
    # Timkrav: 14:00-16:00, behövs 1 aktiv. Det betyder att vi har 2 aktiva (Bengt och Cecilia)
    # och har ett överskott på 1 person som ska tilldelas PLANERINGSTID.
    timkrav = HourlyRequirement(
        start_time="14:00",
        end_time="16:00",
        needed_heads=1,
        prioritized_activities=["planeringstid"]
    )
    krav = [
        Bemanningskrav(
            group=Group.OSTRA,
            date=test_date,
            fm_heads=2,
            em_heads=0,
            kval_heads=0,
            natt_heads=0,
            hourly_requirements=[timkrav]
        )
    ]
    
    decisions = []
    allocate_overcapacity(schedule_days, [emp_regular1, emp_regular2], krav, decisions)
    
    # Eftersom Cecilia hade 0 planeringstillfällen och Bengt hade 1, ska Cecilia (EMP_REG2)
    # ha tilldelats planeringstid för den 1 juni.
    # Bengts pass för den 1 juni ska fortfarande ha 1 segment (och ingen planeringstid).
    assert len(sd2.shift.segments) == 2
    assert sd2.shift.segments[1].activity == ShiftType.PLANERINGSTID
    
    assert len(sd1.shift.segments) == 1
    assert sd1.shift.segments[0].activity is None
