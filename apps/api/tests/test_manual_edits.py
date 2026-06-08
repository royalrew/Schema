# -*- coding: utf-8 -*-
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from datetime import date

from app.db_models import EmployeeRow, SchedulePeriodRow, UserRow
from app.engine.schemas import ShiftType, AbsenceType
from app.routers.schedule import update_schedule_day, UpdateScheduleDayRequest

@pytest.mark.anyio
async def test_update_schedule_day_success_shift():
    """Verifierar att vi kan ändra en dag till ett arbetspass (t.ex. DAG) och att audit-loggen skrivs."""
    db_mock = AsyncMock()
    
    emp = EmployeeRow(id="EMP01", name="Anders Sjöberg", contract_type="dagtid", group_name="Norra")
    period = SchedulePeriodRow(
        group_name="Norra",
        year=2026,
        month=6,
        phase="correction",
        schedule=[],
        decisions=[]
    )
    
    class MockResult:
        def __init__(self, val, is_list=False):
            self.val = val
            self.is_list = is_list
        def scalar_one_or_none(self):
            return self.val
        def scalars(self):
            class ScalarResult:
                def __init__(self, val):
                    self.val = val
                def all(self):
                    return self.val if isinstance(self.val, list) else ([self.val] if self.val else [])
            return ScalarResult(self.val)
            
    # Mock db.execute responses
    async def mock_execute(stmt):
        stmt_str = str(stmt).lower()
        if "employeerow" in stmt_str or "employees" in stmt_str:
            if "where employee_id" in stmt_str or "where employees.id" in stmt_str:
                return MockResult(emp)
            else:
                return MockResult([emp], is_list=True)
        elif "scheduleperiodrow" in stmt_str or "schedule_periods" in stmt_str:
            return MockResult(period)
        elif "shiftconfigrow" in stmt_str or "shift_configs" in stmt_str:
            return MockResult([], is_list=True)
        elif "bemanningskravrow" in stmt_str or "bemanningskrav" in stmt_str:
            return MockResult(None)
        elif "staffingtemplaterow" in stmt_str or "staffing_templates" in stmt_str:
            return MockResult(None)
        return MockResult(None)
        
    db_mock.execute = mock_execute
    
    req = UpdateScheduleDayRequest(
        employee_id="EMP01",
        date="2026-06-10",
        shift_type="dag",
        absence_type=None,
        start_time="07:00",
        end_time="16:00",
        note="Manuell korrigering"
    )
    
    user = UserRow(username="sara", full_name="Sara Arnham", role="superadmin")
    
    res = await update_schedule_day(
        group="Norra",
        year=2026,
        month=6,
        req=req,
        db=db_mock,
        current_user=user
    )
    
    assert res is not None
    assert len(res.schedule) == 1
    day = res.schedule[0]
    assert day.employee_id == "EMP01"
    assert day.shift is not None
    assert day.shift.shift_type == ShiftType.DAG
    assert day.shift.note == "Manuell korrigering"
    assert len(res.decisions) == 1
    assert "Sara Arnham ändrade passet för Anders Sjöberg" in res.decisions[0]
    assert "pass Dag" in res.decisions[0]


@pytest.mark.anyio
async def test_update_schedule_day_success_absence():
    """Verifierar att vi kan ändra en dag till frånvaro (t.ex. sem)."""
    db_mock = AsyncMock()
    
    emp = EmployeeRow(id="EMP01", name="Anders Sjöberg", contract_type="dagtid", group_name="Norra")
    period = SchedulePeriodRow(
        group_name="Norra",
        year=2026,
        month=6,
        phase="correction",
        schedule=[],
        decisions=[]
    )
    
    class MockResult:
        def __init__(self, val, is_list=False):
            self.val = val
            self.is_list = is_list
        def scalar_one_or_none(self):
            return self.val
        def scalars(self):
            class ScalarResult:
                def __init__(self, val):
                    self.val = val
                def all(self):
                    return self.val if isinstance(self.val, list) else ([self.val] if self.val else [])
            return ScalarResult(self.val)
            
    async def mock_execute(stmt):
        stmt_str = str(stmt).lower()
        if "employeerow" in stmt_str or "employees" in stmt_str:
            if "where employee_id" in stmt_str or "where employees.id" in stmt_str:
                return MockResult(emp)
            else:
                return MockResult([emp], is_list=True)
        elif "scheduleperiodrow" in stmt_str or "schedule_periods" in stmt_str:
            return MockResult(period)
        elif "shiftconfigrow" in stmt_str or "shift_configs" in stmt_str:
            return MockResult([], is_list=True)
        elif "bemanningskravrow" in stmt_str or "bemanningskrav" in stmt_str:
            return MockResult(None)
        elif "staffingtemplaterow" in stmt_str or "staffing_templates" in stmt_str:
            return MockResult(None)
        return MockResult(None)
        
    db_mock.execute = mock_execute
    
    req = UpdateScheduleDayRequest(
        employee_id="EMP01",
        date="2026-06-12",
        shift_type=None,
        absence_type="sem",
        note=""
    )
    
    user = UserRow(username="sara", full_name="Sara Arnham", role="superadmin")
    
    res = await update_schedule_day(
        group="Norra",
        year=2026,
        month=6,
        req=req,
        db=db_mock,
        current_user=user
    )
    
    assert res is not None
    assert len(res.schedule) == 1
    day = res.schedule[0]
    assert day.employee_id == "EMP01"
    assert day.absence is not None
    assert day.absence.absence_type == AbsenceType.SEM
    assert "frånvaro (Semester)" in res.decisions[0]


@pytest.mark.anyio
async def test_update_schedule_day_attested_locked():
    """Verifierar att vi får 400 Bad Request om vi försöker ändra i en attesterad period."""
    db_mock = AsyncMock()
    
    emp = EmployeeRow(id="EMP01", name="Anders Sjöberg", contract_type="dagtid", group_name="Norra")
    period = SchedulePeriodRow(
        group_name="Norra",
        year=2026,
        month=6,
        phase="attested",
        schedule=[],
        decisions=[]
    )
    
    class MockResult:
        def __init__(self, val):
            self.val = val
        def scalar_one_or_none(self):
            return self.val
            
    async def mock_execute(stmt):
        stmt_str = str(stmt).lower()
        if "employeerow" in stmt_str or "employees" in stmt_str:
            return MockResult(emp)
        elif "scheduleperiodrow" in stmt_str or "schedule_periods" in stmt_str:
            return MockResult(period)
        return MockResult(None)
        
    db_mock.execute = mock_execute
    
    req = UpdateScheduleDayRequest(
        employee_id="EMP01",
        date="2026-06-10",
        shift_type="dag",
    )
    
    user = UserRow(username="sara", full_name="Sara Arnham", role="superadmin")
    
    with pytest.raises(HTTPException) as exc_info:
        await update_schedule_day(
            group="Norra",
            year=2026,
            month=6,
            req=req,
            db=db_mock,
            current_user=user
        )
        
    assert exc_info.value.status_code == 400
    assert "attesterad" in exc_info.value.detail
