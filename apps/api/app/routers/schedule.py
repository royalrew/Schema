# -*- coding: utf-8 -*-
import calendar
import json
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

STOCKHOLM = ZoneInfo("Europe/Stockholm")

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import EmployeeRow, SchedulePeriodRow, BemanningskravRow, ShiftConfigRow, StaffingTemplateRow, UserRow
from app.auth_utils import get_current_user, require_admin_or_schemaansvarig
from app.engine.schemas import (
    Employee, ContractType, Group, Absence, AbsenceType,
    ScheduleDay, Shift, ShiftSegment, ShiftType, Bemanningskrav, ValidationResult,
    SoftConstraint, WishShiftEntry,
)
from app.engine.generator import generate_schedule, _make_shift, _build_templates, _DELAD_TUR_FM, _DELAD_TUR_KVAL
from app.engine.solver import validate_schedule
from app.routers.staffing import _default_krav, _krav_from_template, StaffingTemplate

router = APIRouter(prefix="/api", tags=["schedule"])


# ── Request / Response models ────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    group: Group
    year: int
    month: int


class GenerateResponse(BaseModel):
    schedule_days: list[ScheduleDay]
    validation: ValidationResult
    stats: dict[str, Any]
    phase: str = "correction"
    decisions: list[str] = []


class PeriodInfo(BaseModel):
    phase: str
    has_schedule: bool
    apt_date: str | None = None
    apt_time: str | None = None
    wish_deadline: str | None = None
    decisions: list[str] = []


class AptRequest(BaseModel):
    apt_date: str | None  # ISO-datum eller null för att ta bort
    apt_time: str | None = None  # HH:MM klockslag, eller null


class WishDeadlineRequest(BaseModel):
    wish_deadline: str | None  # ISO-datum eller null för att ta bort


class PhaseUpdateRequest(BaseModel):
    phase: str  # wish | correction | attested


class UpdateScheduleDayRequest(BaseModel):
    employee_id: str
    date: str  # YYYY-MM-DD
    shift_type: Optional[str] = None  # ShiftType value, or None
    absence_type: Optional[str] = None  # AbsenceType value, or None
    start_time: Optional[str] = None  # "HH:MM", or None
    end_time: Optional[str] = None  # "HH:MM", or None
    note: Optional[str] = None


class UpdateScheduleDayResponse(BaseModel):
    schedule: list[ScheduleDay]
    decisions: list[str]
    validation: ValidationResult


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_decisions(decisions_data: Any) -> list[str]:
    if not decisions_data:
        return []
    if isinstance(decisions_data, list):
        return decisions_data
    if isinstance(decisions_data, str):
        try:
            parsed = json.loads(decisions_data)
            if isinstance(parsed, list):
                return parsed
            return [str(parsed)]
        except Exception:
            return [decisions_data]
    return [str(decisions_data)]


def _row_to_employee(row: EmployeeRow) -> Employee:
    return Employee(
        id=row.id,
        name=row.name,
        contract_type=ContractType(row.contract_type),
        group=Group(row.group_name),
        absences=[
            Absence(date=date.fromisoformat(a["date"]),
                    absence_type=AbsenceType(a["absence_type"]))
            for a in (row.absences or [])
        ],
        wishes=[date.fromisoformat(w) for w in (row.wishes or [])],
        vetos=[date.fromisoformat(v) for v in (row.vetos or [])],
        soft_constraints=[SoftConstraint(**c) for c in (row.soft_constraints or [])],
        wish_schedule=[WishShiftEntry(**w) for w in (row.wish_schedule or [])],
        is_dagansvarig=bool(row.is_dagansvarig or False),
    )


def _schedule_day_to_dict(sd: ScheduleDay) -> dict:
    return sd.model_dump(mode="json")


def _dict_to_schedule_day(d: dict) -> ScheduleDay:
    return ScheduleDay.model_validate(d)


# ── Endpoints ────────────────────────────────────────────────────────────────

VALID_PHASES = {"wish", "correction", "attested"}


@router.get("/period/{group}/{year}/{month}", response_model=PeriodInfo)
async def get_period_info(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(get_current_user),
):
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"
    stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        return PeriodInfo(phase="wish", has_schedule=False, apt_date=None, wish_deadline=None, decisions=[])
    return PeriodInfo(phase=row.phase, has_schedule=bool(row.schedule), apt_date=row.apt_date, apt_time=row.apt_time, wish_deadline=row.wish_deadline, decisions=_parse_decisions(row.decisions))


@router.post("/period/{group}/{year}/{month}/phase", response_model=PeriodInfo)
async def advance_phase(
    group: str, year: int, month: int,
    req: PhaseUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"
    if req.phase not in VALID_PHASES:
        raise HTTPException(status_code=422, detail=f"Ogiltig fas: {req.phase}")

    stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()

    fas_namn = {"wish": "Önskemål", "correction": "Korrigering", "attested": "Attesterad"}.get(req.phase, req.phase)
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    log_entry = f"[{timestamp_str}] Status ändrad till '{fas_namn}' av {current_user.full_name or current_user.username}."

    if not row:
        row = SchedulePeriodRow(group_name=group, year=year, month=month, phase=req.phase, schedule=[], decisions=[log_entry])
        db.add(row)
    else:
        row.phase = req.phase
        current_decisions = list(row.decisions or [])
        current_decisions.append(log_entry)
        row.decisions = current_decisions

    await db.commit()
    return PeriodInfo(phase=row.phase, has_schedule=bool(row.schedule), apt_date=row.apt_date, apt_time=row.apt_time, wish_deadline=row.wish_deadline, decisions=_parse_decisions(row.decisions))


@router.post("/period/{group}/{year}/{month}/apt", response_model=PeriodInfo)
async def set_apt(
    group: str, year: int, month: int,
    req: AptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"
    stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    tid_str = f" kl. {req.apt_time}" if req.apt_time else ""
    log_entry = f"[{timestamp_str}] APT satt till {req.apt_date}{tid_str} av {current_user.full_name or current_user.username}."

    if not row:
        row = SchedulePeriodRow(group_name=group, year=year, month=month,
                                phase="wish", schedule=[], apt_date=req.apt_date, apt_time=req.apt_time, decisions=[log_entry])
        db.add(row)
    else:
        row.apt_date = req.apt_date
        row.apt_time = req.apt_time
        current_decisions = list(row.decisions or [])
        current_decisions.append(log_entry)
        row.decisions = current_decisions
    await db.commit()
    return PeriodInfo(phase=row.phase, has_schedule=bool(row.schedule), apt_date=row.apt_date, apt_time=row.apt_time, wish_deadline=row.wish_deadline, decisions=_parse_decisions(row.decisions))


@router.post("/period/{group}/{year}/{month}/wish-deadline", response_model=PeriodInfo)
async def set_wish_deadline(
    group: str, year: int, month: int,
    req: WishDeadlineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"
    stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    row = (await db.execute(stmt)).scalar_one_or_none()

    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    log_entry = f"[{timestamp_str}] Sista dag för önskeschema satt till {req.wish_deadline} av {current_user.full_name or current_user.username}."

    if not row:
        row = SchedulePeriodRow(group_name=group, year=year, month=month,
                                phase="wish", schedule=[], wish_deadline=req.wish_deadline, decisions=[log_entry])
        db.add(row)
    else:
        row.wish_deadline = req.wish_deadline
        current_decisions = list(row.decisions or [])
        current_decisions.append(log_entry)
        row.decisions = current_decisions
    await db.commit()
    return PeriodInfo(phase=row.phase, has_schedule=bool(row.schedule), apt_date=row.apt_date, apt_time=row.apt_time, wish_deadline=row.wish_deadline, decisions=_parse_decisions(row.decisions))


@router.get("/schedule/{group}/{year}/{month}", response_model=list[ScheduleDay])
async def get_schedule(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(get_current_user),
):
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"
    stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    own_days = []
    if row and row.schedule:
        own_days = [_dict_to_schedule_day(sd) for sd in row.schedule]

    # Hämta inlånad personal från andra gruppers scheman
    other_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name != group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    other_result = await db.execute(other_stmt)
    other_rows = other_result.scalars().all()

    borrowed_days = []
    for r in other_rows:
        if not r.schedule:
            continue
        for sd_dict in r.schedule:
            sd = _dict_to_schedule_day(sd_dict)
            if sd.assigned_group == group:
                borrowed_days.append(sd)

    return own_days + borrowed_days


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    req: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    if current_user.username.startswith("demo_"):
        req.group = f"Granbacken ({current_user.username})"
    # Hämta anställda för gruppen
    emp_stmt = select(EmployeeRow).where(EmployeeRow.group_name == req.group.value)
    emp_result = await db.execute(emp_stmt)
    emp_rows = emp_result.scalars().all()

    if not emp_rows:
        raise HTTPException(status_code=404, detail=f"Inga anställda hittades för grupp {req.group.value}")

    employees = [_row_to_employee(r) for r in emp_rows]

    # Hämta bemanningskrav
    krav_stmt = select(BemanningskravRow).where(
        BemanningskravRow.group_name == req.group.value,
        BemanningskravRow.year == req.year,
        BemanningskravRow.month == req.month,
    )
    krav_result = await db.execute(krav_stmt)
    krav_row = krav_result.scalar_one_or_none()

    if krav_row and krav_row.requirements:
        krav = [
            Bemanningskrav(
                group=Group(k["group"]),
                date=date.fromisoformat(k["date"]),
                fm_heads=k.get("fm_heads", 2),
                em_heads=k.get("em_heads", 0),
                kval_heads=k.get("kval_heads", 2),
                natt_heads=k.get("natt_heads", 0),
            )
            for k in krav_row.requirements
        ]
    else:
        # Hämta gruppens staffing-template (vardag/helg-uppdelning)
        tmpl_row = (await db.execute(
            select(StaffingTemplateRow).where(StaffingTemplateRow.group_name == req.group.value)
        )).scalar_one_or_none()

        if tmpl_row and tmpl_row.per_weekday:
            from app.routers.staffing import DayKrav
            tmpl = StaffingTemplate(
                group_name=req.group.value,
                per_weekday=[DayKrav(**d) for d in tmpl_row.per_weekday],
            )
            krav = _krav_from_template(tmpl, req.group, req.year, req.month)
        else:
            krav = _default_krav(req.group, req.year, req.month)

    _, last_day = calendar.monthrange(req.year, req.month)
    period_start = date(req.year, req.month, 1)
    period_end = date(req.year, req.month, last_day)

    # Hämta alla andra schemaperioder för att återställa tidigare lån och låna vid behov
    other_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name != req.group.value,
        SchedulePeriodRow.year == req.year,
        SchedulePeriodRow.month == req.month,
    )
    other_result = await db.execute(other_stmt)
    other_rows = other_result.scalars().all()

    # 1. Återställ eventuell tidigare inlånad personal från denna grupp i andra scheman
    other_modified = False
    for r in other_rows:
        if not r.schedule:
            continue
        r_sched = list(r.schedule)
        modified_r = False
        for sd in r_sched:
            if sd.get("assigned_group") == req.group.value:
                # Återställ till OBOKAD
                sd["assigned_group"] = None
                if sd.get("shift"):
                    shift = sd["shift"]
                    shift["shift_type"] = "obokad"
                    shift["is_unbooked"] = True
                    # Skapa standard 8-timmars OBOKAD-pass på det datumet
                    d = date.fromisoformat(sd["date"])
                    start_dt = datetime(d.year, d.month, d.day, 7, 0, tzinfo=STOCKHOLM)
                    end_dt = start_dt + timedelta(hours=8.0)
                    shift["segments"] = [
                        {"start_time": start_dt.isoformat(), "end_time": end_dt.isoformat()}
                    ]
                modified_r = True
        if modified_r:
            r.schedule = r_sched
            db.add(r)
            other_modified = True

    if other_modified:
        await db.commit()

    # Hämta passtider — gruppspecifika overrides + globala defaults
    cfg_stmt = select(ShiftConfigRow).where(
        (ShiftConfigRow.group_name == req.group.value) | ShiftConfigRow.group_name.is_(None)
    )
    cfg_rows = (await db.execute(cfg_stmt)).scalars().all()
    # Gruppspecifik override vinner över global
    seen: dict[str, dict] = {}
    for r in sorted(cfg_rows, key=lambda x: (x.group_name is None)):  # global sist → override vinner
        seen[r.shift_type] = {"shift_type": r.shift_type, "start_time": r.start_time, "end_time": r.end_time}
    shift_configs = list(seen.values())

    # Kör generatorn
    schedule_days, stats = generate_schedule(employees, krav, period_start, period_end, shift_configs)

    # 2. Andra passet: Låna in OBOKAD ordinarie personal från andra grupper vid bemanningsbrist
    # Hämta alla anställda i hela systemet för regler-koll
    all_emp_stmt = select(EmployeeRow)
    all_emp_result = await db.execute(all_emp_stmt)
    all_employees = [_row_to_employee(r) for r in all_emp_result.scalars().all()]
    all_employees_map = {emp.id: emp for emp in all_employees}

    krav_map = {k.date: k for k in krav}
    templates = _build_templates(shift_configs)
    decisions = stats.get("decisions", [])

    # Beräkna faktiska tillsatta huvuden i det nyss genererade schemat
    actual_heads = {}
    for sd in schedule_days:
        if not sd.shift or sd.shift.is_unbooked:
            continue
        stype = sd.shift.shift_type
        slot = None
        if stype in (ShiftType.DAG, ShiftType.DAG_TIDIG):
            slot = "fm"
        elif stype == ShiftType.DELAD_TUR:
            slot = "em"
        elif stype in (ShiftType.KVAL_KORT, ShiftType.KVAL_LANG, ShiftType.APT):
            slot = "kval"
        elif stype == ShiftType.NATT:
            slot = "natt"
        
        if slot:
            key = (sd.date, slot)
            actual_heads[key] = actual_heads.get(key, 0) + 1

    current_d = period_start
    while current_d <= period_end:
        k = krav_map.get(current_d)
        fm_needed   = k.fm_heads if k else 2
        em_needed   = k.em_heads if k else 0
        kval_needed = k.kval_heads if k else 2
        natt_needed = k.natt_heads if k else 0

        # Rensa eventuella gamla bemanningsbrist-beslut i beslutsloggen för denna dag så vi kan skriva nya
        # som tar hänsyn till inlåning
        decisions = [d for d in decisions if not (d.startswith(current_d.isoformat()) and "[Bemanningsbrist]" in d)]

        for slot, needed in [("fm", fm_needed), ("em", em_needed), ("kval", kval_needed), ("natt", natt_needed)]:
            have = actual_heads.get((current_d, slot), 0)
            shortage = needed - have

            if shortage <= 0:
                continue

            needed_shift_type = None
            if slot == "fm":
                needed_shift_type = ShiftType.DAG
            elif slot == "em":
                needed_shift_type = ShiftType.DELAD_TUR
            elif slot == "kval":
                needed_shift_type = ShiftType.KVAL_LANG
            elif slot == "natt":
                needed_shift_type = ShiftType.NATT

            if not needed_shift_type:
                continue

            # Låna in en efter en
            for _ in range(shortage):
                borrowed_candidate = None

                for r in other_rows:
                    if not r.schedule:
                        continue

                    r_sched = list(r.schedule)
                    for idx, sd_dict in enumerate(r_sched):
                        if sd_dict["date"] != current_d.isoformat():
                            continue
                        
                        shift_dict = sd_dict.get("shift")
                        if not shift_dict or not shift_dict.get("is_unbooked"):
                            continue
                        if sd_dict.get("assigned_group"):
                            continue

                        # Hittade en kandidat med OBOKAD
                        emp = all_employees_map.get(sd_dict["employee_id"])
                        if not emp:
                            continue

                        # Bygg det föreslagna inlåningspasset
                        borrowed_shift = _make_shift(needed_shift_type, current_d, templates, employee=emp)

                        # Skapa temporära ScheduleDay-objekt för att validera hem-schemat
                        home_schedule_days = [_dict_to_schedule_day(x) for x in r_sched]
                        for hsd in home_schedule_days:
                            if hsd.employee_id == emp.id and hsd.date == current_d:
                                hsd.shift = borrowed_shift
                                hsd.assigned_group = req.group.value

                        group_emps = [all_employees_map[x.id] for x in all_employees_map.values() if x.group == r.group_name]
                        validation_res = validate_schedule(home_schedule_days, group_emps)

                        # Validera mot hårda regler (dygnsvila, veckovila, vetos) för medarbetaren
                        has_hard_error = any(
                            err.severity == "hard" and err.employee_id == emp.id
                            for err in validation_res.errors
                        )

                        if not has_hard_error:
                            # Inlåning lyckades! Spara i hem-schemat
                            sd_dict["shift"] = borrowed_shift.model_dump(mode="json")
                            sd_dict["assigned_group"] = req.group.value
                            r.schedule = r_sched
                            db.add(r)

                            # Lägg till i returlistan för den aktuella gruppen
                            borrowed_day = ScheduleDay(
                                date=current_d,
                                employee_id=emp.id,
                                shift=borrowed_shift,
                                assigned_group=req.group.value
                            )
                            schedule_days.append(borrowed_day)

                            # Logga beslutet
                            decisions.append(
                                f"{current_d.isoformat()}: [Inlåning] Lånat in {emp.name} från {r.group_name} till {req.group.value} för att täcka upp på {slot.upper()} (pass: {needed_shift_type.value})."
                            )

                            borrowed_candidate = emp
                            break
                    if borrowed_candidate:
                        break

                if borrowed_candidate:
                    actual_heads[(current_d, slot)] = actual_heads.get((current_d, slot), 0) + 1
                else:
                    # Kunde inte låna in någon, flagga bemanningsbrist och rekommendera vikarie
                    decisions.append(
                        f"{current_d.isoformat()}: [Bemanningsbrist] Saknas personal på {slot.upper()} i {req.group.value}. Det behövs en vikarie för att täcka upp. (Hinder för ordinarie personal: ingen tillgänglig ordinarie personal med obokad tid)"
                    )

        current_d += timedelta(days=1)

    # ── APT-pass: tilldela alla medarbetare APT om apt_date + apt_time är satt ──
    # Hämta apt_date/apt_time för denna period
    apt_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == req.group.value,
        SchedulePeriodRow.year == req.year,
        SchedulePeriodRow.month == req.month,
    )
    apt_period = (await db.execute(apt_stmt)).scalar_one_or_none()
    apt_date_str = apt_period.apt_date if apt_period else None
    apt_time_str = apt_period.apt_time if apt_period else None

    if apt_date_str and apt_time_str:
        try:
            apt_d = date.fromisoformat(apt_date_str)
            apt_start_h, apt_start_m = map(int, apt_time_str.split(":"))
            apt_end_h, apt_end_m = (apt_start_h + 2, apt_start_m + 15) if apt_start_m + 15 < 60 else (apt_start_h + 2, (apt_start_m + 15) - 60)

            # APT slutar kl. starttid + 2h15m (om inte APT-config finns)
            apt_cfg = next((c for c in shift_configs if c["shift_type"] == "APT"), None)
            if apt_cfg:
                apt_end_h, apt_end_m = map(int, apt_cfg["end_time"].split(":"))

            if period_start <= apt_d <= period_end:
                # Bygg index: employee_id → ScheduleDay på apt_d
                apt_sched_idx: dict[str, int] = {}
                for i, sd in enumerate(schedule_days):
                    if isinstance(sd.date, date):
                        sd_date = sd.date
                    else:
                        sd_date = date.fromisoformat(str(sd.date))
                    if sd_date == apt_d:
                        apt_sched_idx[sd.employee_id] = i

                for emp in employees:
                    # Hoppa över sjuka och semestrar — men inte övrig frånvaro
                    skip_abs = {AbsenceType.SJUK, AbsenceType.SEM}
                    has_blocking_absence = any(
                        a.date == apt_d and a.absence_type in skip_abs
                        for a in emp.absences
                    )
                    if has_blocking_absence:
                        continue

                    # Bygg APT-shift
                    apt_shift = Shift(
                        shift_type=ShiftType.APT,
                        segments=[ShiftSegment(
                            start_time=datetime(apt_d.year, apt_d.month, apt_d.day, apt_start_h, apt_start_m, tzinfo=STOCKHOLM),
                            end_time=datetime(apt_d.year, apt_d.month, apt_d.day, apt_end_h, apt_end_m, tzinfo=STOCKHOLM),
                        )],
                    )

                    if emp.id in apt_sched_idx:
                        # Ersätt befintlig dag med APT (om inte sjuk/sem)
                        schedule_days[apt_sched_idx[emp.id]] = ScheduleDay(
                            date=apt_d,
                            employee_id=emp.id,
                            shift=apt_shift,
                        )
                    else:
                        # Helgarbetare eller personal utan dag — lägg till ny dag
                        schedule_days.append(ScheduleDay(
                            date=apt_d,
                            employee_id=emp.id,
                            shift=apt_shift,
                        ))

                decisions.append(
                    f"{apt_d.isoformat()}: [APT] APT-pass tilldelat alla medarbetare i {req.group.value} kl. {apt_time_str}."
                )
        except Exception as exc:
            decisions.append(f"[APT] Kunde inte tilldela APT-pass: {exc}")

    # Spara till databasen (upsert) — Spara ENDAST den egna gruppens dagar i periodens schedule-fält!
    save_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == req.group.value,
        SchedulePeriodRow.year == req.year,
        SchedulePeriodRow.month == req.month,
    )
    save_result = await db.execute(save_stmt)
    period_row = save_result.scalar_one_or_none()

    own_serialized = [
        _schedule_day_to_dict(sd) 
        for sd in schedule_days 
        if all_employees_map.get(sd.employee_id) and all_employees_map[sd.employee_id].group == req.group.value
    ]

    stats["decisions"] = decisions

    # Bygg en tidsstämplad loggrad med planerarens namn
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    gen_log = f"[{timestamp_str}] Schema genererat av {current_user.full_name or current_user.username}."

    current_decisions = list(period_row.decisions or []) if period_row else []
    current_decisions.append(gen_log)
    for d_msg in decisions:
        current_decisions.append(d_msg)

    if period_row:
        period_row.schedule = own_serialized
        period_row.decisions = current_decisions
        period_row.phase = "correction"
    else:
        period_row = SchedulePeriodRow(
            group_name=req.group.value,
            year=req.year,
            month=req.month,
            phase="correction",
            schedule=own_serialized,
            decisions=current_decisions,
        )
        db.add(period_row)

    await db.commit()

    validation: ValidationResult = stats.pop("validation")

    return GenerateResponse(
        schedule_days=schedule_days,
        validation=validation,
        stats=stats,
        phase="correction",
        decisions=_parse_decisions(decisions),
    )


@router.post("/schedule/{group}/{year}/{month}/update-day", response_model=UpdateScheduleDayResponse)
async def update_schedule_day(
    group: str, year: int, month: int,
    req: UpdateScheduleDayRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    if current_user.username.startswith("demo_"):
        group = f"Granbacken ({current_user.username})"

    # 1. Hämta medarbetaren för att verifiera existens och få fullständigt namn
    emp_stmt = select(EmployeeRow).where(EmployeeRow.id == req.employee_id)
    emp_row = (await db.execute(emp_stmt)).scalar_one_or_none()
    if not emp_row:
        raise HTTPException(status_code=404, detail="Medarbetaren hittades inte.")

    # 2. Hämta schemaperioden
    stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name == group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    period_row = (await db.execute(stmt)).scalar_one_or_none()

    # 3. Kontrollera om perioden är attesterad (låst)
    if period_row and period_row.phase == "attested":
        raise HTTPException(status_code=400, detail="Perioden är attesterad och kan inte ändras.")

    # 4. Konstruera Shift eller Absence
    d = date.fromisoformat(req.date)
    shift_obj = None
    absence_obj = None

    if req.absence_type:
        absence_obj = Absence(date=d, absence_type=AbsenceType(req.absence_type))
    elif req.shift_type:
        stype = ShiftType(req.shift_type)
        
        # Hämta passtider (configs) för att veta standardtider om de saknas i förfrågan
        cfg_stmt = select(ShiftConfigRow).where(
            (ShiftConfigRow.group_name == group) | ShiftConfigRow.group_name.is_(None)
        )
        cfg_rows = (await db.execute(cfg_stmt)).scalars().all()
        seen: dict[str, dict] = {}
        for r in sorted(cfg_rows, key=lambda x: (x.group_name is None)):
            seen[r.shift_type] = {"shift_type": r.shift_type, "start_time": r.start_time, "end_time": r.end_time}
        templates = _build_templates(list(seen.values()))

        start_t = None
        end_t = None

        if req.start_time and req.end_time:
            sh, sm = map(int, req.start_time.split(":"))
            eh, em = map(int, req.end_time.split(":"))
            from datetime import time as dt_time
            start_t = dt_time(sh, sm)
            end_t = dt_time(eh, em)
        else:
            if stype != ShiftType.DELAD_TUR:
                from datetime import time as dt_time
                start_t, end_t = templates.get(stype, (dt_time(7, 0), dt_time(16, 0)))

        # Bygg segment
        if stype == ShiftType.DELAD_TUR:
            fm_s, fm_e = _DELAD_TUR_FM
            kval_s, kval_e = _DELAD_TUR_KVAL
            segments = [
                ShiftSegment(
                    start_time=datetime(d.year, d.month, d.day, fm_s.hour, fm_s.minute, tzinfo=STOCKHOLM),
                    end_time=datetime(d.year, d.month, d.day, fm_e.hour, fm_e.minute, tzinfo=STOCKHOLM),
                ),
                ShiftSegment(
                    start_time=datetime(d.year, d.month, d.day, kval_s.hour, kval_s.minute, tzinfo=STOCKHOLM),
                    end_time=datetime(d.year, d.month, d.day, kval_e.hour, kval_e.minute, tzinfo=STOCKHOLM),
                ),
            ]
        else:
            start_dt = datetime(d.year, d.month, d.day, start_t.hour, start_t.minute, tzinfo=STOCKHOLM)
            if stype == ShiftType.NATT:
                next_day = d + timedelta(days=1)
                end_dt = datetime(next_day.year, next_day.month, next_day.day, end_t.hour, end_t.minute, tzinfo=STOCKHOLM)
            else:
                end_dt = datetime(d.year, d.month, d.day, end_t.hour, end_t.minute, tzinfo=STOCKHOLM)
            segments = [ShiftSegment(start_time=start_dt, end_time=end_dt)]

        shift_obj = Shift(
            shift_type=stype,
            segments=segments,
            is_unbooked=(stype == ShiftType.OBOKAD),
            note=req.note
        )

    # 5. Skapa den nya dagen
    new_day = ScheduleDay(
        date=d,
        employee_id=req.employee_id,
        shift=shift_obj,
        absence=absence_obj,
        assigned_group=None,
        note=req.note or None,
    )
    new_day_dict = _schedule_day_to_dict(new_day)

    # 6. Spara i period_row
    schedule_list = list(period_row.schedule or []) if period_row else []
    found_idx = -1
    for idx, sd_dict in enumerate(schedule_list):
        if sd_dict.get("employee_id") == req.employee_id and sd_dict.get("date") == req.date:
            found_idx = idx
            break

    if found_idx >= 0:
        schedule_list[found_idx] = new_day_dict
    else:
        schedule_list.append(new_day_dict)

    # Skapa tidsstämplad audit logg
    timestamp_str = datetime.now(STOCKHOLM).strftime("%Y-%m-%d %H:%M")
    editor_name = current_user.full_name or current_user.username
    employee_name = emp_row.name
    
    change_desc = ""
    if absence_obj:
        absence_label = {
            "sem": "Semester", "FL": "Föräldraledighet", "TJL": "Tjänsteledighet", 
            "sjuk": "Sjukskrivning", "VAB": "VAB", "KOM": "Kompledig", "STU": "Studieledighet"
        }.get(absence_obj.absence_type.value, absence_obj.absence_type.value)
        change_desc = f"frånvaro ({absence_label})"
    elif shift_obj:
        shift_label = {
            "dag_tidig": "Dag tidig (06:45)", "dag": "Dag", "kval_kort": "Kväll kort", 
            "kval_lang": "Kväll lång", "delad_tur": "Delad tur", "natt": "Natt", 
            "obokad": "Obokad", "APT": "APT", "kontorstid": "Kontorstid", "planeringstid": "Planeringstid"
        }.get(shift_obj.shift_type.value, shift_obj.shift_type.value)
        
        if req.start_time and req.end_time:
            change_desc = f"pass {shift_label} ({req.start_time}–{req.end_time})"
        else:
            change_desc = f"pass {shift_label}"
    else:
        change_desc = "Ledig"

    log_entry = f"[{timestamp_str}] [Manuell ändring] {editor_name} ändrade passet för {employee_name} den {req.date} till {change_desc}."

    if not period_row:
        period_row = SchedulePeriodRow(
            group_name=group,
            year=year,
            month=month,
            phase="correction",
            schedule=schedule_list,
            decisions=[log_entry]
        )
        db.add(period_row)
    else:
        period_row.schedule = schedule_list
        current_decisions = list(period_row.decisions or [])
        current_decisions.append(log_entry)
        period_row.decisions = current_decisions

    await db.commit()

    # 7. Kör validering för att ge omedelbar feedback
    # Hämta alla anställda i gruppen
    emp_stmt = select(EmployeeRow).where(EmployeeRow.group_name == group)
    emp_rows = (await db.execute(emp_stmt)).scalars().all()
    employees = [_row_to_employee(r) for r in emp_rows]

    # Hämta bemanningskrav
    krav_stmt = select(BemanningskravRow).where(
        BemanningskravRow.group_name == group,
        BemanningskravRow.year == year,
        BemanningskravRow.month == month,
    )
    krav_row = (await db.execute(krav_stmt)).scalar_one_or_none()
    
    krav = []
    if krav_row and krav_row.requirements:
        krav = [
            Bemanningskrav(
                group=Group(k["group"]),
                date=date.fromisoformat(k["date"]),
                fm_heads=k.get("fm_heads", 2),
                em_heads=k.get("em_heads", 0),
                kval_heads=k.get("kval_heads", 2),
                natt_heads=k.get("natt_heads", 0),
            )
            for k in krav_row.requirements
        ]
    else:
        # Fallback på standardbehov via template eller default
        tmpl_row = (await db.execute(
            select(StaffingTemplateRow).where(StaffingTemplateRow.group_name == group)
        )).scalar_one_or_none()
        if tmpl_row and tmpl_row.per_weekday:
            from app.routers.staffing import DayKrav, StaffingTemplate, _krav_from_template
            tmpl = StaffingTemplate(
                group_name=group,
                per_weekday=[DayKrav(**d) for d in tmpl_row.per_weekday],
            )
            krav = _krav_from_template(tmpl, Group(group), year, month)
        else:
            krav = _default_krav(Group(group), year, month)

    own_days = [_dict_to_schedule_day(sd) for sd in period_row.schedule]

    # Hämta inlånad personal
    other_stmt = select(SchedulePeriodRow).where(
        SchedulePeriodRow.group_name != group,
        SchedulePeriodRow.year == year,
        SchedulePeriodRow.month == month,
    )
    other_result = await db.execute(other_stmt)
    other_rows = other_result.scalars().all()

    borrowed_days = []
    for r in other_rows:
        if not r.schedule:
            continue
        for sd_dict in r.schedule:
            sd = _dict_to_schedule_day(sd_dict)
            if sd.assigned_group == group:
                borrowed_days.append(sd)

    full_schedule = own_days + borrowed_days
    validation_res = validate_schedule(full_schedule, employees, krav)

    return UpdateScheduleDayResponse(
        schedule=full_schedule,
        decisions=_parse_decisions(period_row.decisions),
        validation=validation_res
    )
