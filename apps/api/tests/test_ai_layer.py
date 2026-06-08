# -*- coding: utf-8 -*-
"""
Golden tests för AI-lagret.

Testar de deterministiska delarna utan att anropa OpenAI:
  1. _simulate_dag_tidig väljer rätt kandidat (minst helger)
  2. _simulate_dag_tidig returnerar None om ingen kandidat finns
  3. Look-ahead: ingen bieffekt vid enkel dag_tidig-fix på vardag
  4. Look-ahead: bieffekt detekteras om fix skapar ny varning
  5. Solver: timbalans_underskott flaggas när > 15 h under mål
  6. Solver: timbalans_overskott flaggas när > 15 h över mål
  7. Solver: ingen timbalans-varning inom ±15 h
  8. apply-fix-logiken (simulering) skapar korrekt shift_data
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    ScheduleDay, Shift, ShiftSegment, ShiftType, ValidationErrorDetail,
)
from app.engine.solver import validate_schedule
from app.routers.autocorrect import _simulate_dag_tidig, _simulate_timbalans, _emp_actual_hours

STOCKHOLM = ZoneInfo("Europe/Stockholm")

# ── Helpers ──────────────────────────────────────────────────────────────────

def _dt(d: date, h: int, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m, tzinfo=STOCKHOLM)


def _shift(d: date, start_h: int, end_h: int, typ: ShiftType = ShiftType.DAG) -> Shift:
    return Shift(
        shift_type=typ,
        segments=[ShiftSegment(start_time=_dt(d, start_h), end_time=_dt(d, end_h))],
    )


def _emp(num: int, ct: ContractType = ContractType.VARIERANDE, percentage: float = 1.0) -> Employee:
    return Employee(
        id=f"E{num:02d}",
        name=f"Person {num}",
        contract_type=ct,
        group=Group.NORRA,
        percentage=percentage,
    )


def _sd(emp_id: str, d: date, shift: Shift | None = None) -> dict:
    return {
        "employee_id": emp_id,
        "date": d.isoformat(),
        "shift": shift.model_dump(mode="json") if shift else None,
        "absence": None,
    }


def _schedule_day(emp: Employee, d: date, shift: Shift | None = None) -> ScheduleDay:
    return ScheduleDay(
        employee_id=emp.id,
        date=d.isoformat(),
        shift=shift,
        absence=None,
    )


# Testdatum
MON = date(2026, 6, 1)   # måndag
SAT = date(2026, 6, 6)   # lördag
SUN = date(2026, 6, 7)   # söndag


# =============================================================================
# 1. _simulate_dag_tidig — väljer kandidat med minst helger
# =============================================================================

class TestSimulateDagTidig:

    def test_valjer_kandidat_med_minst_helger(self):
        """Av två VARIERANDE utan pass väljs den med färre helger."""
        e1 = _emp(1)  # har 2 helgpass
        e2 = _emp(2)  # har 0 helgpass

        # Lägg helgpass för e1 på föregående lördag
        prev_sat = MON - timedelta(days=2)
        schedule = [
            _sd(e1.id, prev_sat, _shift(prev_sat, 7, 15)),
            _sd(e2.id, prev_sat),  # ledig
            _sd(e1.id, MON),       # ledig på MON
            _sd(e2.id, MON),       # ledig på MON
        ]

        new_sched, chosen_id = _simulate_dag_tidig(schedule, MON, [e1, e2])

        assert chosen_id == e2.id, "Ska välja e2 som har minst helger"
        dag_tidig_days = [
            sd for sd in new_sched
            if sd["employee_id"] == e2.id
            and sd["date"] == MON.isoformat()
            and sd.get("shift", {}) and sd["shift"].get("shift_type") == "dag_tidig"
        ]
        assert len(dag_tidig_days) == 1

    def test_hoppar_over_redan_schemalagd(self):
        """Person med pass denna dag väljs inte."""
        e1 = _emp(1)
        e2 = _emp(2)

        schedule = [
            _sd(e1.id, MON, _shift(MON, 7, 15)),  # e1 jobbar redan
            _sd(e2.id, MON),
        ]

        _, chosen_id = _simulate_dag_tidig(schedule, MON, [e1, e2])
        assert chosen_id == e2.id

    def test_returnerar_none_om_ingen_kandidat(self):
        """Returnerar None om alla VARIERANDE redan har pass."""
        e1 = _emp(1)
        schedule = [_sd(e1.id, MON, _shift(MON, 7, 15))]

        new_sched, chosen_id = _simulate_dag_tidig(schedule, MON, [e1])
        assert chosen_id is None
        assert new_sched == schedule  # schemat oförändrat

    def test_returnerar_none_om_redan_tacker(self):
        """Returnerar None om det redan finns DAG_TIDIG denna dag."""
        e1 = _emp(1)
        e2 = _emp(2)
        tidig = _shift(MON, 6, 16, ShiftType.DAG_TIDIG)

        schedule = [
            _sd(e1.id, MON, tidig),
            _sd(e2.id, MON),
        ]

        _, chosen_id = _simulate_dag_tidig(schedule, MON, [e1, e2])
        assert chosen_id is None

    def test_hoppar_over_dagtid_kontrakt(self):
        """Endast VARIERANDE väljs — DAGTID ska aldrig få DAG_TIDIG av autocorrect."""
        dagtid = _emp(1, ContractType.DAGTID)
        varierande = _emp(2, ContractType.VARIERANDE)

        schedule = [_sd(dagtid.id, MON), _sd(varierande.id, MON)]

        _, chosen_id = _simulate_dag_tidig(schedule, MON, [dagtid, varierande])
        assert chosen_id == varierande.id

    def test_schemat_ar_kopia_original_opaaverkat(self):
        """_simulate_dag_tidig muterar inte det ursprungliga schemat."""
        e1 = _emp(1)
        original = [_sd(e1.id, MON)]
        original_copy = [dict(sd) for sd in original]

        _simulate_dag_tidig(original, MON, [e1])

        assert original == original_copy, "Originalschemat ska vara oförändrat"


# =============================================================================
# 5–7. Solver: timbalans-regler
# =============================================================================

class TestTimbalansRegler:

    def _make_employee_with_hours(
        self, actual_hours: float, days_in_month: int = 30
    ) -> tuple[Employee, list[ScheduleDay]]:
        """
        Bygger en anställd (VARIERANDE, 100 %) och ett schema med exakt actual_hours
        schemalagda timmar. Alla 30 dagar inkluderas (lediga dagar utan shift) så att
        num_days i solver räknar hela månaden (30 dagar), inte bara arbetsdagar.
        """
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        schedule_days: list[ScheduleDay] = []
        remaining = actual_hours
        for day_n in range(1, days_in_month + 1):
            d = date(2026, 6, day_n)
            if remaining > 0:
                h = min(8.0, remaining)
                shift = Shift(
                    shift_type=ShiftType.DAG,
                    segments=[ShiftSegment(
                        start_time=_dt(d, 7),
                        end_time=_dt(d, 7) + timedelta(hours=h),
                    )],
                )
                schedule_days.append(_schedule_day(emp, d, shift))
                remaining -= h
            else:
                schedule_days.append(_schedule_day(emp, d, None))  # ledig dag
        return emp, schedule_days

    def test_underskott_over_15h_ger_varning(self):
        """Person med 20 h underskott ska få timbalans_underskott-varning."""
        emp, sched = self._make_employee_with_hours(actual_hours=138.0)  # mål ~158 h → -20 h
        result = validate_schedule(sched, [emp])

        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_underskott" in rule_names

        warn = next(e for e in result.errors if e.rule_name == "timbalans_underskott")
        assert warn.severity == "soft"
        assert warn.employee_id == emp.id
        assert "138" in warn.message or "20" in warn.message or "för få" in warn.message

    def test_overskott_over_15h_ger_varning(self):
        """Person med 20 h överskott ska få timbalans_overskott-varning."""
        emp, sched = self._make_employee_with_hours(actual_hours=178.0)  # mål ~158 h → +20 h
        result = validate_schedule(sched, [emp])

        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_overskott" in rule_names

        warn = next(e for e in result.errors if e.rule_name == "timbalans_overskott")
        assert warn.severity == "soft"
        assert warn.employee_id == emp.id

    def test_ingen_varning_inom_15h(self):
        """Person exakt på målet (±10 h) ska inte få timbalans-varning."""
        emp, sched = self._make_employee_with_hours(actual_hours=155.0)  # mål ~158 h → -3 h
        result = validate_schedule(sched, [emp])

        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_underskott" not in rule_names
        assert "timbalans_overskott" not in rule_names

    def test_ingen_varning_pa_exakt_mal(self):
        """Person exakt på målet ska inte få varning."""
        emp, sched = self._make_employee_with_hours(actual_hours=158.57)
        result = validate_schedule(sched, [emp])

        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_underskott" not in rule_names
        assert "timbalans_overskott" not in rule_names

    def test_vikarie_far_ingen_timbalans_varning(self):
        """Timvikarie (weekly_hours=0) ska aldrig få timbalans-varning."""
        emp = _emp(1, ContractType.VIKARIE)
        sched = [_schedule_day(emp, date(2026, 6, 1))]  # en ledig dag
        result = validate_schedule(sched, [emp])

        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_underskott" not in rule_names
        assert "timbalans_overskott" not in rule_names

    def test_deltid_skalning(self):
        """Person på 75 % tjänstgöring ska ha skalat mål (≈119 h), inte 158 h."""
        emp = Employee(
            id="E01",
            name="Person 1",
            contract_type=ContractType.VARIERANDE,
            group=Group.NORRA,
            percentage=0.75,
        )
        # Mål: 37 h/v * (30/7) * 0.75 ≈ 118.9 h
        # Lägger 90 h → underskott ~29 h → ska ge varning
        # Alla 30 dagar inkluderas (tomma = None) för korrekt num_days
        shift_90h = []
        remaining = 90.0
        for day_n in range(1, 31):
            d = date(2026, 6, day_n)
            if remaining > 0:
                h = min(8.0, remaining)
                shift_90h.append(ScheduleDay(
                    employee_id=emp.id,
                    date=d.isoformat(),
                    shift=Shift(
                        shift_type=ShiftType.DAG,
                        segments=[ShiftSegment(
                            start_time=_dt(d, 7),
                            end_time=_dt(d, 7) + timedelta(hours=h),
                        )],
                    ),
                    absence=None,
                ))
                remaining -= h
            else:
                shift_90h.append(ScheduleDay(employee_id=emp.id, date=d.isoformat(), shift=None, absence=None))

        result = validate_schedule(shift_90h, [emp])
        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_underskott" in rule_names

    def test_obokad_raknas_mot_timbalans(self):
        """
        OBOKAD-tid (is_unbooked=True) ska räknas som schemalagda timmar mot
        kontraktet. Schema med 120 h DAG + 40 h OBOKAD = 160 h ≈ mål → ingen varning.
        (Före semantikändringen exkluderades obokad → falsk underskottsvarning.)
        """
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        days: list[ScheduleDay] = []
        dag_remaining = 120.0
        obokad_remaining = 40.0
        for day_n in range(1, 31):
            d = date(2026, 6, day_n)
            if dag_remaining > 0:
                h = min(8.0, dag_remaining)
                days.append(_schedule_day(emp, d, _shift(d, 7, 7 + int(h), ShiftType.DAG)))
                dag_remaining -= h
            elif obokad_remaining > 0:
                h = min(8.0, obokad_remaining)
                ob = Shift(
                    shift_type=ShiftType.OBOKAD,
                    segments=[ShiftSegment(start_time=_dt(d, 7), end_time=_dt(d, 7) + timedelta(hours=h))],
                    is_unbooked=True,
                )
                days.append(_schedule_day(emp, d, ob))
                obokad_remaining -= h
            else:
                days.append(_schedule_day(emp, d, None))

        result = validate_schedule(days, [emp])
        rule_names = [e.rule_name for e in result.errors]
        assert "timbalans_underskott" not in rule_names, "Obokad ska räknas → inget underskott"


# =============================================================================
# 9. _simulate_timbalans — fyller underskott med OBOKAD-tid
# =============================================================================

class TestSimulateTimbalans:

    def _full_month_dicts(self, emp: Employee, worked_days: int, hours_per_day: float = 8.0) -> list[dict]:
        """Bygger ett månadsschema (dict-format) där de första N dagarna har DAG-pass."""
        schedule: list[dict] = []
        for day_n in range(1, 31):
            d = date(2026, 6, day_n)
            if day_n <= worked_days:
                schedule.append(_sd(emp.id, d, _shift(d, 7, 7 + int(hours_per_day), ShiftType.DAG)))
            else:
                schedule.append(_sd(emp.id, d, None))
        return schedule

    def test_fyller_underskott_med_obokad(self):
        """Person med stort underskott ska få OBOKAD-tid tillagd tills målet nås."""
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        # 10 dagar * 8 h = 80 h, mål ≈ 158.6 h → underskott ~78 h
        schedule = self._full_month_dicts(emp, worked_days=10)

        new_sched, added = _simulate_timbalans(schedule, emp.id, [emp], 2026, 6)

        assert added > 0, "Ska lägga till timmar"
        total = _emp_actual_hours(new_sched, emp.id)
        # Efter fix ska personen ligga inom 15 h från målet (≈158.6 h)
        assert total >= 158.6 - 15, f"Total {total:.1f} h ska nå nära målet"
        # Det ska finnas obokad-pass i det nya schemat
        obokad = [sd for sd in new_sched if sd.get("shift") and sd["shift"]["shift_type"] == "obokad"]
        assert len(obokad) > 0

    def test_loser_timbalansvarning(self):
        """Efter _simulate_timbalans ska timbalans_underskott vara borta."""
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        schedule = self._full_month_dicts(emp, worked_days=10)

        # Före: underskott finns
        before_days = [ScheduleDay.model_validate(sd) for sd in schedule]
        before_rules = [e.rule_name for e in validate_schedule(before_days, [emp]).errors]
        assert "timbalans_underskott" in before_rules

        new_sched, _ = _simulate_timbalans(schedule, emp.id, [emp], 2026, 6)
        after_days = [ScheduleDay.model_validate(sd) for sd in new_sched]
        after_rules = [e.rule_name for e in validate_schedule(after_days, [emp]).errors]
        assert "timbalans_underskott" not in after_rules, "Varningen ska vara åtgärdad"

    def test_hoppar_over_upptagna_dagar(self):
        """Dagar med befintligt pass ska inte skrivas över."""
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        schedule = self._full_month_dicts(emp, worked_days=10)

        new_sched, _ = _simulate_timbalans(schedule, emp.id, [emp], 2026, 6)

        # De första 10 dagarna ska fortfarande vara DAG, inte obokad
        for day_n in range(1, 11):
            d = date(2026, 6, day_n).isoformat()
            sd = next(s for s in new_sched if s["employee_id"] == emp.id and s["date"] == d)
            assert sd["shift"]["shift_type"] == "dag", f"Dag {day_n} ska vara orörd"

    def test_inget_underskott_returnerar_noll(self):
        """Person redan på målet ska inte få något tillagt."""
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        # 20 dagar * 8 h = 160 h ≈ mål → inget underskott
        schedule = self._full_month_dicts(emp, worked_days=20)

        new_sched, added = _simulate_timbalans(schedule, emp.id, [emp], 2026, 6)
        assert added == 0.0

    def test_muterar_inte_original(self):
        """_simulate_timbalans ska inte ändra det ursprungliga schemat."""
        emp = _emp(1, ContractType.VARIERANDE, percentage=1.0)
        schedule = self._full_month_dicts(emp, worked_days=10)
        snapshot = [dict(sd) for sd in schedule]

        _simulate_timbalans(schedule, emp.id, [emp], 2026, 6)
        assert schedule == snapshot, "Originalschemat ska vara oförändrat"
