# -*- coding: utf-8 -*-
"""
Pydantic datamodeller för Töreboda AI-schemamotor.
Alla tidsstämplar hanteras med timezone Europe/Stockholm.
"""

import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class ContractType(str, Enum):
    """Tjänstgöringsformer med specifika veckoarbetstidsmått."""
    DAGTID       = "dagtid"        # 40h/vecka måndag-fredag
    VARIERANDE   = "varierande"    # 37h/vecka dag, kväll, helg
    KVAL         = "kval"          # 30h/vecka kväll
    HELG_FRE_MAN = "helg_fre_man"  # 26h/vecka fre-mån (Sara: "Fred-Mån")
    NATT         = "natt"          # 34.33h/vecka enbart natt
    VIKARIE      = "vikarie"       # Timvikarie, 0h/vecka, jobbar vid behov


# Kontraktsregler: veckoarbetstimmar och tillåtna veckodagar (0=mån, 6=sön)
CONTRACT_RULES: dict[str, dict] = {
    ContractType.DAGTID:       {"weekly_hours": 40.0,   "allowed_weekdays": list(range(0, 5))},
    ContractType.VARIERANDE:   {"weekly_hours": 37.0,   "allowed_weekdays": list(range(0, 7))},
    ContractType.KVAL:         {"weekly_hours": 30.0,   "allowed_weekdays": list(range(0, 7))},
    ContractType.HELG_FRE_MAN: {"weekly_hours": 26.0,   "allowed_weekdays": [4, 5, 6, 0]},   # fre=4, lör=5, sön=6, mån=0
    ContractType.NATT:         {"weekly_hours": 34.33,  "allowed_weekdays": list(range(0, 7))},
    ContractType.VIKARIE:      {"weekly_hours": 0.0,    "allowed_weekdays": list(range(0, 7))},
}

class Group(str):
    """Hemtjänstgrupper i Töreboda kommun, stöder även dynamiska sandlådegrupper."""
    @property
    def value(self) -> str:
        return self

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_after_validator_function(
            cls,
            core_schema.str_schema()
        )

Group.NORRA = Group("Norra")
Group.SODRA = Group("Södra")
Group.OSTRA = Group("Östra")
Group.CENTRUM_1 = Group("Centrum 1")
Group.CENTRUM_2 = Group("Centrum 2")
Group.CENTRUM_3 = Group("Centrum 3")
Group.MOHOLM = Group("Moholm")
Group.NATTEN = Group("Natten")





class AbsenceType(str, Enum):
    """Typer av planerad frånvaro."""
    SEM = "sem"    # Semester
    FL = "FL"      # Föräldraledighet
    TJL = "TJL"    # Tjänstledighet
    SJUK = "sjuk"  # Sjukskrivning (långtid)
    VAB = "VAB"    # Vård av barn
    KOM = "KOM"    # Kompledig
    STU = "STU"    # Studieledighet

class ShiftType(str, Enum):
    """Standardiserade passtyper i verksamheten."""
    DAG_TIDIG = "dag_tidig"  # Dag tidig (t.ex. 06:45 - 14:00/15:30/16:00, inkl nattrapport)
    DAG = "dag"              # Ordinarie dag (t.ex. 07:00 - 14:00/15:30/16:00)
    KVAL_KORT = "kval_kort"  # Kväll kort (t.ex. 13:45 - 20:00)
    KVAL_LANG = "kval_lang"  # Kväll lång (t.ex. 13:45 - 21:30)
    DELAD_TUR = "delad_tur"  # Delad tur (t.ex. 07:00-13:00 + 15:30-20:00/21:30)
    NATT = "natt"            # Nattpass
    OBOKAD = "obokad"        # Obokad tid (buffertfyllnad på medarbetarens kontrakt)
    APT = "APT"              # Arbetsplatsträff (t.ex. 13:45 - 16:00)
    KONTORSTID = "kontorstid"  # Kontorstid / administration (manuell, räknas ej mot bemanning)
    PLANERINGSTID = "planeringstid"  # Planeringstid (t.ex. vid överkapacitet)

class ShiftSegment(BaseModel):
    """
    Representerar ett aktivt tidsblock i ett pass.
    Används t.ex. för delade turer som har två separata tidsblock per dag.
    """
    start_time: datetime.datetime = Field(..., description="Starttid för segmentet (timezone Europe/Stockholm)")
    end_time: datetime.datetime = Field(..., description="Sluttid för segmentet (timezone Europe/Stockholm)")
    activity: Optional[ShiftType] = Field(None, description="Aktivitet för detta segment om det avviker från huvudpassets typ")

class Shift(BaseModel):
    """Ett schemalagt arbetspass."""
    shift_type: ShiftType = Field(..., description="Typ av pass")
    segments: List[ShiftSegment] = Field(..., description="Aktiva tidssegment i passet")
    is_unbooked: bool = Field(False, description="Om passet är en obokad tidsbuffert")
    note: Optional[str] = Field(None, description="Valfri notering (t.ex. APT eller orsak)")

    @property
    def total_hours(self) -> float:
        """Beräknar total arbetstid i timmar för passet (exklusive gapet i delad tur)."""
        duration = 0.0
        for segment in self.segments:
            diff = segment.end_time - segment.start_time
            duration += diff.total_seconds() / 3600.0
        return duration

class Absence(BaseModel):
    """Planerad frånvaro för en specifik dag."""
    date: datetime.date
    absence_type: AbsenceType

class WishShiftEntry(BaseModel):
    """En personalens önskade arbetstid för en specifik dag."""
    date: str                     # ISO-datum "YYYY-MM-DD"
    start_time: str | None = None  # "HH:MM" — None = ledig/ingen tur
    end_time: str | None = None    # "HH:MM"
    shift_type: str | None = None  # t.ex. "dag", "kval_kort" — None = anpassad tid
    note: str = ""


class SoftConstraint(BaseModel):
    """Mjukt återkommande krav från personens livssituation."""
    id: str = Field(..., description="Unikt ID (uuid)")
    constraint_type: str = Field(..., description="prefer_off | prefer_work | avoid")
    weekdays: List[int] = Field(default_factory=list, description="Veckodagar 0=Mån..6=Sön")
    week_parity: str = Field("all", description="all | odd | even — vilka veckor det gäller")
    note: str = Field("", description="Förklaring, t.ex. 'Barn varannan vecka'")


class Employee(BaseModel):
    """En medarbetare i hemvården."""
    id: str = Field(..., description="Unikt anställnings-id")
    name: str = Field(..., description="Fullständigt namn (maskerat i loggar vid behov)")
    contract_type: ContractType = Field(..., description="Tjänstgöringsform")
    group: Group = Field(..., description="Ordinarie hemtjänstgrupp")
    absences: List[Absence] = Field(default_factory=list, description="Registrerad frånvaro")
    wishes: List[datetime.date] = Field(default_factory=list, description="Dagar medarbetaren önskar jobba")
    vetos: List[datetime.date] = Field(default_factory=list, description="Dagar med veto (max 2 per schemaperiod)")
    soft_constraints: List[SoftConstraint] = Field(default_factory=list, description="Återkommande mjuka krav")
    wish_schedule: List[WishShiftEntry] = Field(default_factory=list, description="Önskeschema — personalens valda tider")
    is_dagansvarig: bool = Field(False, description="Dagansvarig — aldrig kväll/natt, alltid dag")
    is_planerare: bool = Field(False, description="Planerare — har prioritet på planeringstid vid överkapacitet")
    percentage: float = Field(1.0, description="Tjänstgöringsgrad (t.ex. 0.5 för 50%, 1.0 för 100%)")
    target_days_per_month: Optional[int] = Field(None, description="Önskat antal dagpass per månad (mjuk regel)")
    target_evenings_per_month: Optional[int] = Field(None, description="Önskat antal kvällspass per månad (mjuk regel)")

class ScheduleDay(BaseModel):
    """Schemaläggningen för en enskild medarbetare en specifik dag."""
    date: datetime.date
    employee_id: str
    shift: Optional[Shift] = Field(None, description="Arbetspass (om schemalagd)")
    absence: Optional[Absence] = Field(None, description="Frånvaro (om frånvarande)")
    assigned_group: Optional[Group] = Field(None, description="Gruppen där arbetspasset utförs, om annat än ordinarie grupp")

class HourlyRequirement(BaseModel):
    """Timbaserat bemanningskrav eller överkapacitetskrav."""
    start_time: str = Field(..., description="Starttid för intervallet (HH:MM)")
    end_time: str = Field(..., description="Sluttid för intervallet (HH:MM)")
    needed_heads: int = Field(..., description="Antal medarbetare som behövs under intervallet")
    prioritized_activities: List[str] = Field(
        default_factory=lambda: ["planeringstid", "kontorstid", "obokad"],
        description="Prioritetsordning för tilldelning av aktiviteter"
    )

class Bemanningskrav(BaseModel):
    """Bemanningsbehov per grupp, datum och passdel."""
    group: Group
    date: datetime.date
    fm_heads: int = Field(0, description="Behov av antal medarbetare på förmiddag (fm)")
    em_heads: int = Field(0, description="Behov av antal medarbetare på eftermiddag (em)")
    kval_heads: int = Field(0, description="Behov av antal medarbetare på kväll")
    natt_heads: int = Field(0, description="Behov av antal medarbetare på natt")
    hourly_requirements: List[HourlyRequirement] = Field(default_factory=list, description="Tim- eller intervallbaserade bemanningskrav")

class ValidationErrorDetail(BaseModel):
    """Detaljinfo om ett specifikt regelbrott."""
    rule_name: str = Field(..., description="Namnet på regeln (t.ex. dygnsvila)")
    employee_id: str = Field(..., description="Id för medarbetaren det berör")
    date: datetime.date = Field(..., description="Datum för regelbrottet")
    message: str = Field(..., description="Pedagogisk beskrivning på svenska")
    severity: str = Field("hard", description="Hård (hard) eller mjuk (soft) regel")

class ValidationResult(BaseModel):
    """Resultatet av en schemavalidering."""
    is_valid: bool = Field(..., description="Sant om inga HÅRDA regler brutits")
    errors: List[ValidationErrorDetail] = Field(default_factory=list, description="Lista på alla regelbrott")
