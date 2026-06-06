# -*- coding: utf-8 -*-
"""
Router för att initiera Demo-läge (Sandlåda) med automatisk dataseeding.
"""
import uuid
import secrets
import calendar
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import UserRow, EmployeeRow, BemanningskravRow, SchedulePeriodRow
from app.auth_utils import hash_password, create_access_token

router = APIRouter(prefix="/api/demo", tags=["demo"])

STOCKHOLM = ZoneInfo("Europe/Stockholm")


def _generate_demo_employees(group_name: str, rand_suffix: str) -> list[EmployeeRow]:
    """Genererar 8 realistiska medarbetare för demo-gruppen."""
    # Karin Nilsson (Natt) har semester 15-21 juni
    karin_absences = []
    for d in range(15, 22):
        karin_absences.append({"date": f"2026-06-{str(d).zfill(2)}", "absence_type": "sem"})

    # Sofia Holm (Helg Lör-Mån) har barn varannan vecka (mjukt krav)
    sofia_constraints = [
        {
            "id": str(uuid.uuid4()),
            "constraint_type": "prefer_off",
            "weekdays": [5, 6],  # lör-sön
            "week_parity": "even",
            "note": "Barn varannan vecka (jämna veckor)"
        }
    ]

    # Anders Sjöberg har veton den 12:e och 13:e juni (max 2)
    anders_vetos = ["2026-06-12", "2026-06-13"]

    employees_data = [
        {
            "id": f"demo_emp_1_{rand_suffix}",
            "name": "Elin Andersson",
            "contract_type": "varierande",
            "absences": [],
            "wishes": [],
            "vetos": [],
            "soft_constraints": [],
            "is_dagansvarig": False,
            "percentage": 1.0,
        },
        {
            "id": f"demo_emp_2_{rand_suffix}",
            "name": "Johan Berg",
            "contract_type": "dagtid",
            "absences": [],
            "wishes": [],
            "vetos": [],
            "soft_constraints": [],
            "is_dagansvarig": True,  # Endast dagtid, aldrig kväll/natt
            "percentage": 1.0,
        },
        {
            "id": f"demo_emp_3_{rand_suffix}",
            "name": "Karin Nilsson",
            "contract_type": "natt",
            "absences": karin_absences,  # Semester i mitten av månaden
            "wishes": [],
            "vetos": [],
            "soft_constraints": [],
            "is_dagansvarig": False,
            "percentage": 1.0,
        },
        {
            "id": f"demo_emp_4_{rand_suffix}",
            "name": "Lars Karlsson",
            "contract_type": "kval",
            "absences": [],
            "wishes": [],
            "vetos": [],
            "soft_constraints": [],
            "is_dagansvarig": False,
            "percentage": 0.8,
        },
        {
            "id": f"demo_emp_5_{rand_suffix}",
            "name": "Maria Lindqvist",
            "contract_type": "varierande",
            "absences": [],
            "wishes": [],
            "vetos": [],
            "soft_constraints": [],
            "is_dagansvarig": False,
            "percentage": 0.75,
        },
        {
            "id": f"demo_emp_6_{rand_suffix}",
            "name": "Anders Sjöberg",
            "contract_type": "helg_fre_son",
            "absences": [],
            "wishes": [],
            "vetos": anders_vetos,  # Veto under helgen
            "soft_constraints": [],
            "is_dagansvarig": False,
            "percentage": 1.0,
        },
        {
            "id": f"demo_emp_7_{rand_suffix}",
            "name": "Sofia Holm",
            "contract_type": "helg_lor_man",
            "absences": [],
            "wishes": [],
            "vetos": [],
            "soft_constraints": sofia_constraints,  # Önskar ledigt jämna veckor
            "is_dagansvarig": False,
            "percentage": 1.0,
        },
        {
            "id": f"demo_emp_8_{rand_suffix}",
            "name": "Erik Ekdahl",
            "contract_type": "varierande",
            "absences": [],
            "wishes": [],
            "vetos": [],
            "soft_constraints": [],
            "is_dagansvarig": False,
            "percentage": 1.0,
        },
    ]

    return [
        EmployeeRow(
            id=emp["id"],
            name=emp["name"],
            contract_type=emp["contract_type"],
            group_name=group_name,
            absences=emp["absences"],
            wishes=emp["wishes"],
            vetos=emp["vetos"],
            soft_constraints=emp["soft_constraints"],
            is_dagansvarig=emp["is_dagansvarig"],
            percentage=emp["percentage"],
        )
        for emp in employees_data
    ]


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_demo_sandbox(db: AsyncSession = Depends(get_db)):
    """
    Initierar en isolerad 7-dagars demo-sandlåda.
    Skapar användare, sådd-medarbetare och bemanningskrav för Juni 2026.
    """
    # 1. Skapa slumpmässig suffix
    rand_suffix = secrets.token_hex(4)  # 8 tecken lång hex
    username = f"demo_{rand_suffix}"
    group_name = f"Granbacken ({username})"

    # 2. Skapa användare
    dummy_password = secrets.token_urlsafe(8)
    password_hash = hash_password(dummy_password)
    
    demo_user = UserRow(
        username=username,
        password_hash=password_hash,
        role="schemaansvarig",
        full_name="Demo Planerare",
        invite_accepted=True,
    )
    db.add(demo_user)
    await db.flush()  # Genererar id för användaren

    # 3. Sådd av anställda
    employees = _generate_demo_employees(group_name, rand_suffix)
    for emp in employees:
        db.add(emp)

    # 4. Sådd av bemanningskrav för Juni 2026
    requirements = []
    _, last_day = calendar.monthrange(2026, 6)
    for d in range(1, last_day + 1):
        curr_date = date(2026, 6, d)
        is_weekend = curr_date.weekday() >= 5
        # Helger kräver 2 fm, 2 kval, 1 natt. Vardagar kräver 2 fm, 1 kval, 1 natt.
        requirements.append({
            "group": group_name,
            "date": curr_date.isoformat(),
            "fm_heads": 2,
            "em_heads": 0,
            "kval_heads": 2 if is_weekend else 1,
            "natt_heads": 1,
        })

    krav_row = BemanningskravRow(
        group_name=group_name,
        year=2026,
        month=6,
        requirements=requirements
    )
    db.add(krav_row)

    # 5. Skapa en tom schemaperiod för Juni 2026 så att gränssnittet öppnas i "wish"-fasen
    period_row = SchedulePeriodRow(
        group_name=group_name,
        year=2026,
        month=6,
        phase="wish",
        schedule=[],
        decisions=[f"[{datetime.now(STOCKHOLM).strftime('%Y-%m-%d %H:%M')}] Demomiljö skapad."]
    )
    db.add(period_row)

    # Spara till databasen
    await db.commit()

    # 6. Generera JWT token
    token = create_access_token(
        user_id=demo_user.id,
        username=demo_user.username,
        role=demo_user.role,
        employee_id=None,
    )

    # Returnera uppgifter
    expire_date = (datetime.now(STOCKHOLM) + timedelta(days=7)).isoformat()
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": username,
        "expires_at": expire_date,
        "group_name": group_name,
    }
