# -*- coding: utf-8 -*-
"""
Globalt inlåningspass för schemamotorn.

När alla grupper genererats körs detta pass EN gång över hela bilden: det lånar
deterministiskt ut OBOKAD ordinarie personal från grupper med överskott till
grupper med bemanningsbrist — men bara om motorns hårda regler (dygnsvila,
veckovila, veto m.m.) håller för den utlånade. Varje lån bär bevis i beslutsloggen.

Till skillnad från det gamla grupp-för-grupp-passet (routern schedule.py) är
resultatet oberoende av gruppordning: alla grupper är redan genererade när lånet
sker, så motorn ser "hela kommunens pussel" samtidigt.
"""

from dataclasses import dataclass, field
from datetime import date

from app.engine.schemas import (
    ScheduleDay, Employee, Bemanningskrav, ShiftType, Group,
)
from app.engine.solver import validate_schedule, _SHIFT_TO_SLOT
from app.engine.generator import _make_shift

# Vilken passtyp som används för att täcka respektive slot vid inlåning.
_SLOT_TO_SHIFT: dict[str, ShiftType] = {
    "fm":   ShiftType.DAG,
    "em":   ShiftType.DELAD_TUR,
    "kval": ShiftType.KVAL_LANG,
    "natt": ShiftType.NATT,
}
# Fast slot-ordning för determinism.
_SLOT_ORDER = ["fm", "em", "kval", "natt"]


@dataclass
class BorrowingResult:
    """Resultatet av det globala inlåningspasset."""
    decisions: list[str] = field(default_factory=list)          # platt global logg
    by_group: dict[str, list[str]] = field(default_factory=dict)  # gruppnamn -> rader som rör gruppen
    loans: int = 0
    unfilled: int = 0
    unfilled_by_group: dict[str, int] = field(default_factory=dict)

    def _note(self, group: str, text: str) -> None:
        self.by_group.setdefault(group, []).append(text)


def _home_group(sd: ScheduleDay, employees_by_id: dict[str, Employee]) -> str | None:
    emp = employees_by_id.get(sd.employee_id)
    return str(emp.group) if emp else None


def _serving_group(sd: ScheduleDay, employees_by_id: dict[str, Employee]) -> str | None:
    """Gruppen passet faktiskt bemannar (assigned_group om inlånad, annars hemgrupp)."""
    if sd.assigned_group is not None:
        return str(sd.assigned_group)
    return _home_group(sd, employees_by_id)


def run_global_borrowing(
    all_days: list[ScheduleDay],
    employees_by_id: dict[str, Employee],
    krav: list[Bemanningskrav],
    templates_by_group: dict[str, dict],
    default_templates: dict,
) -> BorrowingResult:
    """
    Lånar deterministiskt ut OBOKAD personal mellan grupper för att täcka brist.

    Muterar ``all_days`` in-place (donatorers OBOKAD-dag blir ett bemanningspass
    med ``assigned_group`` satt till mottagargruppen). Returnerar en
    :class:`BorrowingResult` med bevis-rader, antal lån och kvarstående brister.

    Determinism: brister processas i ordning (datum, grupp, slot) och donatorer
    väljs på (lägst ackumulerad arbetstid, emp.id) — oberoende av indataordning.
    """
    result = BorrowingResult()

    # Faktiska tillsatta huvuden per (serving_group, date, slot).
    head_count: dict[tuple[str, date, str], int] = {}
    for sd in all_days:
        if not sd.shift or sd.shift.is_unbooked:
            continue
        slot = _SHIFT_TO_SLOT.get(sd.shift.shift_type)
        if slot is None:
            continue
        g = _serving_group(sd, employees_by_id)
        if g is None:
            continue
        head_count[(g, sd.date, slot)] = head_count.get((g, sd.date, slot), 0) + 1

    # Ackumulerad arbetstid per anställd (rättvist donatorval — lägst först).
    worked_hours: dict[str, float] = {}
    for sd in all_days:
        if sd.shift and not sd.shift.is_unbooked:
            worked_hours[sd.employee_id] = worked_hours.get(sd.employee_id, 0.0) + sd.shift.total_hours

    # Hemgrupp -> dess dagar (samma objektreferenser som i all_days) för validering.
    days_by_group: dict[str, list[ScheduleDay]] = {}
    for sd in all_days:
        hg = _home_group(sd, employees_by_id)
        if hg is not None:
            days_by_group.setdefault(hg, []).append(sd)

    emps_by_group: dict[str, list[Employee]] = {}
    for emp in employees_by_id.values():
        emps_by_group.setdefault(str(emp.group), []).append(emp)

    # Brister i deterministisk ordning.
    krav_sorted = sorted(krav, key=lambda k: (k.date, str(k.group)))

    for k in krav_sorted:
        g = str(k.group)
        needs = {"fm": k.fm_heads, "em": k.em_heads, "kval": k.kval_heads, "natt": k.natt_heads}
        templates = templates_by_group.get(g, default_templates)

        for slot in _SLOT_ORDER:
            shortage = needs.get(slot, 0) - head_count.get((g, k.date, slot), 0)
            if shortage <= 0:
                continue
            needed_shift_type = _SLOT_TO_SHIFT.get(slot)
            if needed_shift_type is None:
                continue

            while shortage > 0:
                # Kandidater: OBOKAD-dagar i ANDRA grupper detta datum, ej redan utlånade.
                candidates = [
                    sd for sd in all_days
                    if sd.date == k.date
                    and sd.assigned_group is None
                    and sd.shift and sd.shift.is_unbooked
                    and (_home_group(sd, employees_by_id) not in (None, g))
                ]
                candidates.sort(key=lambda s: (worked_hours.get(s.employee_id, 0.0), s.employee_id))

                lent_emp = None
                for cand in candidates:
                    emp = employees_by_id.get(cand.employee_id)
                    if not emp:
                        continue
                    donor_group = str(emp.group)

                    # Föreslå inlåningspasset med mottagargruppens passtider.
                    borrowed_shift = _make_shift(needed_shift_type, k.date, templates, employee=emp)
                    prev_shift, prev_assigned = cand.shift, cand.assigned_group
                    cand.shift = borrowed_shift
                    cand.assigned_group = k.group

                    # Validera donatorns hemgrupp — inget NYTT hårt regelbrott för den anställda.
                    res = validate_schedule(days_by_group.get(donor_group, []), emps_by_group.get(donor_group, []))
                    has_hard = any(e.severity == "hard" and e.employee_id == emp.id for e in res.errors)
                    if has_hard:
                        cand.shift, cand.assigned_group = prev_shift, prev_assigned
                        continue

                    # Lånet godkänt.
                    worked_hours[emp.id] = worked_hours.get(emp.id, 0.0) + borrowed_shift.total_hours
                    head_count[(g, k.date, slot)] = head_count.get((g, k.date, slot), 0) + 1
                    result.loans += 1
                    ds = k.date.isoformat()
                    in_text = (
                        f"{ds}: [Inlåning] Lånat in {emp.name} från {donor_group} för att täcka "
                        f"{slot.upper()} (pass: {needed_shift_type.value}; validerat: 0 hårda regelbrott)."
                    )
                    out_text = (
                        f"{ds}: [Utlåning] {emp.name} lånas ut till {g} för att täcka {slot.upper()} "
                        f"(validerat: 0 hårda regelbrott)."
                    )
                    result.decisions.append(in_text)
                    result._note(g, in_text)
                    result._note(donor_group, out_text)
                    lent_emp = emp
                    break

                if lent_emp is None:
                    # Ingen kunde lånas in — kvarstående brist.
                    ds = k.date.isoformat()
                    short_text = (
                        f"{ds}: [Bemanningsbrist] Saknas personal på {slot.upper()} i {g}. "
                        f"Ingen ordinarie personal med obokad tid kunde lånas in — vikarie behövs."
                    )
                    result.decisions.append(short_text)
                    result._note(g, short_text)
                    result.unfilled += 1
                    result.unfilled_by_group[g] = result.unfilled_by_group.get(g, 0) + 1
                    break  # meningslöst att försöka fler huvuden för samma slot/dag

                shortage -= 1

    return result
