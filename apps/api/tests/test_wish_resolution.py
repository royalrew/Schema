# -*- coding: utf-8 -*-
"""
Tests for automatic wish conflict resolution (day-shift overcapacity).
"""

from datetime import date
from app.engine.schemas import Employee, ContractType, Group, Bemanningskrav, ShiftType
from app.engine.generator import generate_schedule

def test_wish_resolution_prioritizes_dagansvarig_and_shifts_ordinary():
    # En dag: 2026-06-01 (Måndag)
    test_date = date(2026, 6, 1)
    
    # 4 anställda: 1 dagansvarig, 3 varierande (vanliga)
    # Alla önskar jobba på denna dag (som standard-önskemål wishing for day)
    employees = [
        Employee(
            id="T01",
            name="Sara (Dagansvarig)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            is_dagansvarig=True,
            wishes=[test_date],
        ),
        Employee(
            id="T02",
            name="Anders (Vanlig 1)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            is_dagansvarig=False,
            wishes=[test_date],
        ),
        Employee(
            id="T03",
            name="Bengt (Vanlig 2)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            is_dagansvarig=False,
            wishes=[test_date],
        ),
        Employee(
            id="T04",
            name="Cecilia (Vanlig 3)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            is_dagansvarig=False,
            wishes=[test_date],
        ),
    ]

    # Bemanningskrav: 2 fm, 2 kval
    krav = [
        Bemanningskrav(
            group=Group.NORRA,
            date=test_date,
            fm_heads=2,
            kval_heads=2,
        )
    ]

    # Generera schema
    schedule, stats = generate_schedule(employees, krav, test_date, test_date)

    # 1. Kontrollera att inga hårda fel uppstår
    assert stats["hard_errors"] == 0, f"Förväntade noll hårda fel, fick: {stats['hard_errors']}"

    # Indexera tilldelningarna
    assignments = {sd.employee_id: sd for sd in schedule if sd.date == test_date}

    # 2. Kontrollera att Sara (dagansvarig) fick dagpass
    sara_day = assignments["T01"]
    assert sara_day.shift is not None, "Sara borde ha schemalagts"
    assert sara_day.shift.shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG), "Sara måste ha fått ett dagpass"

    # 3. Kontrollera att 1 av de övriga fick dagpass, och 2 fick kvällspass
    ordinary_assignments = [assignments["T02"], assignments["T03"], assignments["T04"]]
    
    day_count = 0
    kval_count = 0
    shifted_names = []
    
    for sd in ordinary_assignments:
        assert sd.shift is not None, f"Anställd {sd.employee_id} borde ha blivit schemalagd"
        if sd.shift.shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG):
            day_count += 1
        elif sd.shift.shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG):
            kval_count += 1
            shifted_names.append(sd.employee_id)

    assert day_count == 1, f"Exakt en vanlig anställd borde ha fått dagpass, fick {day_count}"
    assert kval_count == 2, f"Exakt två vanliga anställda borde ha flyttats till kvällspass, fick {kval_count}"

    # 4. Kontrollera att beslutsloggen innehåller önskemålskorrigering
    decisions = stats["decisions"]
    log_found = False
    for dec in decisions:
        if "[Önskemålskorrigering]" in dec:
            log_found = True
            break
            
    assert log_found, "Hittade ingen logg om önskemålskorrigering i beslutsloggen"


def test_wish_resolution_prioritizes_kval_contract_and_shifts_ordinary():
    from app.engine.schemas import WishShiftEntry
    test_date = date(2026, 6, 1)
    date_str = test_date.isoformat()
    
    # 4 anställda: 1 kvällsmedarbetare, 3 varierande
    # Alla önskar kvällspass
    employees = [
        Employee(
            id="T01",
            name="Karin (Kvällsmedarbetare)",
            contract_type=ContractType.KVAL,
            group=Group.NORRA,
            wish_schedule=[
                WishShiftEntry(date=date_str, shift_type="kval_kort", start_time="13:45", end_time="20:00")
            ],
        ),
        Employee(
            id="T02",
            name="Anders (Vanlig 1)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            wish_schedule=[
                WishShiftEntry(date=date_str, shift_type="kval_kort", start_time="13:45", end_time="20:00")
            ],
        ),
        Employee(
            id="T03",
            name="Bengt (Vanlig 2)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            wish_schedule=[
                WishShiftEntry(date=date_str, shift_type="kval_kort", start_time="13:45", end_time="20:00")
            ],
        ),
        Employee(
            id="T04",
            name="Cecilia (Vanlig 3)",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            wish_schedule=[
                WishShiftEntry(date=date_str, shift_type="kval_kort", start_time="13:45", end_time="20:00")
            ],
        ),
    ]

    # Bemanningskrav: 2 fm, 2 kval
    krav = [
        Bemanningskrav(
            group=Group.NORRA,
            date=test_date,
            fm_heads=2,
            kval_heads=2,
        )
    ]

    # Generera schema
    schedule, stats = generate_schedule(employees, krav, test_date, test_date)

    # Kontrollera inga hårda fel
    assert stats["hard_errors"] == 0, f"Hårda fel: {stats['hard_errors']}"

    # Indexera tilldelningarna
    assignments = {sd.employee_id: sd for sd in schedule if sd.date == test_date}

    # Karin (kvällskontrakt) måste ha fått ett kvällspass
    karin_day = assignments["T01"]
    assert karin_day.shift is not None, "Karin borde ha schemalagts"
    assert karin_day.shift.shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG), "Karin måste ha fått kvällspass"

    # Av de 3 varierande ska 1 ha fått kvällspass, och 2 ha fått dagpass
    ordinary_assignments = [assignments["T02"], assignments["T03"], assignments["T04"]]
    
    day_count = 0
    kval_count = 0
    
    for sd in ordinary_assignments:
        assert sd.shift is not None, f"Medarbetare {sd.employee_id} saknar pass"
        if sd.shift.shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG):
            day_count += 1
        elif sd.shift.shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG):
            kval_count += 1

    assert kval_count == 1, f"Exakt 1 vanlig borde ha fått kvällspass, fick {kval_count}"
    assert day_count == 2, f"Exakt 2 vanliga borde ha flyttats till dagpass, fick {day_count}"

    # Kontrollera beslutsloggen för kvällskorrigering
    decisions = stats["decisions"]
    log_found = False
    for dec in decisions:
        if "[Önskemålskorrigering]" in dec and "flyttades till dagpass" in dec:
            log_found = True
            break
            
    assert log_found, "Hittade ingen logg om kvällskorrigering i beslutsloggen"


def test_target_shifts_prioritization_and_validation():
    from app.engine.solver import validate_schedule
    from app.engine.schemas import ScheduleDay, Shift, ShiftSegment
    from zoneinfo import ZoneInfo
    from datetime import datetime
    STOCKHOLM = ZoneInfo("Europe/Stockholm")
    
    test_date = date(2026, 6, 1)
    
    # T01 (Anders): vill ha 1 dagpass, 0 kvällspass
    # T02 (Bengt): vill ha 0 dagpass, 1 kvällspass
    employees = [
        Employee(
            id="T01",
            name="Anders",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            target_days_per_month=1,
            target_evenings_per_month=0,
        ),
        Employee(
            id="T02",
            name="Bengt",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            target_days_per_month=0,
            target_evenings_per_month=1,
        ),
    ]

    # Bemanningskrav: 1 fm, 1 kval
    krav = [
        Bemanningskrav(
            group=Group.NORRA,
            date=test_date,
            fm_heads=1,
            kval_heads=1,
        )
    ]

    # 1. GENERATORTILLDELNING: Borde tilldela enligt deras önskade mål
    schedule, stats = generate_schedule(employees, krav, test_date, test_date)
    assert stats["hard_errors"] == 0
    
    assignments = {sd.employee_id: sd for sd in schedule if sd.date == test_date}
    
    # Anders (T01) ska ha tilldelats dagpass för att uppfylla sitt mål
    anders_day = assignments["T01"]
    assert anders_day.shift is not None
    assert anders_day.shift.shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG)

    # Bengt (T02) ska ha tilldelats kvällspass för att uppfylla sitt mål
    bengt_day = assignments["T02"]
    assert bengt_day.shift is not None
    assert bengt_day.shift.shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG)

    # Inga mjuka avvikelser för målen ska finnas eftersom de uppfylldes
    target_warnings = [e for e in stats["validation"].errors if "avvikelse" in e.rule_name]
    assert len(target_warnings) == 0

    # 2. SOLVERVALIDERING: Om vi byter pass manuellt så att målen missas
    # Skapa felaktigt manuellt schema: Anders på kväll, Bengt på dag
    from app.engine.generator import SHIFT_TEMPLATES
    
    def make_shift_for_test(stype):
        start_t, end_t = SHIFT_TEMPLATES[stype]
        start_dt = datetime(test_date.year, test_date.month, test_date.day, start_t.hour, start_t.minute, tzinfo=STOCKHOLM)
        end_dt = datetime(test_date.year, test_date.month, test_date.day, end_t.hour, end_t.minute, tzinfo=STOCKHOLM)
        return Shift(shift_type=stype, segments=[ShiftSegment(start_time=start_dt, end_time=end_dt)])

    wrong_schedule = [
        ScheduleDay(
            date=test_date,
            employee_id="T01",
            shift=make_shift_for_test(ShiftType.KVAL_KORT),
        ),
        ScheduleDay(
            date=test_date,
            employee_id="T02",
            shift=make_shift_for_test(ShiftType.DAG),
        )
    ]
    
    validation = validate_schedule(wrong_schedule, employees, krav)
    
    # Kontrollera att mjuka varningar för målavvikelser genereras
    warnings = [e for e in validation.errors if "avvikelse" in e.rule_name]
    assert len(warnings) == 4  # T01 har +1 kväll, -1 dag; T02 har +1 dag, -1 kväll
    
    rule_names = {w.rule_name for w in warnings}
    assert "mal_dagar_avvikelse" in rule_names
    assert "mal_kvallar_avvikelse" in rule_names


def test_wish_delad_tur_assigned():
    from app.engine.schemas import WishShiftEntry
    test_date = date(2026, 6, 1)
    date_str = test_date.isoformat()
    
    # 3 anställda: Sara önskar delad_tur. Anders och Bengt har inga önskemål.
    employees = [
        Employee(
            id="T01",
            name="Sara",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            wish_schedule=[
                WishShiftEntry(date=date_str, shift_type="delad_tur", start_time="07:00", end_time="20:00")
            ],
        ),
        Employee(
            id="T02",
            name="Anders",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
        ),
        Employee(
            id="T03",
            name="Bengt",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
        ),
    ]

    # Bemanningskrav: 2 fm (Sara och en till), 1 kval (Sara)
    # Eftersom Sara gör delad tur, täcker hon 1 fm och 1 kval.
    # Då behövs ytterligare 1 person på fm (vilket blir Anders eller Bengt för nattrapporten/DAG_TIDIG).
    # Den tredje personen (Bengt eller Anders) ska vara ledig.
    krav = [
        Bemanningskrav(
            group=Group.NORRA,
            date=test_date,
            fm_heads=2,
            kval_heads=1,
        )
    ]

    schedule, stats = generate_schedule(employees, krav, test_date, test_date)

    assert stats["hard_errors"] == 0, f"Förväntade noll hårda fel, fick: {stats['hard_errors']}"

    assignments = {sd.employee_id: sd for sd in schedule if sd.date == test_date}

    # T01 (Sara) ska ha fått DELAD_TUR
    sara_day = assignments["T01"]
    assert sara_day.shift is not None, "Sara borde ha schemalagts"
    assert sara_day.shift.shift_type == ShiftType.DELAD_TUR, "Sara borde ha fått delad tur"
    assert len(sara_day.shift.segments) == 2, "Delad tur ska ha 2 segment"

    # En av de andra ska ha fått DAG_TIDIG för nattrapporten
    # Den sista ska vara helt ledig (shift=None)
    shifts = [assignments["T02"].shift, assignments["T03"].shift]
    assert any(s is None for s in shifts), "En av Anders eller Bengt måste vara ledig"
    assert any(s is not None and s.shift_type == ShiftType.DAG_TIDIG for s in shifts), "En av dem måste ha fått DAG_TIDIG"

