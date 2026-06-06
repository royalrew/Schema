# -*- coding: utf-8 -*-
"""
Enhetstester för Töreboda AI-schemamotor (Solver).

Innehåller:
  - Ursprungliga hårda regler (dygnsvila, veckovila, frånvaro, avtal)
  - Golden dataset-tester (100 anställda, skala, kontraktstyper, helg-varianter)
  - Mjuka regler: bemanningskrav
  - Fyllnadslogik: obokad tid
"""

import pytest
import time as _time_module
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.engine.schemas import (
    Employee, ContractType, Group, Shift, ShiftSegment, ShiftType,
    Absence, AbsenceType, ScheduleDay, Bemanningskrav, ValidationErrorDetail,
)
from app.engine.solver import validate_schedule, validate_staffing, fill_with_obokad
from tests.fixtures.golden_employees import (
    GOLDEN_EMPLOYEES,
    get_employees_by_group,
    get_employees_by_contract,
    get_employee_by_id,
)

STOCKHOLM = ZoneInfo("Europe/Stockholm")


def make_datetime(d: date, t: time) -> datetime:
    return datetime.combine(d, t).replace(tzinfo=STOCKHOLM)


def make_day_shift(d: date, start: time = time(7, 0), end: time = time(15, 0)) -> Shift:
    return Shift(
        shift_type=ShiftType.DAG,
        segments=[ShiftSegment(
            start_time=make_datetime(d, start),
            end_time=make_datetime(d, end),
        )]
    )


@pytest.fixture
def base_employee():
    return Employee(
        id="EMP01",
        name="Person A",
        contract_type=ContractType.VARIERANDE,
        group=Group.NORRA,
        absences=[],
        wishes=[],
        vetos=[]
    )


# =============================================================================
# URSPRUNGLIGA HÅRDA REGLER
# =============================================================================

def test_dygnsvila_valid(base_employee):
    """Giltig dygnsvila (precis 11h) godkänns."""
    d1, d2 = date(2026, 6, 1), date(2026, 6, 2)
    shift1 = Shift(shift_type=ShiftType.KVAL_KORT, segments=[ShiftSegment(
        start_time=make_datetime(d1, time(13, 45)),
        end_time=make_datetime(d1, time(20, 0))
    )])
    shift2 = Shift(shift_type=ShiftType.DAG, segments=[ShiftSegment(
        start_time=make_datetime(d2, time(7, 0)),
        end_time=make_datetime(d2, time(16, 0))
    )])
    result = validate_schedule(
        [ScheduleDay(date=d1, employee_id=base_employee.id, shift=shift1),
         ScheduleDay(date=d2, employee_id=base_employee.id, shift=shift2)],
        [base_employee]
    )
    assert result.is_valid, f"Schemat borde vara giltigt, fel: {result.errors}"


def test_dygnsvila_invalid(base_employee):
    """Ogiltig dygnsvila (9.5h) underkänns."""
    d1, d2 = date(2026, 6, 1), date(2026, 6, 2)
    shift1 = Shift(shift_type=ShiftType.KVAL_LANG, segments=[ShiftSegment(
        start_time=make_datetime(d1, time(13, 45)),
        end_time=make_datetime(d1, time(21, 30))
    )])
    shift2 = Shift(shift_type=ShiftType.DAG, segments=[ShiftSegment(
        start_time=make_datetime(d2, time(7, 0)),
        end_time=make_datetime(d2, time(16, 0))
    )])
    result = validate_schedule(
        [ScheduleDay(date=d1, employee_id=base_employee.id, shift=shift1),
         ScheduleDay(date=d2, employee_id=base_employee.id, shift=shift2)],
        [base_employee]
    )
    assert not result.is_valid
    hard = [e for e in result.errors if e.severity == "hard"]
    assert len(hard) == 1
    assert "dygnsvila" in hard[0].rule_name
    assert result.errors[0].employee_id == base_employee.id
    assert result.errors[0].date == d2


def test_delad_tur_dygnsvila(base_employee):
    """Dygnsvila efter delad tur mäts från sista segmentets slut."""
    d1, d2 = date(2026, 6, 1), date(2026, 6, 2)
    shift1 = Shift(shift_type=ShiftType.DELAD_TUR, segments=[
        ShiftSegment(start_time=make_datetime(d1, time(7, 0)),
                     end_time=make_datetime(d1, time(13, 0))),
        ShiftSegment(start_time=make_datetime(d1, time(15, 30)),
                     end_time=make_datetime(d1, time(21, 30))),
    ])
    shift2 = Shift(shift_type=ShiftType.DAG, segments=[ShiftSegment(
        start_time=make_datetime(d2, time(7, 0)),
        end_time=make_datetime(d2, time(16, 0))
    )])
    result = validate_schedule(
        [ScheduleDay(date=d1, employee_id=base_employee.id, shift=shift1),
         ScheduleDay(date=d2, employee_id=base_employee.id, shift=shift2)],
        [base_employee]
    )
    assert not result.is_valid
    assert any("dygnsvila" in err.rule_name for err in result.errors)


def test_absence_sparr(base_employee):
    """Schemaläggning under registrerad frånvaro underkänns."""
    d1 = date(2026, 6, 1)
    base_employee.absences.append(Absence(date=d1, absence_type=AbsenceType.SEM))
    shift = Shift(shift_type=ShiftType.DAG, segments=[ShiftSegment(
        start_time=make_datetime(d1, time(7, 0)),
        end_time=make_datetime(d1, time(16, 0))
    )])
    result = validate_schedule(
        [ScheduleDay(date=d1, employee_id=base_employee.id,
                     shift=shift, absence=base_employee.absences[0])],
        [base_employee]
    )
    assert not result.is_valid
    assert any("frånvarospärr" in err.rule_name for err in result.errors)


def test_veto_limit(base_employee):
    """Mer än 2 veton per månad underkänns."""
    d1, d2, d3 = date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)
    base_employee.vetos = [d1, d2, d3]
    result = validate_schedule(
        [ScheduleDay(date=d1, employee_id=base_employee.id, shift=None),
         ScheduleDay(date=d2, employee_id=base_employee.id, shift=None),
         ScheduleDay(date=d3, employee_id=base_employee.id, shift=None)],
        [base_employee]
    )
    assert not result.is_valid
    assert any("vetogräns" in err.rule_name for err in result.errors)


def test_dagtid_contract_rules(base_employee):
    """Dagtid-kontrakt får inte schemaläggas på lördag."""
    d_sat = date(2026, 6, 6)
    base_employee.contract_type = ContractType.DAGTID
    shift = Shift(shift_type=ShiftType.DAG, segments=[ShiftSegment(
        start_time=make_datetime(d_sat, time(7, 0)),
        end_time=make_datetime(d_sat, time(16, 0))
    )])
    result = validate_schedule(
        [ScheduleDay(date=d_sat, employee_id=base_employee.id, shift=shift)],
        [base_employee]
    )
    assert not result.is_valid
    assert any("avtalsbrott_dagar" in err.rule_name for err in result.errors)


# =============================================================================
# GOLDEN DATASET — SANITY
# =============================================================================

class TestGoldenDataset:
    _EXPECTED = 8 + 10 + 10 + 8 + 8 + 8 + 8 + 4  # = 64

    def test_antal_anstallda(self):
        assert len(GOLDEN_EMPLOYEES) == self._EXPECTED

    def test_unika_id(self):
        ids = [e.id for e in GOLDEN_EMPLOYEES]
        assert len(set(ids)) == self._EXPECTED

    def test_unika_namn(self):
        names = [e.name for e in GOLDEN_EMPLOYEES]
        assert len(set(names)) == self._EXPECTED, "Dubblerade namn hittades i golden dataset"

    def test_fordelning_grupper(self):
        expected = {
            Group.NORRA: 8, Group.SODRA: 10, Group.OSTRA: 10,
            Group.CENTRUM_1: 8, Group.CENTRUM_2: 8,
            Group.CENTRUM_3: 8, Group.MOHOLM: 8, Group.NATTEN: 4,
        }
        for group, antal in expected.items():
            actual = len(get_employees_by_group(group))
            assert actual == antal, f"{group.value}: förväntade {antal}, fick {actual}"

    def test_fordelning_kontrakt(self):
        assert len(get_employees_by_contract(ContractType.VARIERANDE)) >= 30
        assert len(get_employees_by_contract(ContractType.DAGTID)) >= 6
        assert len(get_employees_by_contract(ContractType.KVAL)) >= 6
        assert len(get_employees_by_contract(ContractType.HELG_FRE_SON)) >= 6
        assert len(get_employees_by_contract(ContractType.NATT)) >= 4

    def test_inga_mer_an_2_vetos(self):
        """Ingen anställd ska ha mer än 2 vetos."""
        assert all(len(e.vetos) <= 2 for e in GOLDEN_EMPLOYEES)

    def test_tom_manad_ar_giltig(self):
        """Alla anställda utan schemalagda pass ska valideras utan hårda fel."""
        empty_schedule = [
            ScheduleDay(date=date(2026, 6, d), employee_id=emp.id, shift=None)
            for emp in GOLDEN_EMPLOYEES
            for d in range(1, 31)
        ]
        result = validate_schedule(empty_schedule, GOLDEN_EMPLOYEES)
        hard_errors = [e for e in result.errors if e.severity == "hard"]
        assert not hard_errors, f"Oväntade hårda fel på tom månad: {hard_errors[:3]}"


# =============================================================================
# KONTRAKTSTYPSREGLER
# =============================================================================

class TestKontraktsregler:
    def test_helg_fre_son_fredag_ok(self):
        """HELG_FRE_SON kan jobba fredag."""
        emp = get_employees_by_contract(ContractType.HELG_FRE_SON)[0]
        friday = date(2026, 6, 5)  # Fredag
        assert friday.weekday() == 4
        schedule = [ScheduleDay(date=friday, employee_id=emp.id, shift=make_day_shift(friday))]
        result = validate_schedule(schedule, [emp])
        hard = [e for e in result.errors if e.severity == "hard" and "avtalsbrott" in e.rule_name]
        assert not hard, f"HELG_FRE_SON borde kunna jobba fredag: {hard}"

    def test_helg_fre_son_mandag_fel(self):
        """HELG_FRE_SON får INTE jobba måndag."""
        emp = get_employees_by_contract(ContractType.HELG_FRE_SON)[0]
        monday = date(2026, 6, 1)  # Måndag
        assert monday.weekday() == 0
        schedule = [ScheduleDay(date=monday, employee_id=emp.id, shift=make_day_shift(monday))]
        result = validate_schedule(schedule, [emp])
        assert any("avtalsbrott_dagar" in e.rule_name for e in result.errors)

    def test_helg_fre_son_tisdag_fel(self):
        """HELG_FRE_SON får INTE jobba tisdag."""
        emp = get_employees_by_contract(ContractType.HELG_FRE_SON)[0]
        tuesday = date(2026, 6, 2)  # Tisdag
        schedule = [ScheduleDay(date=tuesday, employee_id=emp.id, shift=make_day_shift(tuesday))]
        result = validate_schedule(schedule, [emp])
        assert any("avtalsbrott_dagar" in e.rule_name for e in result.errors)

    def test_helg_lor_man_lordag_ok(self):
        """HELG_LOR_MAN kan jobba lördag."""
        emp = get_employees_by_contract(ContractType.HELG_LOR_MAN)[0]
        saturday = date(2026, 6, 6)  # Lördag
        assert saturday.weekday() == 5
        schedule = [ScheduleDay(date=saturday, employee_id=emp.id, shift=make_day_shift(saturday))]
        result = validate_schedule(schedule, [emp])
        hard = [e for e in result.errors if e.severity == "hard" and "avtalsbrott" in e.rule_name]
        assert not hard

    def test_helg_lor_man_mandag_ok(self):
        """HELG_LOR_MAN kan jobba måndag."""
        emp = get_employees_by_contract(ContractType.HELG_LOR_MAN)[0]
        monday = date(2026, 6, 1)  # Måndag
        schedule = [ScheduleDay(date=monday, employee_id=emp.id, shift=make_day_shift(monday))]
        result = validate_schedule(schedule, [emp])
        hard = [e for e in result.errors if e.severity == "hard" and "avtalsbrott" in e.rule_name]
        assert not hard

    def test_helg_lor_man_tisdag_fel(self):
        """HELG_LOR_MAN får INTE jobba tisdag."""
        emp = get_employees_by_contract(ContractType.HELG_LOR_MAN)[0]
        tuesday = date(2026, 6, 2)  # Tisdag
        schedule = [ScheduleDay(date=tuesday, employee_id=emp.id, shift=make_day_shift(tuesday))]
        result = validate_schedule(schedule, [emp])
        assert any("avtalsbrott_dagar" in e.rule_name for e in result.errors)

    def test_dagtid_sondag_fel(self):
        """DAGTID får INTE jobba söndag."""
        emp = get_employees_by_contract(ContractType.DAGTID)[0]
        sunday = date(2026, 6, 7)  # Söndag
        assert sunday.weekday() == 6
        schedule = [ScheduleDay(date=sunday, employee_id=emp.id, shift=make_day_shift(sunday))]
        result = validate_schedule(schedule, [emp])
        assert any("avtalsbrott_dagar" in e.rule_name for e in result.errors)

    def test_varierande_alla_dagar_ok(self):
        """VARIERANDE kan jobba alla veckodagar utan avtalsbrott."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0]
        week = [date(2026, 6, 1) + timedelta(days=i) for i in range(7)]
        for d in week:
            schedule = [ScheduleDay(date=d, employee_id=emp.id, shift=make_day_shift(d))]
            result = validate_schedule(schedule, [emp])
            hard = [e for e in result.errors if "avtalsbrott" in e.rule_name]
            assert not hard, f"VARIERANDE borde kunna jobba {d.strftime('%A')}: {hard}"


# =============================================================================
# BEMANNINGSKRAV (SOFT RULES)
# =============================================================================

class TestBemanningskrav:
    def test_underbemanning_genererar_soft_varning(self):
        """Underbemanning ger soft-varning men is_valid förblir True."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0]
        d = date(2026, 6, 9)

        # Krav: 3 på fm, men ingen schemalagd
        krav = [Bemanningskrav(group=emp.group, date=d, fm_heads=3, em_heads=0, kval_heads=0, natt_heads=0)]
        empty_schedule = [ScheduleDay(date=d, employee_id=emp.id, shift=None)]

        warnings = validate_staffing(empty_schedule, [emp], krav)
        assert any(w.severity == "soft" for w in warnings)
        assert any("bemanningskrav" in w.rule_name for w in warnings)

    def test_tillracklig_bemanning_ger_inga_varningar(self):
        """Tillräcklig bemanning ger inga varningar."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0]
        d = date(2026, 6, 9)
        krav = [Bemanningskrav(group=emp.group, date=d, fm_heads=1, em_heads=0, kval_heads=0, natt_heads=0)]
        schedule = [ScheduleDay(date=d, employee_id=emp.id,
                                shift=make_day_shift(d, time(7, 0), time(15, 0)))]

        warnings = validate_staffing(schedule, [emp], krav)
        fm_warnings = [w for w in warnings if "fm" in w.message.lower()]
        assert not fm_warnings

    def test_soft_fel_blockerar_inte_is_valid(self):
        """Soft-fel från bemanningskrav ska INTE påverka validate_schedule is_valid."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0]
        d = date(2026, 6, 9)
        empty_schedule = [ScheduleDay(date=d, employee_id=emp.id, shift=None)]

        result = validate_schedule(empty_schedule, [emp])
        assert result.is_valid


# =============================================================================
# OBOKAD FILLER
# =============================================================================

class TestObokadFiller:
    def test_fyller_lediga_dagar(self):
        """fill_with_obokad lägger OBOKAD på lediga dagar när timmar saknas."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0]
        # Tom månad → systemet ska fylla på med obokad
        obokade = fill_with_obokad(emp, [], date(2026, 6, 1), date(2026, 6, 30))
        assert len(obokade) > 0
        assert all(sd.shift and sd.shift.is_unbooked for sd in obokade)
        assert all(sd.shift and sd.shift.shift_type == ShiftType.OBOKAD for sd in obokade)

    def test_fyller_inte_om_tillrackliga_timmar(self):
        """fill_with_obokad lägger INTE obokad om kontraktet redan är uppfyllt."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0]
        # Schemalägg 37h/vecka × 4 veckor = 148h via dagpass à 8h → behöver 18-19 pass
        period_start = date(2026, 6, 1)
        period_end = date(2026, 6, 28)
        num_weeks = 4.0
        target = 37.0 * num_weeks  # 148h

        schedule = []
        current = period_start
        hours_scheduled = 0.0
        while current <= period_end and hours_scheduled < target:
            if current.weekday() < 5:  # Mån-Fre (VARIERANDE tillåter alla dagar men vi håller det enkelt)
                schedule.append(ScheduleDay(
                    date=current,
                    employee_id=emp.id,
                    shift=make_day_shift(current, time(7, 0), time(15, 0))  # 8h
                ))
                hours_scheduled += 8.0
            current += timedelta(days=1)

        obokade = fill_with_obokad(emp, schedule, period_start, period_end)
        total_obokad_hours = sum(sd.shift.total_hours for sd in obokade if sd.shift)
        assert total_obokad_hours <= 8.0, "Maximalt en liten rest får fyllas"

    def test_fyller_inte_pa_franvarodagar(self):
        """fill_with_obokad respekterar frånvaro och lägger inte OBOKAD på frånvarodagar."""
        from app.engine.schemas import Absence, AbsenceType
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0].model_copy()
        emp.absences = [
            Absence(date=date(2026, 6, d), absence_type=AbsenceType.SEM)
            for d in range(2, 14)
        ]
        obokade = fill_with_obokad(emp, [], date(2026, 6, 1), date(2026, 6, 30))
        absence_dates = {a.date for a in emp.absences}
        for sd in obokade:
            assert sd.date not in absence_dates, f"OBOKAD lagd på frånvarodag {sd.date}"

    def test_helg_fre_son_fyller_bara_tillated_dagar(self):
        """HELG_FRE_SON fylls bara med OBOKAD på fre/lör/sön."""
        emp = get_employees_by_contract(ContractType.HELG_FRE_SON)[0]
        obokade = fill_with_obokad(emp, [], date(2026, 6, 1), date(2026, 6, 30))
        allowed = {4, 5, 6}  # fre, lör, sön
        for sd in obokade:
            assert sd.date.weekday() in allowed, (
                f"OBOKAD lagd på förbjuden dag {sd.date.strftime('%A')}: {sd.date}"
            )

    def test_vikarie_far_aldrig_obokad(self):
        """VIKARIE fylls aldrig med OBOKAD tid."""
        emp = get_employees_by_contract(ContractType.VARIERANDE)[0].model_copy()
        emp.contract_type = ContractType.VIKARIE
        obokade = fill_with_obokad(emp, [], date(2026, 6, 1), date(2026, 6, 30))
        assert len(obokade) == 0



# =============================================================================
# SKALA — hela golden dataset valideras snabbt
# =============================================================================

class TestSkala:
    def test_golden_dataset_valideras_under_en_sekund(self):
        """Validering av 64 anst × 30 dagar (tom månad) ska klara sig på under 1 sek."""
        empty_schedule = [
            ScheduleDay(date=date(2026, 6, d), employee_id=emp.id, shift=None)
            for emp in GOLDEN_EMPLOYEES
            for d in range(1, 31)
        ]
        t0 = _time_module.monotonic()
        result = validate_schedule(empty_schedule, GOLDEN_EMPLOYEES)
        elapsed = _time_module.monotonic() - t0

        hard_errors = [e for e in result.errors if e.severity == "hard"]
        assert not hard_errors
        assert elapsed < 1.0, f"Validering tog {elapsed:.2f}s — för långsamt!"

    def test_alla_kontraktstyper_representerade(self):
        """Alla 6 kontraktstyper finns i golden dataset."""
        types_present = {e.contract_type for e in GOLDEN_EMPLOYEES}
        for ct in ContractType:
            assert ct in types_present, f"{ct.value} saknas i golden dataset"
