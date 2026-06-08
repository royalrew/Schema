# -*- coding: utf-8 -*-
"""
Deterministisk schema-generator för Töreboda hemvård.

Prioritetsordning:
  1. Personal med önskeschema (wish_schedule) → deras turer låses in direkt
  2. Personal utan önskeschema → deterministisk greedy-algoritm fyller luckor
  3. OBOKAD-fyllnad för resterande kontraktstimmar
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from collections import defaultdict

from app.engine.schemas import (
    Employee, ScheduleDay, Shift, ShiftSegment, ShiftType,
    Bemanningskrav, ContractType, CONTRACT_RULES, Group,
)
from app.engine.solver import validate_schedule, fill_with_obokad

STOCKHOLM = ZoneInfo("Europe/Stockholm")

# Inbyggda fallback-tider om DB saknar konfiguration
_DEFAULT_TEMPLATES: dict[ShiftType, tuple[time, time]] = {
    ShiftType.DAG_TIDIG: (time(6, 45),  time(16, 0)),
    ShiftType.DAG:       (time(7, 0),   time(16, 0)),
    ShiftType.KVAL_KORT: (time(13, 45), time(20, 0)),
    ShiftType.KVAL_LANG: (time(13, 45), time(21, 30)),
    ShiftType.NATT:      (time(21, 15), time(7, 0)),
    # Delad tur: fm-del start/slut + kval-del start/slut lagras som två par
    ShiftType.DELAD_TUR: (time(7, 0),   time(20, 0)),   # yttre ram — faktiska segment byggs i _make_shift
}

# Delad tur: fm-del och kval-del (konfigurerbart i framtiden)
_DELAD_TUR_FM:   tuple[time, time] = (time(7, 0),   time(13, 0))
_DELAD_TUR_KVAL: tuple[time, time] = (time(15, 30), time(20, 0))

# Används utanför generatorn (t.ex. direkt i tester)
SHIFT_TEMPLATES = _DEFAULT_TEMPLATES


def _build_templates(
    shift_configs: list[dict] | None,
) -> dict[ShiftType, tuple[time, time]]:
    """Bygg en passtyp→(start, slut)-mappning från DB-configs med fallback på defaults."""
    if not shift_configs:
        return dict(_DEFAULT_TEMPLATES)
    result = dict(_DEFAULT_TEMPLATES)
    for cfg in shift_configs:
        try:
            st = ShiftType(cfg["shift_type"])
            start = time(*map(int, cfg["start_time"].split(":")))
            end   = time(*map(int, cfg["end_time"].split(":")))
            result[st] = (start, end)
        except (KeyError, ValueError):
            pass
    return result


def _make_shift(
    shift_type: ShiftType,
    d: date,
    templates: dict[ShiftType, tuple[time, time]],
    employee: Employee | None = None,
) -> Shift:
    if shift_type == ShiftType.DELAD_TUR:
        # Två segment: fm-del + kval-del
        fm_s,   fm_e   = _DELAD_TUR_FM
        kval_s, kval_e = _DELAD_TUR_KVAL
        return Shift(
            shift_type=shift_type,
            segments=[
                ShiftSegment(
                    start_time=datetime(d.year, d.month, d.day, fm_s.hour,   fm_s.minute,   tzinfo=STOCKHOLM),
                    end_time=  datetime(d.year, d.month, d.day, fm_e.hour,   fm_e.minute,   tzinfo=STOCKHOLM),
                ),
                ShiftSegment(
                    start_time=datetime(d.year, d.month, d.day, kval_s.hour, kval_s.minute, tzinfo=STOCKHOLM),
                    end_time=  datetime(d.year, d.month, d.day, kval_e.hour, kval_e.minute, tzinfo=STOCKHOLM),
                ),
            ],
        )

    start_t, end_t = templates[shift_type]
    if employee and shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG):
        # Dynamisk sluttid för deltidspersonal så de slipper slaviskt gå till 16:00
        if employee.percentage <= 0.55:
            end_t = time(12, 0)
        elif employee.percentage <= 0.78:
            end_t = time(14, 0)

    start_dt = datetime(d.year, d.month, d.day, start_t.hour, start_t.minute, tzinfo=STOCKHOLM)

    if shift_type == ShiftType.NATT:
        next_day = d + timedelta(days=1)
        end_dt = datetime(next_day.year, next_day.month, next_day.day, end_t.hour, end_t.minute, tzinfo=STOCKHOLM)
    else:
        end_dt = datetime(d.year, d.month, d.day, end_t.hour, end_t.minute, tzinfo=STOCKHOLM)

    return Shift(
        shift_type=shift_type,
        segments=[ShiftSegment(start_time=start_dt, end_time=end_dt)],
    )


def _is_weekend(d: date) -> bool:
    return d.weekday() >= 5  # lör=5, sön=6


def _days_in_month(year: int, month: int) -> list[date]:
    from calendar import monthrange
    _, last = monthrange(year, month)
    return [date(year, month, day) for day in range(1, last + 1)]


def generate_schedule(
    employees: list[Employee],
    krav: list[Bemanningskrav],
    period_start: date,
    period_end: date,
    shift_configs: list[dict] | None = None,
) -> tuple[list[ScheduleDay], dict]:
    """
    Genererar ett deterministiskt schema för angiven period.

    Returns:
        (schedule_days, stats) — validerat schema + statistik.
        Valideringsresultat läggs i stats["validation"].
    """
    # Bygg passmallar från configs (med fallback på defaults)
    templates = _build_templates(shift_configs)

    # Index: date → Bemanningskrav per grupp
    krav_index: dict[tuple[Group, date], Bemanningskrav] = {
        (k.group, k.date): k for k in krav
    }

    # Spåra: hur många helger varje medarbetare fått
    weekend_count: dict[str, int] = defaultdict(int)

    # Spåra: arbetade dagar per helgblock för helgmedarbetare
    work_days_by_weekend: dict[str, dict[date, int]] = defaultdict(lambda: defaultdict(int))

    def _get_weekend_id(d: date) -> date:
        wd = d.weekday()
        if wd == 0:  # Måndag hör till helgen som började i fredags
            return d - timedelta(days=3)
        elif wd >= 4:  # Fredag, Lördag, Söndag
            return d - timedelta(days=wd - 4)
        else:
            return d - timedelta(days=wd + 3) # fallback

    # Spåra: schemalagda timmar per medarbetare (för prioritering)
    scheduled_hours: dict[str, float] = defaultdict(float)

    # Spåra: vem som senast tog DAG_TIDIG i varje grupp (rotation)
    last_dag_tidig: dict[Group, int] = defaultdict(int)

    # Spåra: senaste passlutet per medarbetare (för dygnsvila-check)
    last_shift_end: dict[str, datetime] = {}

    # Spåra: antal tilldelade dag- och kvällspass per medarbetare
    scheduled_days_count: dict[str, int] = defaultdict(int)
    scheduled_evenings_count: dict[str, int] = defaultdict(int)

    # Spåra: blockerade dagpass på grund av önskemålskorrigering
    blocked_day_shifts: set[tuple[str, date]] = set()
    # Spåra: blockerade kvällspass på grund av önskemålskorrigering
    blocked_evening_shifts: set[tuple[str, date]] = set()

    # Resultat
    assignments: dict[tuple[str, date], ScheduleDay] = {}
    decisions: list[str] = []

    # Absence-index per medarbetare
    absence_dates: dict[str, set[date]] = {
        emp.id: {a.date for a in emp.absences} for emp in employees
    }
    veto_dates: dict[str, set[date]] = {
        emp.id: set(emp.vetos) for emp in employees
    }
    wish_dates: dict[str, set[date]] = {
        emp.id: set(emp.wishes) for emp in employees
    }
    # Önskeschema: emp_id → date → (shift_type, start_time, end_time)
    # Personen vill jobba ett specifikt pass → ges stark prioritet den dagen
    wish_schedule_idx: dict[str, dict[date, str | None]] = {}
    for emp in employees:
        wish_schedule_idx[emp.id] = {}
        for w in emp.wish_schedule:
            try:
                d = date.fromisoformat(w.date)
                # shift_type = None → önskar vara ledig (blockera tilldelning)
                wish_schedule_idx[emp.id][d] = w.shift_type if w.start_time else None
            except ValueError:
                pass

    # Spåra: arbetsdagar per medarbetare (för 9-dagarsregeln + veckovila)
    work_days_per_emp: dict[str, set[date]] = defaultdict(set)

    # Gruppsort: ordinarie grupp-anställda hanteras per grupp
    employees_by_group: dict[Group, list[Employee]] = defaultdict(list)
    for emp in employees:
        employees_by_group[emp.group].append(emp)

    def available(emp: Employee, d: date, shift_type: ShiftType) -> bool:
        if (emp.id, d) in blocked_day_shifts and shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG):
            return False
        if (emp.id, d) in blocked_evening_shifts and shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG):
            return False
        if d in absence_dates[emp.id]:
            return False
        if d in veto_dates[emp.id]:
            return False
        # Om personen önskar vara ledig denna dag → hoppa över
        wish_for_day = wish_schedule_idx.get(emp.id, {}).get(d, "NOT_SET")
        if wish_for_day is None:  # None = explicit önskan om ledighet
            return False
            
        # Om personen har ett önskat pass av en specifik typ, tillåt endast pass av den kategorin
        if wish_for_day != "NOT_SET":
            wished_val = wish_for_day.value if hasattr(wish_for_day, "value") else str(wish_for_day)
            
            is_day_shift = shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG)
            is_kval_shift = shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG)
            is_natt_shift = shift_type == ShiftType.NATT
            
            if wished_val in (ShiftType.DAG.value, ShiftType.DAG_TIDIG.value) and not is_day_shift:
                return False
            if wished_val in (ShiftType.KVAL_KORT.value, ShiftType.KVAL_LANG.value) and not is_kval_shift:
                return False
            if wished_val == ShiftType.NATT.value and not is_natt_shift:
                return False

        weekday = d.weekday()
        allowed = CONTRACT_RULES.get(emp.contract_type, {}).get("allowed_weekdays", list(range(7)))
        if weekday not in allowed:
            return False
        # Max 2 helger/månad — GÄLLER EJ helgkontrakt (de jobbar alltid helg)
        helg_contracts = {ContractType.HELG_FRE_MAN}
        if _is_weekend(d) and emp.contract_type not in helg_contracts and weekend_count[emp.id] >= 2:
            return False
        # Helgmedarbetare (HELG_FRE_MAN) jobbar max 3 dagar per helgblock
        if emp.contract_type == ContractType.HELG_FRE_MAN:
            weekend_id = _get_weekend_id(d)
            if work_days_by_weekend[emp.id][weekend_id] >= 3:
                return False
        # Kväll-kontrakt jobbar bara kväll, inte dag
        if emp.contract_type == ContractType.KVAL and shift_type in (ShiftType.DAG_TIDIG, ShiftType.DAG):
            return False
        # Dagansvarig får aldrig kväll eller natt
        if emp.is_dagansvarig and shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG, ShiftType.NATT):
            return False
        # Helg-kontrakt jobbar bara helg (tillåtna dagar)
        if emp.contract_type == ContractType.HELG_FRE_MAN:
            if shift_type not in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG, ShiftType.DAG, ShiftType.DAG_TIDIG, ShiftType.NATT):
                return False
        # Natt-kontrakt jobbar bara natt
        if emp.contract_type == ContractType.NATT and shift_type != ShiftType.NATT:
            return False
        # Bara nattkontrakt (Natten-gruppen) jobbar natt
        if shift_type == ShiftType.NATT and emp.contract_type != ContractType.NATT:
            return False
        # Redan schemalagd den här dagen?
        if (emp.id, d) in assignments:
            return False
        # Dygnsvila + veckovila-skydd: minst 11h vila, men 36h om kvälls→morgon
        if emp.id in last_shift_end:
            start_t = templates[shift_type][0]
            next_start = datetime(d.year, d.month, d.day, start_t.hour, start_t.minute, tzinfo=STOCKHOLM)
            rest_h = (next_start - last_shift_end[emp.id]).total_seconds() / 3600.0
            if rest_h < 11.0:
                return False
        # 9 lediga dagar på 28 dagar — proaktiv kontroll
        window_start = d - timedelta(days=27)
        worked_in_window = sum(1 for wd in work_days_per_emp[emp.id] if wd >= window_start)
        if worked_in_window >= 19:
            return False
        # Veckovila: max konsekutiva dagar beroende på kontraktstyp
        # DAGTID (mån-fre) tillåter 5, övriga max 4 (undviker lör i lång streak)
        max_consec = 5 if emp.contract_type == ContractType.DAGTID else 4
        consecutive = 0
        check = d - timedelta(days=1)
        worked = work_days_per_emp[emp.id]
        while check in worked:
            consecutive += 1
            check -= timedelta(days=1)
        if consecutive >= max_consec:
            return False
        return True

    _HELG_CONTRACTS = {ContractType.VARIERANDE, ContractType.KVAL}

    def _soft_penalty(emp: Employee, d: date) -> int:
        """Returnerar 0 om inga mjuka krav bryts, 1 om prefer_off/avoid bryts."""
        from datetime import date as date_type
        import datetime as dt_module
        week_nr = int(d.strftime("%V"))
        wd = d.weekday()  # 0=Mån
        for sc in emp.soft_constraints:
            if sc.constraint_type not in ("prefer_off", "avoid"):
                continue
            if wd not in sc.weekdays:
                continue
            if sc.week_parity == "odd" and week_nr % 2 == 0:
                continue
            if sc.week_parity == "even" and week_nr % 2 != 0:
                continue
            return 1  # denna dag är oönskad
        return 0

    def priority_key(emp: Employee, d: date, category: str = "any") -> tuple[int, int, int, int, int, float]:
        target = CONTRACT_RULES.get(emp.contract_type, {}).get("weekly_hours", 37.0)
        weeks = (period_end - period_start).days / 7.0
        target_total = target * weeks * emp.percentage
        ratio = scheduled_hours[emp.id] / max(target_total, 1.0)
        has_wish = 0 if d in wish_dates[emp.id] else 1
        needs_helg = 0 if (
            _is_weekend(d)
            and emp.contract_type in _HELG_CONTRACTS
            and weekend_count[emp.id] < 2
        ) else 1
        # Önskeschema: personen har lagt in en specifik shift_type → stark boost
        wished_stype = wish_schedule_idx.get(emp.id, {}).get(d, "NOT_SET")
        has_wish_stype = 0 if (wished_stype not in (None, "NOT_SET")) else 1

        # Mjuk regel: Har medarbetaren nått sitt önskade målantal pass för denna kategori?
        reached_target = 0
        if category == "day" and emp.target_days_per_month is not None:
            reached_target = 1 if scheduled_days_count[emp.id] >= emp.target_days_per_month else 0
        elif category == "evening" and emp.target_evenings_per_month is not None:
            reached_target = 1 if scheduled_evenings_count[emp.id] >= emp.target_evenings_per_month else 0

        # Mjuka krav
        soft_pen = _soft_penalty(emp, d)
        return (has_wish_stype, has_wish, needs_helg, reached_target, soft_pen, ratio)

    def assign(emp: Employee, d: date, shift_type: ShiftType, reason: str = "") -> None:
        shift = _make_shift(shift_type, d, templates, employee=emp)
        assignments[(emp.id, d)] = ScheduleDay(
            date=d,
            employee_id=emp.id,
            shift=shift,
        )
        scheduled_hours[emp.id] += shift.total_hours
        if _is_weekend(d):
            weekend_count[emp.id] += 1
        
        # Räkna arbetsdagar per weekendblock
        weekend_id = _get_weekend_id(d)
        work_days_by_weekend[emp.id][weekend_id] += 1

        last_shift_end[emp.id] = shift.segments[-1].end_time
        work_days_per_emp[emp.id].add(d)

        # Räkna pass för önskade målantal per kategori
        if shift_type in (ShiftType.DAG, ShiftType.DAG_TIDIG):
            scheduled_days_count[emp.id] += 1
        elif shift_type in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG):
            scheduled_evenings_count[emp.id] += 1

        # Registrera beslut
        if reason:
            decisions.append(f"{d.isoformat()}: {reason}")
        else:
            # Deducera anledning
            wished_stype = wish_schedule_idx.get(emp.id, {}).get(d, "NOT_SET")
            is_wish = False
            if wished_stype not in (None, "NOT_SET"):
                wished_val = wished_stype.value if hasattr(wished_stype, "value") else str(wished_stype)
                if wished_val == shift_type.value:
                    is_wish = True

            if is_wish:
                decisions.append(
                    f"{d.isoformat()}: Önskeschema infriat för {emp.name} den {d.isoformat()}: tilldelad {shift_type.value} enligt personens eget val."
                )
            elif shift_type == ShiftType.DAG_TIDIG:
                decisions.append(
                    f"{d.isoformat()}: {emp.name} tilldelad passet 06:45 (DAG_TIDIG) den {d.isoformat()} baserat på rotationsprincipen."
                )
            elif shift_type == ShiftType.DELAD_TUR:
                decisions.append(
                    f"{d.isoformat()}: {emp.name} tilldelad delad tur (DELAD_TUR) den {d.isoformat()} som sista utväg för att täcka bemanningsbrist."
                )
            elif shift_type == ShiftType.NATT:
                decisions.append(
                    f"{d.isoformat()}: {emp.name} tilldelad nattpass (NATT) den {d.isoformat()} enligt bemanningskrav."
                )
            else:
                decisions.append(
                    f"{d.isoformat()}: {emp.name} tilldelad {shift_type.value} den {d.isoformat()} för att täcka bemanningskravet (prioriterad baserat på lägst ackumulerat timsaldo)."
                )

    def get_unavailable_reason(emp: Employee, d: date, stype: ShiftType) -> str:
        if d in absence_dates[emp.id]:
            return "frånvaro/semester"
        if d in veto_dates[emp.id]:
            return "lagt veto"
        if wish_schedule_idx.get(emp.id, {}).get(d, "NOT_SET") is None:
            return "önskat ledigt"
        
        weekday = d.weekday()
        allowed = CONTRACT_RULES.get(emp.contract_type, {}).get("allowed_weekdays", list(range(7)))
        if weekday not in allowed:
            return "ej tillåten veckodag"
            
        helg_contracts = {ContractType.HELG_FRE_MAN}
        if _is_weekend(d) and emp.contract_type not in helg_contracts and weekend_count[emp.id] >= 2:
            return "max 2 helger uppnått"
            
        if emp.contract_type == ContractType.KVAL and stype in (ShiftType.DAG_TIDIG, ShiftType.DAG):
            return "kvällskontrakt"
            
        if emp.is_dagansvarig and stype in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG, ShiftType.NATT):
            return "dagansvarig"
            
        if emp.contract_type == ContractType.HELG_FRE_MAN and d.weekday() not in CONTRACT_RULES[ContractType.HELG_FRE_MAN]["allowed_weekdays"]:
            return "helgkontrakt"
            
        if emp.contract_type == ContractType.NATT and stype != ShiftType.NATT:
            return "nattkontrakt"
            
        if stype == ShiftType.NATT and emp.contract_type != ContractType.NATT:
            return "ej nattkontrakt"
            
        if (emp.id, d) in assignments:
            return "redan tilldelad pass"
            
        if emp.id in last_shift_end:
            start_t = templates[stype][0]
            next_start = datetime(d.year, d.month, d.day, start_t.hour, start_t.minute, tzinfo=STOCKHOLM)
            rest_h = (next_start - last_shift_end[emp.id]).total_seconds() / 3600.0
            if rest_h < 11.0:
                return "dygnsvila bryts"
                
        window_start = d - timedelta(days=27)
        worked_in_window = sum(1 for wd in work_days_per_emp[emp.id] if wd >= window_start)
        if worked_in_window >= 19:
            return "9 lediga dagar på 28 dagar-regeln"
            
        max_consec = 5 if emp.contract_type == ContractType.DAGTID else 4
        consecutive = 0
        check = d - timedelta(days=1)
        worked = work_days_per_emp[emp.id]
        while check in worked:
            consecutive += 1
            check -= timedelta(days=1)
        if consecutive >= max_consec:
            return "veckovila (max konsekutiva arbetsdagar)"
        return "avtalshinder"

    def explain_shortage(group_emps: list[Employee], d: date, stype: ShiftType) -> str:
        reasons = defaultdict(int)
        for emp in group_emps:
            reason = get_unavailable_reason(emp, d, stype)
            reasons[reason] += 1
        
        parts = []
        for reason, count in sorted(reasons.items(), key=lambda x: x[1], reverse=True):
            parts.append(f"{count} st pga {reason}")
        return ", ".join(parts)

    # -----------------------------------------------------------------------
    # Huvudloop: dag för dag
    # -----------------------------------------------------------------------
    current = period_start
    while current <= period_end:
        for group, group_emps in employees_by_group.items():
            day_krav = krav_index.get((group, current))

            # Standard-krav om inget konfigurerat: 2 fm + 2 kval
            fm_needed  = day_krav.fm_heads  if day_krav else 2
            kval_needed = day_krav.kval_heads if day_krav else 2
            natt_needed = day_krav.natt_heads if day_krav else 0

            # --- Önskemålskorrigering för krockande dagpass ---
            day_wishing_candidates = []
            for emp in group_emps:
                # Kolla om personen har ett önskemål om dagpass denna dag
                has_day_wish = False
                if current in wish_dates.get(emp.id, set()):
                    has_day_wish = True
                else:
                    wished_stype = wish_schedule_idx.get(emp.id, {}).get(current)
                    if wished_stype is not None:
                        wished_val = wished_stype.value if hasattr(wished_stype, "value") else str(wished_stype)
                        if wished_val in (ShiftType.DAG.value, ShiftType.DAG_TIDIG.value):
                            has_day_wish = True

                # Om personen har önskemål och är tillgänglig för dagpass
                if has_day_wish and (available(emp, current, ShiftType.DAG) or available(emp, current, ShiftType.DAG_TIDIG)):
                    day_wishing_candidates.append(emp)

            if len(day_wishing_candidates) > max(fm_needed, 0):
                prioritized = []
                ordinary = []
                for emp in day_wishing_candidates:
                    if emp.is_dagansvarig or emp.contract_type == ContractType.DAGTID:
                        prioritized.append(emp)
                    else:
                        ordinary.append(emp)

                slots_left = max(0, fm_needed - len(prioritized))
                # Sortera de vanliga medarbetarna efter prioritet
                ordinary.sort(key=lambda e: (priority_key(e, current, category="day"), e.id))

                # De som inte ryms flyttas till kvällspass
                to_shift = ordinary[slots_left:]
                for emp in to_shift:
                    # Flytta från dag-önskemål till kvällspass (KVAL_KORT)
                    if current in wish_dates.get(emp.id, set()):
                        wish_dates[emp.id].remove(current)

                    # Skapa/uppdatera specifikt önskemål om kvällspass i indexet
                    wish_schedule_idx[emp.id][current] = ShiftType.KVAL_KORT

                    # Blockera dem från att få dagpass denna dag
                    blocked_day_shifts.add((emp.id, current))

                    # Logga beslutet på svenska
                    decisions.append(
                        f"{current.isoformat()}: [Önskemålskorrigering] {emp.name} flyttades till kvällspass då dagpass prioriterades för dagansvariga."
                    )
            # --- Önskemålskorrigering för krockande kvällspass ---
            evening_wishing_candidates = []
            for emp in group_emps:
                has_evening_wish = False
                wished_stype = wish_schedule_idx.get(emp.id, {}).get(current)
                if wished_stype is not None:
                    wished_val = wished_stype.value if hasattr(wished_stype, "value") else str(wished_stype)
                    if wished_val in (ShiftType.KVAL_KORT.value, ShiftType.KVAL_LANG.value):
                        has_evening_wish = True
                elif emp.contract_type == ContractType.KVAL and current in wish_dates.get(emp.id, set()):
                    has_evening_wish = True

                if has_evening_wish and (available(emp, current, ShiftType.KVAL_KORT) or available(emp, current, ShiftType.KVAL_LANG)):
                    evening_wishing_candidates.append(emp)

            if len(evening_wishing_candidates) > max(kval_needed, 0):
                prioritized = []
                ordinary = []
                for emp in evening_wishing_candidates:
                    if emp.contract_type == ContractType.KVAL:
                        prioritized.append(emp)
                    else:
                        ordinary.append(emp)

                slots_left = max(0, kval_needed - len(prioritized))
                ordinary.sort(key=lambda e: (priority_key(e, current, category="evening"), e.id))

                to_shift = ordinary[slots_left:]
                for emp in to_shift:
                    wish_schedule_idx[emp.id][current] = ShiftType.DAG
                    blocked_evening_shifts.add((emp.id, current))
                    decisions.append(
                        f"{current.isoformat()}: [Önskemålskorrigering] {emp.name} flyttades till dagpass då kvällspass prioriterades för kvällspersonal."
                    )

            # --- 1. DAG_TIDIG (06:45-regeln) — exakt 1 per grupp per dag ---
            varierande_emps = [e for e in group_emps if e.contract_type == ContractType.VARIERANDE]
            dag_tidig_candidates = sorted(
                [e for e in varierande_emps if available(e, current, ShiftType.DAG_TIDIG)],
                key=lambda e: priority_key(e, current, category="day"),
            )

            if dag_tidig_candidates:
                # Önskemål styr, annars rotation
                wished = [e for e in dag_tidig_candidates if current in wish_dates[e.id]]
                if wished:
                    chosen = wished[0]
                else:
                    idx = last_dag_tidig[group] % len(dag_tidig_candidates)
                    chosen = dag_tidig_candidates[idx]
                assign(chosen, current, ShiftType.DAG_TIDIG)
                last_dag_tidig[group] += 1
                fm_needed -= 1  # DAG_TIDIG räknas som fm

            # --- 2. Fyll återstående fm-slots med DAG ---
            # Helgkontrakt (HELG_FRE_MAN) får jobba DAG på sina tillåtna dagar
            fm_candidates = sorted(
                [e for e in group_emps if available(e, current, ShiftType.DAG)
                 and e.contract_type not in (ContractType.KVAL, ContractType.NATT)],
                key=lambda e: priority_key(e, current, category="day"),
            )
            assigned_dag = 0
            for emp in fm_candidates[:max(fm_needed, 0)]:
                assign(emp, current, ShiftType.DAG)
                assigned_dag += 1
            fm_needed -= assigned_dag

            # --- 3. Fyll kval-slots ---
            kval_candidates = sorted(
                [e for e in group_emps if available(e, current, ShiftType.KVAL_KORT)],
                key=lambda e: priority_key(e, current, category="evening"),
            )
            assigned_kval = 0
            for i, emp in enumerate(kval_candidates[:max(kval_needed, 0)]):
                # Alternera mellan KVAL_KORT och KVAL_LANG
                stype = ShiftType.KVAL_LANG if i % 2 == 0 else ShiftType.KVAL_KORT
                assign(emp, current, stype)
                assigned_kval += 1
            kval_needed -= assigned_kval

            # --- 3b. Delad tur som sista utväg om BÅDE fm och kval fortfarande saknas ---
            if fm_needed > 0 and kval_needed > 0:
                delad_candidates = sorted(
                    [e for e in group_emps if available(e, current, ShiftType.DAG)
                     and e.contract_type == ContractType.VARIERANDE],
                    key=lambda e: priority_key(e, current),
                )
                for emp in delad_candidates[:1]:  # max 1 delad tur per dag
                    assign(emp, current, ShiftType.DELAD_TUR)
                    fm_needed -= 1
                    kval_needed -= 1

            # --- 4. Fyll natt-slots ---
            natt_candidates = sorted(
                [e for e in group_emps if available(e, current, ShiftType.NATT)
                 and e.contract_type == ContractType.NATT],
                key=lambda e: priority_key(e, current),
            )
            assigned_natt = 0
            for emp in natt_candidates[:max(natt_needed, 0)]:
                assign(emp, current, ShiftType.NATT)
                assigned_natt += 1
            natt_needed -= assigned_natt

            # Kontrollera om det finns ett underskott (bemanningsbrist) efter alla tilldelningar
            if fm_needed > 0:
                explanation = explain_shortage(group_emps, current, ShiftType.DAG)
                decisions.append(
                    f"{current.isoformat()}: [Bemanningsbrist] Saknas {fm_needed} medarbetare på förmiddagen (FM) i {group.value}. Det behövs en vikarie för att täcka upp. (Hinder för ordinarie personal: {explanation})"
                )
            if kval_needed > 0:
                explanation = explain_shortage(group_emps, current, ShiftType.KVAL_KORT)
                decisions.append(
                    f"{current.isoformat()}: [Bemanningsbrist] Saknas {kval_needed} medarbetare på kvällen (KVAL) i {group.value}. Det behövs en vikarie för att täcka upp. (Hinder för ordinarie personal: {explanation})"
                )
            if natt_needed > 0:
                explanation = explain_shortage(group_emps, current, ShiftType.NATT)
                decisions.append(
                    f"{current.isoformat()}: [Bemanningsbrist] Saknas {natt_needed} medarbetare på natten (NATT) i {group.value}. Det behövs en vikarie för att täcka upp. (Hinder för ordinarie personal: {explanation})"
                )

        current += timedelta(days=1)

    # -----------------------------------------------------------------------
    # HELGER-FYLLNAD: minst 2 helger per VARIERANDE/KVAL
    # -----------------------------------------------------------------------
    for group_emps in employees_by_group.values():
        for emp in group_emps:
            if emp.contract_type not in _HELG_CONTRACTS:
                continue
            if weekend_count[emp.id] >= 2:
                continue
            current = period_start
            while current <= period_end and weekend_count[emp.id] < 2:
                if _is_weekend(current):
                    stype = ShiftType.KVAL_KORT if emp.contract_type == ContractType.KVAL else ShiftType.DAG
                    if available(emp, current, stype):
                        assign(
                            emp,
                            current,
                            stype,
                            reason=f"{emp.name} tilldelad helgpass {stype.value} den {current.isoformat()} för att uppfylla regeln om 2 helgpass per period."
                        )
                current += timedelta(days=1)

    # -----------------------------------------------------------------------
    # HELGKONTRAKT-FYLLNAD: HELG_FRE_MAN jobbar VARJE helg
    # Deras hela kontrakt är helgarbete — fyll alla tillåtna dagar (fre-mån, max 3/helg)
    # -----------------------------------------------------------------------
    _HELGKONTRAKT = {ContractType.HELG_FRE_MAN}
    for group_emps in employees_by_group.values():
        for emp in group_emps:
            if emp.contract_type not in _HELGKONTRAKT:
                continue
            current = period_start
            while current <= period_end:
                if (emp.id, current) not in assignments:
                    # Försök DAG, annars KVAL_KORT
                    for stype in (ShiftType.DAG, ShiftType.KVAL_KORT):
                        if available(emp, current, stype):
                            assign(
                                emp,
                                current,
                                stype,
                                reason=f"{emp.name} (helgmedarbetare) tilldelad helgpass {stype.value} den {current.isoformat()} enligt kontrakt."
                            )
                            break
                current += timedelta(days=1)

    # -----------------------------------------------------------------------
    # OBOKAD-FYLLNAD: fyll upp kontraktstimmar på lediga dagar
    # Använder available() → respekterar dygnsvila, veckovila, 9-dagarsregeln
    # -----------------------------------------------------------------------
    for emp in employees:
        if emp.contract_type in (ContractType.NATT, ContractType.VIKARIE):
            continue
        rules = CONTRACT_RULES.get(emp.contract_type, {})
        weekly_hours: float = rules.get("weekly_hours", 0.0)
        weeks = (period_end - period_start).days / 7.0
        target_hours = weekly_hours * weeks * emp.percentage
        deficit = target_hours - scheduled_hours[emp.id]
        if deficit <= 1.0:
            continue
        current = period_start
        while current <= period_end and deficit > 1.0:
            if (emp.id, current) not in assignments and available(emp, current, ShiftType.DAG):
                shift_hours = min(deficit, 8.0)
                start_dt = datetime(current.year, current.month, current.day, 7, 0, tzinfo=STOCKHOLM)
                end_dt = start_dt + timedelta(hours=shift_hours)
                obokad = Shift(
                    shift_type=ShiftType.OBOKAD,
                    segments=[ShiftSegment(start_time=start_dt, end_time=end_dt)],
                    is_unbooked=True,
                )
                decisions.append(
                    f"{current.isoformat()}: {emp.name} tilldelad {shift_hours:.1f} timmar OBOKAD tid den {current.isoformat()} för att fylla upp timunderskottet (mål: {target_hours:.1f}h, inplanerat: {scheduled_hours[emp.id]:.1f}h)."
                )
                assignments[(emp.id, current)] = ScheduleDay(
                    date=current, employee_id=emp.id, shift=obokad,
                )
                scheduled_hours[emp.id] += shift_hours
                last_shift_end[emp.id] = end_dt
                work_days_per_emp[emp.id].add(current)
                deficit -= shift_hours
            current += timedelta(days=1)

    # -----------------------------------------------------------------------
    # Bygg lista med ScheduleDay för ALLA medarbetare + dagar
    # (inklusive lediga dagar som ScheduleDay med shift=None)
    # -----------------------------------------------------------------------
    all_days: list[ScheduleDay] = []

    current = period_start
    while current <= period_end:
        for emp in employees:
            if (emp.id, current) in assignments:
                all_days.append(assignments[(emp.id, current)])
            else:
                # Frånvaro eller ledig dag
                abs_on_day = next((a for a in emp.absences if a.date == current), None)
                all_days.append(ScheduleDay(
                    date=current,
                    employee_id=emp.id,
                    shift=None,
                    absence=abs_on_day,
                ))
        current += timedelta(days=1)

    # -----------------------------------------------------------------------
    # Fördela överkapacitet (timkrav)
    # -----------------------------------------------------------------------
    allocate_overcapacity(all_days, employees, krav, decisions)

    # -----------------------------------------------------------------------
    # Validera och beräkna statistik
    # -----------------------------------------------------------------------
    validation = validate_schedule(all_days, employees, krav)

    total_shifts = sum(1 for sd in all_days if sd.shift and not sd.shift.is_unbooked)
    total_obokad = sum(1 for sd in all_days if sd.shift and sd.shift.is_unbooked)
    hard_errors = sum(1 for e in validation.errors if e.severity == "hard")
    soft_warnings = sum(1 for e in validation.errors if e.severity == "soft")

    stats = {
        "total_shifts": total_shifts,
        "obokad_days": total_obokad,
        "hard_errors": hard_errors,
        "soft_warnings": soft_warnings,
        "validation": validation,
        "decisions": decisions,
    }

    return all_days, stats


def allocate_overcapacity(
    schedule_days: list[ScheduleDay],
    employees: list[Employee],
    krav: list[Bemanningskrav] | None,
    decisions: list[str],
) -> None:
    """
    Analyserar schemat dag för dag och fördelar eventuell överkapacitet
    under specifika timintervall till planeringstid, kontorstid eller obokad tid.
    """
    if not krav:
        return

    from app.engine.schemas import ShiftSegment, ShiftType, Shift, ContractType
    emp_map = {emp.id: emp for emp in employees}

    # Räkna antalet tilldelade planeringstillfällen per anställd under hela perioden
    # för rättviserotation (varje unik dag med planeringstid räknas som 1 tillfälle)
    planning_days_count = {emp.id: 0 for emp in employees}
    for sd in schedule_days:
        if sd.shift:
            has_planning = (sd.shift.shift_type == ShiftType.PLANERINGSTID) or any(
                getattr(seg, "activity", None) == ShiftType.PLANERINGSTID for seg in sd.shift.segments
            )
            if has_planning:
                planning_days_count[sd.employee_id] += 1

    # Gruppera bemanningskrav per datum och grupp
    krav_index = {(k.group, k.date): k for k in krav}

    # Gruppera schedule_days per (group, date)
    days_by_group_date = {}
    for sd in schedule_days:
        emp = emp_map.get(sd.employee_id)
        if not emp or not sd.shift:
            continue
        act_group = sd.assigned_group if sd.assigned_group is not None else emp.group
        key = (act_group, sd.date)
        if key not in days_by_group_date:
            days_by_group_date[key] = []
        days_by_group_date[key].append(sd)

    # Processa varje grupp och datum
    for (group, d), k in krav_index.items():
        if not getattr(k, "hourly_requirements", None):
            continue

        group_date_days = days_by_group_date.get((group, d), [])
        if not group_date_days:
            continue

        for hr in k.hourly_requirements:
            try:
                start_h, start_m = map(int, hr.start_time.split(":"))
                end_h, end_m = map(int, hr.end_time.split(":"))
                req_start = datetime(d.year, d.month, d.day, start_h, start_m, tzinfo=STOCKHOLM)
                req_end = datetime(d.year, d.month, d.day, end_h, end_m, tzinfo=STOCKHOLM)
            except Exception:
                continue

            # Loopa tills vi har fördelat allt överskott eller inte har fler kandidater
            while True:
                # Identifiera aktiva medarbetare under detta intervall
                active_candidates = []
                for sd in group_date_days:
                    emp = emp_map.get(sd.employee_id)
                    if not emp:
                        continue

                    # Kolla om något segment överlappar och är aktivt
                    for seg in sd.shift.segments:
                        overlap_start = max(seg.start_time, req_start)
                        overlap_end = min(seg.end_time, req_end)
                        if overlap_start < overlap_end:
                            # Överlappar! Kolla aktivitet
                            activity_type = getattr(seg, "activity", None) or sd.shift.shift_type
                            if activity_type not in (ShiftType.PLANERINGSTID, ShiftType.KONTORSTID, ShiftType.OBOKAD):
                                active_candidates.append((sd, emp, seg))
                                break  # räkna en gång per person

                active_count = len(active_candidates)
                if active_count <= hr.needed_heads:
                    break  # Inget överskott kvar

                # Vi har överskott. Vi ska fördela 1 person till nästa prioriterade aktivitet
                activity_to_assign = None
                selected_cand = None

                for act_str in hr.prioritized_activities:
                    try:
                        act_type = ShiftType(act_str.lower())
                    except ValueError:
                        continue

                    # Filtrera kandidater som är behöriga för denna aktivitet
                    # Regler: vikarier får inte få planeringstid eller kontorstid
                    eligible = []
                    for sd, emp, seg in active_candidates:
                        if act_type in (ShiftType.PLANERINGSTID, ShiftType.KONTORSTID) and emp.contract_type == ContractType.VIKARIE:
                            continue
                        eligible.append((sd, emp, seg))

                    if not eligible:
                        continue

                    # Sortera de behöriga kandidaterna
                    if act_type == ShiftType.PLANERINGSTID:
                        # 1. Planerare först (is_planerare = True)
                        # 2. Rättviserotation: lägst antal planeringsdagar denna period först
                        # 3. ID för determinism
                        eligible.sort(key=lambda x: (
                            0 if x[1].is_planerare else 1,
                            planning_days_count[x[1].id],
                            x[1].id
                        ))
                    else:
                        # För kontorstid/obokad: standard sortering (id för determinism)
                        eligible.sort(key=lambda x: x[1].id)

                    selected_cand = eligible[0]
                    activity_to_assign = act_type
                    break

                if not selected_cand or not activity_to_assign:
                    # Inga fler giltiga aktiviteter eller behöriga kandidater
                    break

                # Utför splitten för den valda kandidaten
                sd, emp, seg = selected_cand

                # Splitta segmentet 'seg' i sd.shift.segments
                new_segments = []
                for s in sd.shift.segments:
                    if s == seg:
                        # Detta är segmentet som överlappar. Vi splittar det.
                        overlap_start = max(s.start_time, req_start)
                        overlap_end = min(s.end_time, req_end)

                        # Del 1: Före intervallet
                        if s.start_time < overlap_start:
                            new_segments.append(ShiftSegment(
                                start_time=s.start_time,
                                end_time=overlap_start,
                                activity=getattr(s, "activity", None)
                            ))
                        # Del 2: Under intervallet (får den nya aktiviteten)
                        new_segments.append(ShiftSegment(
                            start_time=overlap_start,
                            end_time=overlap_end,
                            activity=activity_to_assign
                        ))
                        # Del 3: Efter intervallet
                        if s.end_time > overlap_end:
                            new_segments.append(ShiftSegment(
                                start_time=overlap_end,
                                end_time=s.end_time,
                                activity=getattr(s, "activity", None)
                            ))
                    else:
                        new_segments.append(s)

                sd.shift.segments = new_segments

                # Uppdatera planeringstid-räknare
                if activity_to_assign == ShiftType.PLANERINGSTID:
                    planning_days_count[emp.id] += 1

                # Logga beslutet
                decisions.append(
                    f"{d.isoformat()}: [Överkapacitet] {emp.name} tilldelad {activity_to_assign.value} under intervallet {hr.start_time}–{hr.end_time} (bemanningsbehov: {hr.needed_heads}, aktiva: {active_count})."
                )
