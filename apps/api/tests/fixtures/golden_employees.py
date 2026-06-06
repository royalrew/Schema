# -*- coding: utf-8 -*-
"""
Golden dataset: realistiska testdata för Töreboda hemvård.

Fördelning:
  NORRA      8 st  — verkliga namn från Jimmy's grupp
  SODRA     10 st  — något större grupp
  OSTRA     10 st  — något större grupp
  CENTRUM_1  8 st
  CENTRUM_2  8 st
  CENTRUM_3  8 st
  MOHOLM     8 st
  NATTEN     4 st  — nattgruppen, enbart NATT-kontrakt
"""

from datetime import date, timedelta
from app.engine.schemas import Employee, ContractType, Group, Absence, AbsenceType

def _absence_range(start: date, end: date, absence_type: AbsenceType) -> list[Absence]:
    result = []
    current = start
    while current <= end:
        result.append(Absence(date=current, absence_type=absence_type))
        current += timedelta(days=1)
    return result


def _e(
    num: int,
    name: str,
    contract_type: ContractType,
    group: Group,
    absences: list[Absence] | None = None,
    wishes: list[date] | None = None,
    vetos: list[date] | None = None,
) -> Employee:
    return Employee(
        id=f"EMP_{num:03d}",
        name=name,
        contract_type=contract_type,
        group=group,
        absences=absences or [],
        wishes=wishes or [],
        vetos=vetos or [],
    )


# ---------------------------------------------------------------------------
# NORRA (EMP_001–EMP_008) — verkliga namn
# Jimmy: VARIERANDE, Elin: DAGTID, Jack: KVAL, övriga: VARIERANDE
# ---------------------------------------------------------------------------
_NORRA = [
    _e(1,  "Jimmy Berndtsson", ContractType.VARIERANDE, Group.NORRA),
    _e(2,  "Elin",     ContractType.DAGTID,     Group.NORRA),
    _e(3,  "Josefin",  ContractType.VARIERANDE, Group.NORRA),
    _e(4,  "Jack",     ContractType.KVAL,        Group.NORRA),
    _e(5,  "Joachim",  ContractType.VARIERANDE, Group.NORRA),
    _e(6,  "Sawsan",   ContractType.VARIERANDE, Group.NORRA),
    _e(7,  "Hassan",   ContractType.HELG_LOR_MAN, Group.NORRA),
    _e(8,  "Vikarie",  ContractType.VIKARIE, Group.NORRA),
]

# ---------------------------------------------------------------------------
# SODRA (EMP_009–EMP_018) — lite större grupp (~10)
# ---------------------------------------------------------------------------
_SODRA = [
    _e(9,  "Anna Svensson",      ContractType.VARIERANDE,   Group.SODRA),
    _e(10, "Maria Johansson",    ContractType.VARIERANDE,   Group.SODRA),
    _e(11, "Sara Nilsson",       ContractType.VARIERANDE,   Group.SODRA),
    _e(12, "Lena Karlsson",      ContractType.VARIERANDE,   Group.SODRA),
    _e(13, "Karin Larsson",      ContractType.VARIERANDE,   Group.SODRA),
    _e(14, "Emma Eriksson",      ContractType.VARIERANDE,   Group.SODRA),
    _e(15, "Sofia Persson",      ContractType.VARIERANDE,   Group.SODRA),
    _e(16, "Maja Gustafsson",    ContractType.DAGTID,       Group.SODRA),
    _e(17, "Helena Lindberg",    ContractType.KVAL,         Group.SODRA),
    _e(18, "Kristina Bengtsson", ContractType.HELG_FRE_SON, Group.SODRA),
]

# ---------------------------------------------------------------------------
# OSTRA (EMP_019–EMP_028) — lite större grupp (~10)
# ---------------------------------------------------------------------------
_OSTRA = [
    _e(19, "Eva Magnusson",      ContractType.VARIERANDE,   Group.OSTRA),
    _e(20, "Birgitta Lindqvist", ContractType.VARIERANDE,   Group.OSTRA),
    _e(21, "Gunilla Lindgren",   ContractType.VARIERANDE,   Group.OSTRA),
    _e(22, "Åsa Axelsson",       ContractType.VARIERANDE,   Group.OSTRA),
    _e(23, "Annika Berg",        ContractType.VARIERANDE,   Group.OSTRA),
    _e(24, "Camilla Holm",       ContractType.VARIERANDE,   Group.OSTRA),
    _e(25, "Susanna Nyström",    ContractType.VARIERANDE,   Group.OSTRA),
    _e(26, "Jenny Lundgren",     ContractType.DAGTID,       Group.OSTRA),
    _e(27, "Malin Söderberg",    ContractType.KVAL,         Group.OSTRA),
    _e(28, "Therese Björk",      ContractType.HELG_FRE_SON, Group.OSTRA),
]

# ---------------------------------------------------------------------------
# CENTRUM_1 (EMP_029–EMP_036)
# ---------------------------------------------------------------------------
_CENTRUM_1 = [
    _e(29, "Carina Andreasson",    ContractType.VARIERANDE,   Group.CENTRUM_1),
    _e(30, "Ulla Nordin",          ContractType.VARIERANDE,   Group.CENTRUM_1),
    _e(31, "Barbro Fransson",      ContractType.VARIERANDE,   Group.CENTRUM_1),
    _e(32, "Marianne Wikström",    ContractType.VARIERANDE,   Group.CENTRUM_1),
    _e(33, "Britt-Marie Sandberg", ContractType.VARIERANDE,   Group.CENTRUM_1),
    _e(34, "Inger Håkansson",      ContractType.DAGTID,       Group.CENTRUM_1),
    _e(35, "Sigrid Björklund",     ContractType.KVAL,         Group.CENTRUM_1),
    _e(36, "Margareta Engström",   ContractType.HELG_FRE_SON, Group.CENTRUM_1),
]

# ---------------------------------------------------------------------------
# CENTRUM_2 (EMP_037–EMP_044)
# ---------------------------------------------------------------------------
_CENTRUM_2 = [
    _e(37, "Astrid Brogren",     ContractType.VARIERANDE,   Group.CENTRUM_2),
    _e(38, "Viveka Carlsson",    ContractType.VARIERANDE,   Group.CENTRUM_2),
    _e(39, "Felicia Nordström",  ContractType.VARIERANDE,   Group.CENTRUM_2),
    _e(40, "Amanda Björnsson",   ContractType.VARIERANDE,   Group.CENTRUM_2),
    _e(41, "Frida Eliasson",     ContractType.VARIERANDE,   Group.CENTRUM_2),
    _e(42, "Anders Eriksson",    ContractType.DAGTID,       Group.CENTRUM_2),
    _e(43, "Matilda Grantham",   ContractType.KVAL,         Group.CENTRUM_2),
    _e(44, "Josefin Persson",    ContractType.HELG_FRE_SON, Group.CENTRUM_2),
]

# ---------------------------------------------------------------------------
# CENTRUM_3 (EMP_045–EMP_052)
# ---------------------------------------------------------------------------
_CENTRUM_3 = [
    _e(45, "Lisa Fransson",    ContractType.VARIERANDE,   Group.CENTRUM_3),
    _e(46, "Julia Hedlund",    ContractType.VARIERANDE,   Group.CENTRUM_3),
    _e(47, "Alva Sjöström",    ContractType.VARIERANDE,   Group.CENTRUM_3),
    _e(48, "Stina Hagberg",    ContractType.VARIERANDE,   Group.CENTRUM_3),
    _e(49, "Louise Almqvist",  ContractType.VARIERANDE,   Group.CENTRUM_3),
    _e(50, "Petra Martinsson", ContractType.DAGTID,       Group.CENTRUM_3),
    _e(51, "Henrik Lindqvist", ContractType.KVAL,         Group.CENTRUM_3),
    _e(52, "Peter Axelsson",   ContractType.HELG_FRE_SON, Group.CENTRUM_3),
]

# ---------------------------------------------------------------------------
# MOHOLM (EMP_053–EMP_060)
# ---------------------------------------------------------------------------
_MOHOLM = [
    _e(53, "Niklas Holm",        ContractType.VARIERANDE,   Group.MOHOLM),
    _e(54, "Andreas Lindström",  ContractType.VARIERANDE,   Group.MOHOLM),
    _e(55, "Karl Lund",          ContractType.VARIERANDE,   Group.MOHOLM),
    _e(56, "Gustav Lundgren",    ContractType.VARIERANDE,   Group.MOHOLM),
    _e(57, "Oscar Lindahl",      ContractType.VARIERANDE,   Group.MOHOLM),
    _e(58, "Filip Nyström",      ContractType.DAGTID,       Group.MOHOLM),
    _e(59, "Simon Ericsson",     ContractType.KVAL,         Group.MOHOLM),
    _e(60, "Jonas Pettersson",   ContractType.HELG_FRE_SON, Group.MOHOLM),
]

# ---------------------------------------------------------------------------
# NATTEN (EMP_061–EMP_064) — nattgruppen, enbart NATT-kontrakt
# ---------------------------------------------------------------------------
_NATTEN = [
    _e(61, "Lars Johansson",   ContractType.NATT, Group.NATTEN),
    _e(62, "Johan Karlsson",   ContractType.NATT, Group.NATTEN),
    _e(63, "Erik Nilsson",     ContractType.NATT, Group.NATTEN),
    _e(64, "Patrik Bergström", ContractType.NATT, Group.NATTEN),
]

# ---------------------------------------------------------------------------
# Komplett lista — publicerad API
# ---------------------------------------------------------------------------
GOLDEN_EMPLOYEES: list[Employee] = (
    _NORRA + _SODRA + _OSTRA + _CENTRUM_1 + _CENTRUM_2 + _CENTRUM_3 + _MOHOLM + _NATTEN
)

_EXPECTED = 8 + 10 + 10 + 8 + 8 + 8 + 8 + 4  # = 64
assert len(GOLDEN_EMPLOYEES) == _EXPECTED, f"Förväntar {_EXPECTED} anställda, fick {len(GOLDEN_EMPLOYEES)}"
assert len({e.id for e in GOLDEN_EMPLOYEES}) == _EXPECTED, "Dubblerade ID:n i golden dataset!"


def get_employees_by_group(group: Group) -> list[Employee]:
    return [e for e in GOLDEN_EMPLOYEES if e.group == group]


def get_employees_by_contract(ct: ContractType) -> list[Employee]:
    return [e for e in GOLDEN_EMPLOYEES if e.contract_type == ct]


def get_employee_by_id(emp_id: str) -> Employee | None:
    return next((e for e in GOLDEN_EMPLOYEES if e.id == emp_id), None)
