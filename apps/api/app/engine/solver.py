# -*- coding: utf-8 -*-
"""
Deterministisk regelmotor (Constraint Solver) för Töreboda AI-schemamotor.
Validerar scheman mot lagar, avtal och lokala regler med absolute precision.
"""

from datetime import date, datetime, timedelta
from typing import List
from zoneinfo import ZoneInfo
from app.engine.schemas import (
    ScheduleDay, Employee, ValidationResult, ValidationErrorDetail,
    AbsenceType, ContractType, Shift, ShiftType, ShiftSegment,
    Bemanningskrav, CONTRACT_RULES,
)

STOCKHOLM = ZoneInfo("Europe/Stockholm")

# Mappning ShiftType -> passdel för bemanningskrav
_SHIFT_TO_SLOT = {
    ShiftType.DAG_TIDIG: "fm",
    ShiftType.DAG:       "fm",
    ShiftType.DELAD_TUR: "em",
    ShiftType.KVAL_KORT: "kval",
    ShiftType.KVAL_LANG: "kval",
    ShiftType.APT:       "kval",
    ShiftType.NATT:      "natt",
    ShiftType.OBOKAD:    None,   # räknas ej mot bemanningskrav
    ShiftType.PLANERINGSTID: None,
}


def validate_schedule(
    schedule_days: List[ScheduleDay],
    employees: List[Employee],
    krav: List[Bemanningskrav] | None = None,
) -> ValidationResult:
    """
    Validerar ett schema mot alla hårda och mjuka regler, inklusive bemanningskrav om de skickas med.

    Args:
        schedule_days: Alla schemalagda pass för perioden.
        employees: Lista på alla anställda.
        krav: Optionell lista på bemanningskrav per dag och grupp.

    Returns:
        ValidationResult med is_valid=True om alla HÅRDA regler följs,
        samt en lista på detaljerade regelbrott (errors) på svenska.
    """
    errors: List[ValidationErrorDetail] = []

    # Skapa snabbuppslag för anställda
    emp_map = {emp.id: emp for emp in employees}

    # Gruppera schema per medarbetare
    emp_schedules: dict[str, list[ScheduleDay]] = {}
    for day in schedule_days:
        if day.employee_id not in emp_schedules:
            emp_schedules[day.employee_id] = []
        emp_schedules[day.employee_id].append(day)

    # Sortera varje medarbetares schema kronologiskt
    for emp_id in emp_schedules:
        emp_schedules[emp_id].sort(key=lambda x: x.date)

    # Validera varje enskild medarbetares schema
    for emp_id, days in emp_schedules.items():
        emp = emp_map.get(emp_id)
        if not emp:
            continue

        contract_rules = CONTRACT_RULES.get(emp.contract_type, {})
        allowed_weekdays: list[int] = contract_rules.get("allowed_weekdays", list(range(7)))

        # --- REGEL: VETOGRÄNS (Max 2 veto per medarbetare) ---
        if len(emp.vetos) > 2:
            errors.append(ValidationErrorDetail(
                rule_name="vetogräns",
                employee_id=emp.id,
                date=days[0].date if days else date.today(),
                message=f"Medarbetare {emp.name} har lagt {len(emp.vetos)} veton. Max 2 veton är tillåtna per månad.",
                severity="hard"
            ))

        # --- REGEL: FRÅNVAROSPÄRR & AVTALSBROTT DAGAR ---
        for day in days:
            has_registered_absence = any(abs.date == day.date for abs in emp.absences)
            if day.shift and (day.absence or has_registered_absence):
                errors.append(ValidationErrorDetail(
                    rule_name="frånvarospärr",
                    employee_id=emp.id,
                    date=day.date,
                    message=f"Medarbetare {emp.name} är schemalagd på ett arbetspass under registrerad frånvaro ({day.date}).",
                    severity="hard"
                ))

            # Kolla tillåtna veckodagar per kontraktstyp (generaliserad regel)
            if day.shift and day.shift.shift_type != ShiftType.OBOKAD:
                weekday = day.date.weekday()  # 0=mån, 6=sön
                if weekday not in allowed_weekdays:
                    errors.append(ValidationErrorDetail(
                        rule_name="avtalsbrott_dagar",
                        employee_id=emp.id,
                        date=day.date,
                        message=(
                            f"Medarbetare {emp.name} ({emp.contract_type.value}) är schemalagd på "
                            f"{day.date.strftime('%A %Y-%m-%d')} vilket inte är tillåtet enligt kontraktet."
                        ),
                        severity="hard"
                    ))

        # --- REGEL: 11H DYGNSVILA ---
        # Bygg lista av (start, slut, datum, shift_id) — shift_id för att skippa interna gaps i delad tur
        all_segments = []
        for day in days:
            if day.shift:
                shift_id = id(day.shift)
                for seg in day.shift.segments:
                    all_segments.append((seg.start_time, seg.end_time, day.date, shift_id))

        all_segments.sort(key=lambda x: x[0])

        for i in range(len(all_segments) - 1):
            curr_end   = all_segments[i][1]
            next_start = all_segments[i+1][0]
            next_date  = all_segments[i+1][2]
            same_shift = all_segments[i][3] == all_segments[i+1][3]

            if same_shift:
                continue  # intern paus i delad tur — räknas ej som dygnsvila

            rest_hours = (next_start - curr_end).total_seconds() / 3600.0

            if rest_hours < 11.0:
                errors.append(ValidationErrorDetail(
                    rule_name="dygnsvila",
                    employee_id=emp.id,
                    date=next_date,
                    message=(
                        f"Brutit mot dygnsvila för {emp.name}: Endast {rest_hours:.1f} timmars vila "
                        f"mellan passet som slutar {curr_end.strftime('%H:%M')} och nästa pass "
                        f"som börjar {next_start.strftime('%H:%M')} dagen efter."
                    ),
                    severity="hard"
                ))

        # --- REGEL: 36H VECKOVILA (per kalendervecka måndag–söndag) ---
        if len(days) >= 7:
            for start_idx in range(len(days) - 6):
                window_days = days[start_idx : start_idx + 7]
                if window_days[0].date.weekday() != 0:  # bara måndag-startade fönster
                    continue
                window_start = datetime.combine(window_days[0].date, datetime.min.time()).replace(tzinfo=STOCKHOLM)
                window_end = datetime.combine(window_days[-1].date, datetime.max.time()).replace(tzinfo=STOCKHOLM)

                win_segments = []
                for wd in window_days:
                    if wd.shift:
                        for seg in wd.shift.segments:
                            win_segments.append((seg.start_time, seg.end_time))

                win_segments.sort(key=lambda x: x[0])

                if not win_segments:
                    continue

                gaps = []
                gaps.append((win_segments[0][0] - window_start).total_seconds() / 3600.0)
                for i in range(len(win_segments) - 1):
                    gaps.append((win_segments[i+1][0] - win_segments[i][1]).total_seconds() / 3600.0)
                gaps.append((window_end - win_segments[-1][1]).total_seconds() / 3600.0)

                max_rest = max(gaps) if gaps else 0.0
                if max_rest < 36.0:
                    # Soft varning — bordergränsfall (t.ex. 35h) är vanligt i vården
                    # Schema-ansvarig bedömer om det är acceptabelt
                    severity = "hard" if max_rest < 33.0 else "soft"
                    errors.append(ValidationErrorDetail(
                        rule_name="veckovila",
                        employee_id=emp.id,
                        date=window_days[-1].date,
                        message=(
                            f"{'Kritisk brott mot' if severity == 'hard' else 'Kontrollera'} veckovila för {emp.name}: "
                            f"Längsta sammanhängande vila under veckan till {window_days[-1].date} "
                            f"är {max_rest:.1f}h (krav 36h)."
                        ),
                        severity=severity,
                    ))

        # --- REGEL: 9 LEDIGA DAGAR PÅ 28 DAGAR ---
        if len(days) >= 28:
            for start_idx in range(len(days) - 27):
                window_days = days[start_idx : start_idx + 28]
                free_days = sum(1 for wd in window_days if wd.shift is None)

                if free_days < 9:
                    errors.append(ValidationErrorDetail(
                        rule_name="lediga_dagar_28",
                        employee_id=emp.id,
                        date=window_days[-1].date,
                        message=(
                            f"Brutit mot ledighetsregeln för {emp.name}: Under 28-dagarsperioden till "
                            f"{window_days[-1].date} har medarbetaren endast {free_days} lediga dagar. "
                            f"Kravet är minst 9 lediga dagar."
                        ),
                        severity="hard"
                    ))

        # --- REGEL: ÖNSKAT ANTAL DAGAR / KVÄLLAR PER MÅNAD (mjuk) ---
        if emp.target_days_per_month is not None or emp.target_evenings_per_month is not None:
            actual_days = sum(
                1 for d in days
                if d.shift and d.shift.shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG)
            )
            actual_evenings = sum(
                1 for d in days
                if d.shift and d.shift.shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG)
            )

            if emp.target_days_per_month is not None and actual_days != emp.target_days_per_month:
                errors.append(ValidationErrorDetail(
                    rule_name="mal_dagar_avvikelse",
                    employee_id=emp.id,
                    date=days[-1].date if days else date.today(),
                    message=(
                        f"Medarbetare {emp.name} har tilldelats {actual_days} dagpass, "
                        f"men målet är {emp.target_days_per_month}."
                    ),
                    severity="soft"
                ))

            if emp.target_evenings_per_month is not None and actual_evenings != emp.target_evenings_per_month:
                errors.append(ValidationErrorDetail(
                    rule_name="mal_kvallar_avvikelse",
                    employee_id=emp.id,
                    date=days[-1].date if days else date.today(),
                    message=(
                        f"Medarbetare {emp.name} har tilldelats {actual_evenings} kvällspass, "
                        f"men målet är {emp.target_evenings_per_month}."
                    ),
                    severity="soft"
                ))

        # --- REGEL: TIMBALANS ±15 h (mjuk) ---
        contract_rules = CONTRACT_RULES.get(emp.contract_type, {})
        weekly_h: float = contract_rules.get("weekly_hours", 0.0)
        if weekly_h > 0:
            num_days = len({d.date for d in days})
            target_h = weekly_h * (num_days / 7.0) * (emp.percentage or 1.0)
            actual_h = sum(
                (seg.end_time - seg.start_time).total_seconds() / 3600
                for d in days if d.shift and not d.shift.is_unbooked
                for seg in d.shift.segments
            )
            diff = actual_h - target_h
            THRESHOLD = 15.0
            if diff < -THRESHOLD:
                errors.append(ValidationErrorDetail(
                    rule_name="timbalans_underskott",
                    employee_id=emp.id,
                    date=days[-1].date if days else date.today(),
                    message=(
                        f"{emp.name} har {abs(diff):.1f} timmar för få i schemat "
                        f"(mål {target_h:.1f} h, faktiskt {actual_h:.1f} h). "
                        f"Överväg att lägga till OBOKAD-tid."
                    ),
                    severity="soft"
                ))
            elif diff > THRESHOLD:
                errors.append(ValidationErrorDetail(
                    rule_name="timbalans_overskott",
                    employee_id=emp.id,
                    date=days[-1].date if days else date.today(),
                    message=(
                        f"{emp.name} har {diff:.1f} timmar för många i schemat "
                        f"(mål {target_h:.1f} h, faktiskt {actual_h:.1f} h)."
                    ),
                    severity="soft"
                ))

    # --- REGLER: 06:45 och 21:30-täckning (soft) ---
    from collections import defaultdict as _dd
    emp_group = {emp.id: emp.group for emp in employees}
    all_dates = sorted({day.date for day in schedule_days})
    all_groups = {emp.group for emp in employees}

    tidig_per_day:    dict[tuple, bool] = _dd(bool)
    kval_lang_per_day: dict[tuple, bool] = _dd(bool)
    kval_any_per_day:  dict[tuple, bool] = _dd(bool)

    for day in schedule_days:
        grp = emp_group.get(day.employee_id)
        if not grp or not day.shift:
            continue
        if day.shift.shift_type == ShiftType.DAG_TIDIG:
            tidig_per_day[(grp, day.date)] = True
        if day.shift.shift_type == ShiftType.KVAL_LANG:
            kval_lang_per_day[(grp, day.date)] = True
        if day.shift.shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG):
            kval_any_per_day[(grp, day.date)] = True

    for d in all_dates:
        for grp in all_groups:
            if not tidig_per_day.get((grp, d), False):
                errors.append(ValidationErrorDetail(
                    rule_name="dag_tidig_saknas",
                    employee_id="",
                    date=d,
                    message=f"Ingen personal börjar 06:45 i {grp.value} den {d}. Nattrapporten täcks inte.",
                    severity="soft",
                ))
            if kval_any_per_day.get((grp, d)) and not kval_lang_per_day.get((grp, d)):
                errors.append(ValidationErrorDetail(
                    rule_name="kval_lang_saknas",
                    employee_id="",
                    date=d,
                    message=f"Ingen jobbar till 21:30 i {grp.value} den {d}. Kvällspastet slutar 20:00.",
                    severity="soft",
                ))

    if krav:
        errors.extend(validate_staffing(schedule_days, employees, krav))

    is_valid = not any(e.severity == "hard" for e in errors)
    return ValidationResult(is_valid=is_valid, errors=errors)


def validate_staffing(
    schedule_days: List[ScheduleDay],
    employees: List[Employee],
    krav: List[Bemanningskrav],
) -> List[ValidationErrorDetail]:
    """
    Mjuk validering av bemanningskrav per grupp och datum.
    Returnerar enbart soft-fel (underbemanning är en varning, inte blockerare).
    """
    warnings: List[ValidationErrorDetail] = []

    emp_map = {emp.id: emp for emp in employees}

    # Indexera krav per (group, date)
    krav_index: dict[tuple, Bemanningskrav] = {
        (k.group, k.date): k for k in krav
    }

    # Räkna faktiska pass per (group, date, slot)
    actual: dict[tuple, int] = {}
    for day in schedule_days:
        emp = emp_map.get(day.employee_id)
        if not emp or not day.shift:
            continue
        slot = _SHIFT_TO_SLOT.get(day.shift.shift_type)
        if slot is None:
            continue
        # Räkna mot assigned_group om det finns (inlånad personal), annars ordinarie grupp
        actual_group = day.assigned_group if (hasattr(day, "assigned_group") and day.assigned_group is not None) else emp.group
        key = (actual_group, day.date, slot)
        actual[key] = actual.get(key, 0) + 1

    # Jämför mot krav
    for (group, d), k in krav_index.items():
        for slot, needed in [("fm", k.fm_heads), ("em", k.em_heads), ("kval", k.kval_heads), ("natt", k.natt_heads)]:
            have = actual.get((group, d, slot), 0)
            if have < needed:
                warnings.append(ValidationErrorDetail(
                    rule_name="bemanningskrav",
                    employee_id="",
                    date=d,
                    message=(
                        f"Underbemanning i {group.value} den {d}: "
                        f"{slot.upper()} behöver {needed} medarbetare men har endast {have} schemalagda. "
                            f"Det behövs en vikarie för att täcka upp."
                        ),
                        severity="soft"
                    ))

        # Tim- eller intervallbaserade bemanningskrav
        if getattr(k, "hourly_requirements", None):
            # Hämta alla ScheduleDay för denna grupp och datum
            days_on_date = []
            for day in schedule_days:
                emp = emp_map.get(day.employee_id)
                if not emp or not day.shift:
                    continue
                act_group = day.assigned_group if (hasattr(day, "assigned_group") and day.assigned_group is not None) else emp.group
                if act_group == group and day.date == d:
                    days_on_date.append(day)

            for hr in k.hourly_requirements:
                try:
                    start_h, start_m = map(int, hr.start_time.split(":"))
                    end_h, end_m = map(int, hr.end_time.split(":"))
                    req_start = datetime(d.year, d.month, d.day, start_h, start_m, tzinfo=STOCKHOLM)
                    req_end = datetime(d.year, d.month, d.day, end_h, end_m, tzinfo=STOCKHOLM)
                except Exception:
                    continue

                active_heads = 0
                for day in days_on_date:
                    for seg in day.shift.segments:
                        overlap_start = max(seg.start_time, req_start)
                        overlap_end = min(seg.end_time, req_end)
                        if overlap_start < overlap_end:
                            # Kontrollera aktivitet
                            activity_type = getattr(seg, "activity", None) or day.shift.shift_type
                            if activity_type not in (ShiftType.PLANERINGSTID, ShiftType.KONTORSTID, ShiftType.OBOKAD):
                                active_heads += 1
                                break

                if active_heads < hr.needed_heads:
                    warnings.append(ValidationErrorDetail(
                        rule_name="timbemanning",
                        employee_id="",
                        date=d,
                        message=(
                            f"Underbemanning i {group.value} den {d} under intervallet {hr.start_time}–{hr.end_time}: "
                            f"Behövs {hr.needed_heads} aktiva men det finns endast {active_heads}."
                        ),
                        severity="soft"
                    ))
                elif active_heads > hr.needed_heads:
                    warnings.append(ValidationErrorDetail(
                        rule_name="timbemanning_overkapacitet",
                        employee_id="",
                        date=d,
                        message=(
                            f"Överkapacitet i {group.value} den {d} under intervallet {hr.start_time}–{hr.end_time}: "
                            f"Det finns {active_heads} aktiva medarbetare men behovet är endast {hr.needed_heads}."
                        ),
                        severity="soft"
                    ))

    return warnings


def fill_with_obokad(
    employee: Employee,
    schedule_days: List[ScheduleDay],
    period_start: date,
    period_end: date,
) -> List[ScheduleDay]:
    """
    Fyller återstående kontraktstimmar med OBOKAD tid på lediga dagar.

    Räknar inplanerade timmar i perioden, jämför med kontraktsmålet
    och lägger OBOKAD-pass (07:00–15:00) på lediga dagar tills timunderskottet täcks.
    """
    if employee.contract_type == ContractType.VIKARIE:
        return []

    rules = CONTRACT_RULES.get(employee.contract_type, {})
    weekly_hours: float = rules.get("weekly_hours", 0.0)

    # Beräkna antal veckor i perioden (avrundat uppåt till närmaste halv)
    total_days = (period_end - period_start).days + 1
    num_weeks = total_days / 7.0
    target_hours = weekly_hours * num_weeks * employee.percentage

    # Indexera befintliga dagar
    day_index: dict[date, ScheduleDay] = {sd.date: sd for sd in schedule_days if sd.employee_id == employee.id}

    # Räkna redan inplanerade timmar
    scheduled_hours = sum(
        sd.shift.total_hours
        for sd in day_index.values()
        if sd.shift and not sd.shift.is_unbooked
    )

    deficit = target_hours - scheduled_hours
    if deficit <= 0:
        return []

    # Hitta lediga dagar i perioden (ingen shift, ingen frånvaro)
    absence_dates = {a.date for a in employee.absences}
    result: List[ScheduleDay] = []
    current = period_start

    while current <= period_end and deficit > 0:
        existing = day_index.get(current)
        is_free = (existing is None or existing.shift is None) and current not in absence_dates
        in_allowed_days = current.weekday() in rules.get("allowed_weekdays", list(range(7)))

        if is_free and in_allowed_days:
            shift_hours = min(deficit, 8.0)
            start_dt = datetime(current.year, current.month, current.day, 7, 0, tzinfo=STOCKHOLM)
            end_dt = start_dt + timedelta(hours=shift_hours)

            obokad_shift = Shift(
                shift_type=ShiftType.OBOKAD,
                segments=[ShiftSegment(start_time=start_dt, end_time=end_dt)],
                is_unbooked=True,
            )
            result.append(ScheduleDay(
                date=current,
                employee_id=employee.id,
                shift=obokad_shift,
            ))
            deficit -= shift_hours

        current += timedelta(days=1)

    return result
