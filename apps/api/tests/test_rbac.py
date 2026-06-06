# -*- coding: utf-8 -*-
"""
Tests for Sintari Role-Based Access Control (RBAC).
Verifies that regular staff (personal role) has restricted access compared to administrators.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.db_models import UserRow, EmployeeRow
from app.auth_utils import require_admin_or_schemaansvarig, require_superadmin
from app.routers.employees import update_wishes, get_employee, WishesRequest


def test_require_admin_or_schemaansvarig_blocks_personal():
    """Verifies that require_admin_or_schemaansvarig raises 403 for standard personal role."""
    user = UserRow(username="kalle.karlsson", role="personal", employee_id="EMP_001")
    
    with pytest.raises(HTTPException) as exc_info:
        require_admin_or_schemaansvarig(user=user)
        
    assert exc_info.value.status_code == 403
    assert "schemaläggarbehörighet" in exc_info.value.detail


def test_require_admin_or_schemaansvarig_allows_admin_roles():
    """Verifies that require_admin_or_schemaansvarig accepts superadmin and schemaansvarig."""
    sa_user = UserRow(username="sara.admin", role="superadmin", employee_id=None)
    sa_res = require_admin_or_schemaansvarig(user=sa_user)
    assert sa_res == sa_user

    sa_sch = UserRow(username="sara.sch", role="schemaansvarig", employee_id=None)
    sch_res = require_admin_or_schemaansvarig(user=sa_sch)
    assert sch_res == sa_sch


def test_require_superadmin_blocks_schemaansvarig_and_personal():
    """Verifies that require_superadmin raises 403 for schemaansvarig and personal."""
    sch_user = UserRow(username="sara.sch", role="schemaansvarig", employee_id=None)
    with pytest.raises(HTTPException) as exc_info:
        require_superadmin(user=sch_user)
    assert exc_info.value.status_code == 403

    pers_user = UserRow(username="kalle.karlsson", role="personal", employee_id="EMP_001")
    with pytest.raises(HTTPException) as exc_info:
        require_superadmin(user=pers_user)
    assert exc_info.value.status_code == 403


def test_require_superadmin_allows_superadmin():
    """Verifies that require_superadmin accepts superadmin."""
    sa_user = UserRow(username="sara.admin", role="superadmin", employee_id=None)
    res = require_superadmin(user=sa_user)
    assert res == sa_user


@pytest.mark.anyio
async def test_update_wishes_blocks_other_employee():
    """Verifies that an employee cannot modify another employee's wishes."""
    db_mock = AsyncMock()
    user = UserRow(username="kalle", role="personal", employee_id="EMP_001")
    req = WishesRequest(wishes=["2026-06-02"])

    # Attempt to update wishes of EMP_002
    with pytest.raises(HTTPException) as exc_info:
        await update_wishes(
            employee_id="EMP_002",
            req=req,
            db=db_mock,
            current_user=user
        )
    assert exc_info.value.status_code == 403
    assert "Behörighet saknas" in exc_info.value.detail


@pytest.mark.anyio
async def test_update_wishes_allows_own_employee():
    """Verifies that an employee can modify their own wishes."""
    db_mock = AsyncMock()
    user = UserRow(username="kalle", role="personal", employee_id="EMP_001")
    req = WishesRequest(wishes=["2026-06-02"])

    emp_row = EmployeeRow(
        id="EMP_001",
        name="Kalle",
        contract_type="varierande",
        group_name="Norra",
        wishes=[]
    )
    db_mock.get.return_value = emp_row

    res = await update_wishes(
        employee_id="EMP_001",
        req=req,
        db=db_mock,
        current_user=user
    )
    assert res.id == "EMP_001"
    assert emp_row.wishes == ["2026-06-02"]


@pytest.mark.anyio
async def test_get_employee_blocks_other_employee():
    """Verifies that an employee cannot fetch another employee's profile."""
    db_mock = AsyncMock()
    user = UserRow(username="kalle", role="personal", employee_id="EMP_001")

    with pytest.raises(HTTPException) as exc_info:
        await get_employee(
            employee_id="EMP_002",
            db=db_mock,
            current_user=user
        )
    assert exc_info.value.status_code == 403
    assert "Behörighet saknas" in exc_info.value.detail
