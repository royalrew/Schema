# -*- coding: utf-8 -*-
"""
Tests for Sintari Demo Mode and B2G Billing Organization router.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.db_models import UserRow, OrganizationSettingsRow
from app.routers.organization import get_settings, update_settings, OrganizationSettingsSchema
from app.routers.demo import create_demo_sandbox

@pytest.mark.anyio
async def test_get_organization_settings_creates_default_if_missing():
    """Verifierar att get_settings skapar och sparar en default-rad i databasen om den saknas."""
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.execute.return_value.scalars = MagicMock()
    # Mocka att ingen rad hittades
    db_mock.execute.return_value.scalars.return_value.first.return_value = None
    
    current_user = UserRow(username="sara", role="superadmin")
    
    res = await get_settings(db=db_mock, current_user=current_user)
    
    # Kontrollera standardvärden
    assert res.org_name == "Töreboda Hemvård"
    assert res.billing_plan == "yearly"
    assert res.zz_reference == ""
    
    # Kontrollera databasinteraktioner
    db_mock.add.assert_called_once()
    db_mock.commit.assert_called_once()


@pytest.mark.anyio
async def test_get_organization_settings_returns_existing():
    """Verifierar att get_settings hämtar och returnerar den befintliga raden."""
    db_mock = AsyncMock()
    db_mock.execute.return_value.scalars = MagicMock()
    existing_row = OrganizationSettingsRow(
        org_name="Töreboda Kommun",
        org_number="212000-1652",
        peppol_id="0007:2120001652",
        zz_reference="ZZ99",
        invoice_email="finance@toreboda.se",
        billing_plan="pilot"
    )
    db_mock.execute.return_value.scalars.return_value.first.return_value = existing_row
    
    current_user = UserRow(username="sara", role="superadmin")
    res = await get_settings(db=db_mock, current_user=current_user)
    
    assert res.org_name == "Töreboda Kommun"
    assert res.org_number == "212000-1652"
    assert res.peppol_id == "0007:2120001652"
    assert res.zz_reference == "ZZ99"
    assert res.billing_plan == "pilot"


@pytest.mark.anyio
async def test_update_organization_settings():
    """Verifierar att update_settings modifierar fälten på databasraden och sparar."""
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    db_mock.execute.return_value.scalars = MagicMock()
    existing_row = OrganizationSettingsRow(
        org_name="Töreboda Hemvård",
        org_number="",
        peppol_id="",
        zz_reference="",
        invoice_email="",
        billing_plan="yearly"
    )
    db_mock.execute.return_value.scalars.return_value.first.return_value = existing_row
    
    current_user = UserRow(username="sara", role="superadmin")
    update_data = OrganizationSettingsSchema(
        org_name="Töreboda Äldreomsorg",
        org_number="212000-1652",
        peppol_id="0007:2120001652",
        zz_reference="ZZ1234",
        invoice_email="sara@toreboda.se",
        billing_plan="pilot"
    )
    
    res = await update_settings(settings=update_data, db=db_mock, current_user=current_user)
    
    assert existing_row.org_name == "Töreboda Äldreomsorg"
    assert existing_row.org_number == "212000-1652"
    assert existing_row.zz_reference == "ZZ1234"
    assert existing_row.billing_plan == "pilot"
    db_mock.commit.assert_called_once()


@pytest.mark.anyio
async def test_create_demo_sandbox():
    """Verifierar att skapande av demo-sandlåda genererar token och lägger till användare, krav och personal."""
    db_mock = AsyncMock()
    db_mock.add = MagicMock()
    
    res = await create_demo_sandbox(db=db_mock)
    
    # Kontrollera returvärden
    assert "access_token" in res
    assert "username" in res
    assert "expires_at" in res
    assert "group_name" in res
    
    # Kontrollera att rätt mängd rader lades till (1 user, 8 employees, 1 bemanningskrav, 1 period = 11 rader)
    assert db_mock.add.call_count >= 11
    db_mock.commit.assert_called_once()
