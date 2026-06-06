# -*- coding: utf-8 -*-
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.engine.schemas import ContractType, Group, Employee
from app.db_models import EmployeeRow
from app.routers.employees import update_employee_attributes, upsert_employee, UpdateEmployeeAttributesRequest


@pytest.mark.anyio
async def test_update_employee_attributes_kval_is_dagansvarig_clash():
    """Verifierar att vi får 422 om vi sätter is_dagansvarig=True på en kvällsarbetare."""
    db_mock = AsyncMock()
    # Mocka att den anställde har kontrakt KVAL
    emp_row = EmployeeRow(
        id="EMP01",
        name="Testare",
        contract_type=ContractType.KVAL.value,
        group_name=Group.NORRA.value,
        is_dagansvarig=False
    )
    db_mock.get.return_value = emp_row

    req = UpdateEmployeeAttributesRequest(is_dagansvarig=True)

    current_user = MagicMock()
    current_user.username = "admin"

    with pytest.raises(HTTPException) as exc_info:
        await update_employee_attributes(
            employee_id="EMP01",
            req=req,
            db=db_mock,
            current_user=current_user
        )
    
    assert exc_info.value.status_code == 422
    assert "kvälls- eller nattkontrakt" in exc_info.value.detail


@pytest.mark.anyio
async def test_update_employee_attributes_change_contract_to_kval_with_dagansvarig():
    """Verifierar att vi får 422 om vi ändrar kontrakt till KVAL för en dagansvarig."""
    db_mock = AsyncMock()
    # Mocka att den anställde är dagansvarig
    emp_row = EmployeeRow(
        id="EMP01",
        name="Testare",
        contract_type=ContractType.VARIERANDE.value,
        group_name=Group.NORRA.value,
        is_dagansvarig=True
    )
    db_mock.get.return_value = emp_row

    req = UpdateEmployeeAttributesRequest(contract_type=ContractType.KVAL.value)

    current_user = MagicMock()
    current_user.username = "admin"

    with pytest.raises(HTTPException) as exc_info:
        await update_employee_attributes(
            employee_id="EMP01",
            req=req,
            db=db_mock,
            current_user=current_user
        )
    
    assert exc_info.value.status_code == 422
    assert "kvälls- eller nattkontrakt" in exc_info.value.detail


@pytest.mark.anyio
async def test_upsert_employee_kval_is_dagansvarig_clash():
    """Verifierar att upsert_employee ger 422 om is_dagansvarig=True och kontrakt är NATT."""
    db_mock = AsyncMock()
    
    emp = Employee(
        id="EMP01",
        name="Testare",
        contract_type=ContractType.NATT,
        group=Group.NORRA,
        is_dagansvarig=True
    )

    with pytest.raises(HTTPException) as exc_info:
        await upsert_employee(
            employee=emp,
            db=db_mock,
            current_user=MagicMock()
        )
    
    assert exc_info.value.status_code == 422
    assert "kvälls- eller nattkontrakt" in exc_info.value.detail


@pytest.mark.anyio
async def test_upsert_employee_preserves_absences_and_vetos():
    """Verifierar att upsert_employee inte raderar befintliga absences/vetos om de skickas som tomma."""
    db_mock = AsyncMock()
    
    # Befintlig anställd i databasen med semestrar och veton
    existing_row = EmployeeRow(
        id="EMP01",
        name="Sara",
        contract_type=ContractType.VARIERANDE.value,
        group_name=Group.NORRA.value,
        absences=[{"date": "2026-06-15", "absence_type": "sem"}],
        vetos=["2026-06-20"],
        is_dagansvarig=False
    )
    db_mock.get.return_value = existing_row

    # Nytt payload från grundläggande medarbetarmodal (skickar tomma absences/vetos)
    emp_payload = Employee(
        id="EMP01",
        name="Sara Uppdaterad",
        contract_type=ContractType.VARIERANDE,
        group=Group.NORRA,
        absences=[],
        vetos=[],
        is_dagansvarig=False
    )

    current_user = MagicMock()
    current_user.username = "admin"

    await upsert_employee(
        employee=emp_payload,
        db=db_mock,
        current_user=current_user
    )

    # Verifiera att fälten i befintlig rad inte har blivit tomma
    assert existing_row.name == "Sara Uppdaterad"
    assert len(existing_row.absences) == 1
    assert existing_row.absences[0]["date"] == "2026-06-15"
    assert len(existing_row.vetos) == 1
    assert existing_row.vetos[0] == "2026-06-20"
