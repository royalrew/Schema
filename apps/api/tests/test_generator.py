# -*- coding: utf-8 -*-
"""
Golden tests för schema-generatorn — önskeschema och deterministisk fallback.

Scenarion:
  1. Ingen har lagt in önskeschema → deterministisk, inga hårda fel
  2. En person har önskemål → prioriteras den dagen
  3. Önskemål på frånvarodag → ignoreras
  4. Önskemål när regeln skulle brytas (dygnsvila) → önskemålet hoppas över
  5. Hela Norra-gruppen genereras utan önskemål → korrekt bemanning
"""

from datetime import date, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    Bemanningskrav, ShiftType,
)
from app.engine.generator import generate_schedule
from tests.fixtures.golden_employees import get_employees_by_group

STOCKHOLM = ZoneInfo("Europe/Stockholm")

# Testperiod: en vecka i juni 2026
MON = date(2026, 6, 1)
SUN = date(2026, 6, 7)
WEEK = [MON + timedelta(days=i) for i in range(7)]


def _emp(num: int, name: str, ct: ContractType,
         wishes: list[date] | None = None,
         absences: list[Absence] | None = None,
         vetos: list[date] | None = None) -> Employee:
    return Employee(
        id=f"T{num:02d}",
        name=name,
        contract_type=ct,
        group=Group.NORRA,
        absences=absences or [],
        wishes=wishes or [],
        vetos=vetos or [],
    )


def _krav(d: date, fm: int = 1, kval: int = 1) -> Bemanningskrav:
    return Bemanningskrav(group=Group.NORRA, date=d, fm_heads=fm, kval_heads=kval,
                          em_heads=0, natt_heads=0)


# =============================================================================
# 1. INGEN HAR LAGT IN ÖNSKESCHEMA — DETERMINISTISK FALLBACK
# =============================================================================

class TestIngetOnskeschema:
    """Om ingen lämnar önskemål ska det deterministiska schemat köras rent."""

    def test_schema_genereras_utan_harda_fel(self):
        employees = [
            _emp(1, "Anna",    ContractType.VARIERANDE),
            _emp(2, "Björn",   ContractType.VARIERANDE),
            _emp(3, "Carin",   ContractType.VARIERANDE),
            _emp(4, "David",   ContractType.KVAL),
            _emp(5, "Eva",     ContractType.KVAL),
            _emp(6, "Filip",   ContractType.DAGTID),
            _emp(7, "Gunnar",  ContractType.HELG_FRE_MAN),
        ]
        krav = [_krav(d) for d in WEEK]
        schedule, stats = generate_schedule(employees, krav, MON, SUN)

        hard_errors = stats["hard_errors"]
        assert hard_errors == 0, f"Hårda fel utan önskemål: {hard_errors}"

    def test_fm_bemanning_uppfylls(self):
        """Varje dag ska ha minst 1 fm-personal schemalagd."""
        employees = [
            _emp(1, "Anna",  ContractType.VARIERANDE),
            _emp(2, "Björn", ContractType.VARIERANDE),
            _emp(3, "Carin", ContractType.VARIERANDE),
            _emp(4, "David", ContractType.KVAL),
        ]
        krav = [_krav(d, fm=1, kval=1) for d in WEEK]
        schedule, _ = generate_schedule(employees, krav, MON, SUN)

        schedule_idx = {(sd.employee_id, str(sd.date)): sd for sd in schedule}

        for d in WEEK:
            if d.weekday() < 5:  # vardagar
                dag_count = sum(
                    1 for emp in employees
                    if (sd := schedule_idx.get((emp.id, str(d))))
                    and sd.shift
                    and sd.shift.shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG)
                )
                assert dag_count >= 1, f"Ingen fm-personal på {d}"


# =============================================================================
# 2. ÖNSKEMÅL GER FÖRTUR
# =============================================================================

class TestOnskemalGerFortur:
    """Anställd med önskemål på dag X ska prioriteras den dagen."""

    def test_onskad_dag_schemalagd(self):
        dag = date(2026, 6, 3)  # Onsdag
        employees = [
            _emp(1, "Anna",  ContractType.VARIERANDE, wishes=[dag]),  # vill jobba ons
            _emp(2, "Björn", ContractType.VARIERANDE),
            _emp(3, "Carin", ContractType.VARIERANDE),
            _emp(4, "David", ContractType.KVAL),
        ]
        krav = [_krav(dag, fm=1, kval=1)]
        schedule, _ = generate_schedule(employees, krav, dag, dag)

        anna = next((sd for sd in schedule if sd.employee_id == "T01" and sd.date == dag), None)
        assert anna is not None and anna.shift is not None, \
            "Anna med önskemål på dag 3 ska vara schemalagd"

    def test_onskemalet_ger_prioritet_over_jamngamla(self):
        """Om två anställda är lika qualificerade vinner den med önskemål."""
        dag = date(2026, 6, 1)  # Måndag
        employees = [
            _emp(1, "Anna",  ContractType.VARIERANDE, wishes=[dag]),
            _emp(2, "Björn", ContractType.VARIERANDE),  # ingen önskan
        ]
        krav = [_krav(dag, fm=1, kval=0)]
        schedule, _ = generate_schedule(employees, krav, dag, dag)

        anna = next((sd for sd in schedule if sd.employee_id == "T01" and sd.date == dag), None)
        assert anna is not None and anna.shift is not None, \
            "Anna med önskemål ska prioriteras framför Björn utan önskemål"

    def test_flera_med_onskemål_pa_samma_dag(self):
        """Flera med önskemål på samma dag ska alla kunna schemaläggas om platser finns."""
        dag = date(2026, 6, 2)  # Tisdag
        employees = [
            _emp(1, "Anna",  ContractType.VARIERANDE, wishes=[dag]),
            _emp(2, "Björn", ContractType.VARIERANDE, wishes=[dag]),
            _emp(3, "Carin", ContractType.VARIERANDE),
            _emp(4, "David", ContractType.KVAL),
        ]
        krav = [_krav(dag, fm=2, kval=1)]
        schedule, _ = generate_schedule(employees, krav, dag, dag)

        schemalagda_med_onske = [
            sd for sd in schedule
            if sd.employee_id in ("T01", "T02") and sd.date == dag and sd.shift
        ]
        assert len(schemalagda_med_onske) == 2, \
            "Båda med önskemål ska schemaläggas när platser finns"


# =============================================================================
# 3. ÖNSKEMÅL PÅ FRÅNVARODAG IGNORERAS
# =============================================================================

class TestOnskemalIgnorerasFranvaro:
    def test_onske_pa_franvaro_ignoreras(self):
        dag = date(2026, 6, 3)
        employees = [
            _emp(1, "Anna",  ContractType.VARIERANDE,
                 wishes=[dag],
                 absences=[Absence(date=dag, absence_type=AbsenceType.SEM)]),
            _emp(2, "Björn", ContractType.VARIERANDE),
            _emp(3, "Carin", ContractType.VARIERANDE),
        ]
        krav = [_krav(dag, fm=1, kval=0)]
        schedule, stats = generate_schedule(employees, krav, dag, dag)

        anna = next((sd for sd in schedule if sd.employee_id == "T01" and sd.date == dag), None)
        assert anna is None or anna.shift is None, \
            "Anna ska INTE schemaläggas på sin semesterdag trots önskemål"
        assert stats["hard_errors"] == 0, "Ska inte ge hårda fel"


# =============================================================================
# 4. ÖNSKEMÅL RESPEKTERAS INTE OM DYGNSVILA BRYTS
# =============================================================================

class TestOnskemalBryterEjRegler:
    def test_dygnsvila_trumfar_onske(self):
        """Om önskedagen är för nära föregående pass hoppas önskemålet över."""
        from datetime import datetime, time
        from app.engine.schemas import Shift, ShiftSegment, ScheduleDay

        dag1 = date(2026, 6, 1)
        dag2 = date(2026, 6, 2)

        # Anna jobbar kväll dag 1 → slutar 21:30 → nästa dag 07:00 = 9.5h vila < 11h
        # Om hon önskar dag 2 ska generatorn hoppa över det
        employees = [
            _emp(1, "Anna",  ContractType.VARIERANDE, wishes=[dag2]),
            _emp(2, "Björn", ContractType.VARIERANDE),
            _emp(3, "Carin", ContractType.VARIERANDE),
            _emp(4, "David", ContractType.KVAL),
        ]
        krav = [_krav(dag1, fm=1, kval=1), _krav(dag2, fm=1, kval=0)]
        schedule, stats = generate_schedule(employees, krav, dag1, dag2)

        # Vi kontrollerar att inga hårda fel uppstår (generatorn hoppade över önskemålet)
        assert stats["hard_errors"] == 0, \
            f"Generatorn ska hoppa önskat dag om dygnsvila bryts, men fick {stats['hard_errors']} hårda fel"


# =============================================================================
# 5. HELA NORRA-GRUPPEN — INTEGRATION
# =============================================================================

class TestNorraGrupp:
    """Genererar ett schema för hela Norra-gruppen (8 anst) en hel vecka."""

    def test_norra_ingen_onske_inga_harda_fel(self):
        norra = get_employees_by_group(Group.NORRA)
        assert len(norra) == 8

        krav = [_krav(d, fm=2, kval=2) for d in WEEK]
        schedule, stats = generate_schedule(norra, krav, MON, SUN)

        assert stats["hard_errors"] == 0, \
            f"Norra utan önskemål fick {stats['hard_errors']} hårda fel"
        assert stats["total_shifts"] > 0, "Ska finnas schemalagda pass"

    def test_norra_med_onskemål_inga_harda_fel(self):
        """Norra med önskemål för Jimmy dag 1 och 3 — inga hårda fel."""
        norra = [emp.model_copy() for emp in get_employees_by_group(Group.NORRA)]

        # Sätt önskemål för Jimmy (EMP_001)
        for emp in norra:
            if emp.id == "EMP_001":
                emp.wishes = [MON, date(2026, 6, 3)]

        krav = [_krav(d, fm=2, kval=2) for d in WEEK]
        schedule, stats = generate_schedule(norra, krav, MON, SUN)

        assert stats["hard_errors"] == 0

        # Jimmy ska vara schemalagd på måndag
        jimmy_mon = next((sd for sd in schedule
                          if sd.employee_id == "EMP_001" and sd.date == MON), None)
        assert jimmy_mon is not None and jimmy_mon.shift is not None, \
            "Jimmy ska vara schemalagd på sin önskedag måndag"

    def test_norra_heltidsmanad_inga_harda_fel(self):
        """Generera hela juni för Norra — ska inte ge hårda fel."""
        import calendar
        norra = get_employees_by_group(Group.NORRA)
        _, last = calendar.monthrange(2026, 6)
        period_start = date(2026, 6, 1)
        period_end   = date(2026, 6, last)
        days = [period_start + timedelta(i) for i in range(last)]

        krav = [_krav(d, fm=2, kval=2) for d in days]
        schedule, stats = generate_schedule(norra, krav, period_start, period_end)

        assert stats["hard_errors"] == 0, \
            f"Hel juni för Norra fick {stats['hard_errors']} hårda fel"


# =============================================================================
# 6. DELTIDSPERSONAL — DYNAMISKA PASSTIDER OCH TIMMAR
# =============================================================================

class TestDeltidspersonal:
    """Verifierar att deltidspersonal får kortare pass och skalade måltimmar."""

    def test_deltid_50_procent_far_korta_pass(self):
        """En medarbetare på 50% ska få dagpass som slutar 12:00 (5.25h)."""
        dag = date(2026, 6, 1)
        employees = [
            _emp(1, "Sara 50%", ContractType.VARIERANDE),
        ]
        employees[0].percentage = 0.50  # 50% tjänstgöringsgrad
        krav = [_krav(dag, fm=1, kval=0)]
        
        schedule, _ = generate_schedule(employees, krav, dag, dag)
        
        sara_day = next(sd for sd in schedule if sd.employee_id == "T01" and sd.date == dag)
        assert sara_day.shift is not None
        assert sara_day.shift.shift_type == ShiftType.DAG_TIDIG
        assert sara_day.shift.total_hours == 5.25


# =============================================================================
# 7. BEMANNINGSBRIST OCH VIKARIE-NOTIFIERINGAR (GOLDEN TEST)
# =============================================================================

class TestBemanningsbristOchVikarie:
    """Verifierar att systemet varnar för underbemanning och rekommenderar vikarie."""

    def test_bemanningsbrist_genererar_beslutslogg_och_validation_warnings(self):
        dag = date(2026, 6, 6) # Lördag
        employees = [
            _emp(1, "Ensam Arbetare", ContractType.VARIERANDE),
        ]
        # Bemanningskrav: 2 fm + 2 kval, men vi har bara 1 varierande arbetare
        krav = [Bemanningskrav(group=Group.NORRA, date=dag, fm_heads=2, kval_heads=2, em_heads=0, natt_heads=0)]
        
        schedule, stats = generate_schedule(employees, krav, dag, dag)
        
        # 1. Kontrollera att loggboken/beslutsloggen innehåller bemanningsbrist-loggar
        decisions = stats["decisions"]
        brist_logs = [d for d in decisions if "[Bemanningsbrist]" in d and "vikarie" in d]
        
        assert len(brist_logs) > 0, "Beslutsloggen saknar bemanningsbrist-notifiering med vikariebehov."
        assert any("förmiddagen" in d for d in brist_logs), "Saknar logg för fm-brist."
        assert any("kvällen" in d for d in brist_logs), "Saknar logg för kval-brist."

        # 2. Kontrollera att valideringen ger bemanningskrav-varningar med vikarietext
        validation = stats["validation"]
        bemanningskrav_errors = [e for e in validation.errors if e.rule_name == "bemanningskrav"]
        
        assert len(bemanningskrav_errors) > 0, "Valideringen hittade inte bemanningsbristen."
        for err in bemanningskrav_errors:
            assert "Det behövs en vikarie för att täcka upp" in err.message, \
                f"Felmeddelandet '{err.message}' saknar texten om vikariebehov."
        
    def test_deltid_75_procent_far_mellan_pass(self):
        """En medarbetare på 75% ska få dagpass som slutar 14:00 (7.25h)."""
        dag = date(2026, 6, 1)
        employees = [
            _emp(1, "Erik 75%", ContractType.VARIERANDE),
        ]
        employees[0].percentage = 0.75  # 75% tjänstgöringsgrad
        krav = [_krav(dag, fm=1, kval=0)]
        
        schedule, _ = generate_schedule(employees, krav, dag, dag)
        
        erik_day = next(sd for sd in schedule if sd.employee_id == "T01" and sd.date == dag)
        assert erik_day.shift is not None
        assert erik_day.shift.shift_type == ShiftType.DAG_TIDIG
        assert erik_day.shift.total_hours == 7.25 # 06:45 till 14:00 = 7h 15m = 7.25h
