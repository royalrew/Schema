# -*- coding: utf-8 -*-
"""
Huvudfil för FastAPI Backend - Töreboda AI-schemamotor.
"""

from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.engine.schemas import ScheduleDay, Employee, ValidationResult
from app.engine.solver import validate_schedule
from app.database import create_tables
from app.routers import employees, staffing, schedule as schedule_router, shift_configs as shift_configs_router, export as export_router, ai_analyze as ai_router, balances as balances_router, debug as debug_router, autocorrect as autocorrect_router, auth as auth_router, groups as groups_router
from app.routers import chat as chat_router
from app.routers import rag as rag_router
from app.routers import demo as demo_router
from app.routers import organization as org_router


async def cleanup_old_demo_data():
    """Raderar alla demogrupper och demokonton som skapades för mer än 7 dagar sedan."""
    from app.database import AsyncSessionLocal
    from app.db_models import UserRow, EmployeeRow, SchedulePeriodRow, BemanningskravRow, EmployeeBalanceRow
    from sqlalchemy import select, delete
    from datetime import datetime, timedelta, timezone
    
    # Skapa en naive UTC datetime som matchar databasens naiva timestamps
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
    
    async with AsyncSessionLocal() as db:
        try:
            # Hämta gamla demo-användare
            result = await db.execute(
                select(UserRow).where(
                    UserRow.username.like("demo_%"),
                    UserRow.created_at < cutoff
                )
            )
            old_users = result.scalars().all()
            if not old_users:
                return
                
            for u in old_users:
                group_name = f"Granbacken ({u.username})"
                
                # 1. Hämta alla anställdas id för att kunna ta bort deras tidsaldon
                emp_result = await db.execute(select(EmployeeRow.id).where(EmployeeRow.group_name == group_name))
                emp_ids = emp_result.scalars().all()
                if emp_ids:
                    await db.execute(delete(EmployeeBalanceRow).where(EmployeeBalanceRow.employee_id.in_(emp_ids)))
                
                # 2. Radera personal
                await db.execute(delete(EmployeeRow).where(EmployeeRow.group_name == group_name))
                # 3. Radera schemaperioder
                await db.execute(delete(SchedulePeriodRow).where(SchedulePeriodRow.group_name == group_name))
                # 4. Radera bemanningskrav
                await db.execute(delete(BemanningskravRow).where(BemanningskravRow.group_name == group_name))
                # 5. Radera användaren själv
                await db.delete(u)
                
            await db.commit()
            print(f"[DEMO CLEANUP] Rensade {len(old_users)} gamla demo-konton och tillhörande data.")
        except Exception as e:
            await db.rollback()
            print(f"[DEMO CLEANUP] Fel vid rensning av demo-data: {e}")


async def create_default_admin():
    """Skapar en superadmin om det saknas och miljövariabler finns."""
    from app.database import AsyncSessionLocal
    from app.db_models import UserRow
    from app.auth_utils import hash_password
    from sqlalchemy import select
    import os
    
    admin_user = os.getenv("TEST_ADMIN_USER")
    admin_pass = os.getenv("TEST_ADMIN_PASS")
    
    if not admin_user or not admin_pass:
        print("[INIT] TEST_ADMIN_USER eller TEST_ADMIN_PASS saknas i miljövariablerna.")
        return
        
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(UserRow).where(UserRow.username == admin_user))
            existing = result.scalar_one_or_none()
            
            if not existing:
                row = UserRow(
                    username=admin_user,
                    full_name="Sara Arnham",  # Fastställt till Sara Arnham istället för organisationens namn
                    password_hash=hash_password(admin_pass),
                    role="superadmin",
                    invite_accepted=True,
                )
                db.add(row)
                await db.commit()
                print(f"[INIT] Skapade standard-superadmin: {admin_user}")
            else:
                # Fixa om full_name blivit satt till organisationens namn (Töreboda Hemvård) av misstag
                org_name = os.getenv("ORGANIZATION_NAME")
                if org_name and existing.full_name == org_name:
                    existing.full_name = "Sara Arnham"
                    await db.commit()
                    print(f"[INIT] Rättade till full_name till 'Sara Arnham' för superadmin.")

                from app.auth_utils import verify_password
                if not verify_password(admin_pass, existing.password_hash):
                    existing.password_hash = hash_password(admin_pass)
                    await db.commit()
                    print(f"[INIT] Uppdaterade lösenord för superadmin: {admin_user}")
                else:
                    print(f"[INIT] Standard-superadmin '{admin_user}' finns redan och har rätt lösenord.")
        except Exception as e:
            await db.rollback()
            print(f"[INIT] Fel vid skapande av standard-superadmin: {e}")


async def seed_default_employees_if_empty():
    """Om det inte finns några medarbetare alls i databasen, ladda in standardmedarbetarna."""
    from app.database import AsyncSessionLocal
    from app.db_models import EmployeeRow
    from tests.fixtures.golden_employees import GOLDEN_EMPLOYEES
    from sqlalchemy import select, func
    
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(func.count(EmployeeRow.id)))
            count = result.scalar()
            
            if count == 0:
                print(f"[INIT] Inga medarbetare hittades. Sår databasen med {len(GOLDEN_EMPLOYEES)} medarbetare...")
                for emp in GOLDEN_EMPLOYEES:
                    row = EmployeeRow(
                        id=emp.id,
                        name=emp.name,
                        contract_type=emp.contract_type.value,
                        group_name=emp.group.value,
                        absences=[
                            {"date": a.date.isoformat(), "absence_type": a.absence_type.value}
                            for a in emp.absences
                        ],
                        wishes=[],
                        vetos=[v.isoformat() for v in emp.vetos],
                        soft_constraints=[],
                    )
                    db.add(row)
                await db.commit()
                print(f"[INIT] ✓ Sådd klar. {len(GOLDEN_EMPLOYEES)} medarbetare inlagda.")
            else:
                print(f"[INIT] Databasen innehåller redan {count} medarbetare. Hoppar över sådd.")
        except Exception as e:
            await db.rollback()
            print(f"[INIT] Fel vid sådd av standardmedarbetare: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    await create_default_admin()
    await seed_default_employees_if_empty()
    await cleanup_old_demo_data()
    yield



app = FastAPI(
    title="Töreboda AI-schemamotor API",
    description="Backend API för deterministisk schemaläggning i hemvården",
    version="1.1.0",
    lifespan=lifespan,
)

import os

_ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(employees.router)
app.include_router(staffing.router)
app.include_router(schedule_router.router)
app.include_router(shift_configs_router.router)
app.include_router(export_router.router)
app.include_router(ai_router.router)
app.include_router(balances_router.router)
app.include_router(debug_router.router)
app.include_router(autocorrect_router.router)
app.include_router(auth_router.router)
app.include_router(groups_router.router)
app.include_router(chat_router.router)
app.include_router(rag_router.router)
app.include_router(demo_router.router)
app.include_router(org_router.router)



# ── Befintliga endpoints (bevaras) ───────────────────────────────────────────

class ValidationRequest(BaseModel):
    schedule_days: List[ScheduleDay] = Field(...)
    employees: List[Employee] = Field(...)


@app.get("/api/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok", "version": "1.1.0"}


@app.post("/api/validate", response_model=ValidationResult, status_code=status.HTTP_200_OK)
async def api_validate_schedule(request: ValidationRequest) -> ValidationResult:
    try:
        return validate_schedule(request.schedule_days, request.employees)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Ett fel uppstod under schemavalideringen: {str(e)}"
        )
