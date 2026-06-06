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
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
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
