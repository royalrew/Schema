# -*- coding: utf-8 -*-
"""
B2G Invoicing and Organization Settings router.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import OrganizationSettingsRow, UserRow
from app.auth_utils import require_admin_or_schemaansvarig

router = APIRouter(prefix="/api/organization", tags=["organization"])


class OrganizationSettingsSchema(BaseModel):
    org_name: str = Field(..., description="Organisationsnamn")
    org_number: str | None = Field(None, description="Organisationsnummer")
    peppol_id: str | None = Field(None, description="PEPPOL-ID för e-faktura")
    zz_reference: str | None = Field(None, description="Fakturareferens (ZZ-kod)")
    invoice_email: str | None = Field(None, description="Kontaktperson för ekonomi")
    billing_plan: str = Field("yearly", description="Betalningsplan: yearly | pilot | demo")


@router.get("/settings", response_model=OrganizationSettingsSchema)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Hämtar aktuella fakturerings- och profiluppgifter för kommunen.

    Args:
        db: Async database session.
        current_user: The authenticated administrator/planner.

    Returns:
        OrganizationSettingsSchema med e-faktura och plan-uppgifter.
    """
    row = (await db.execute(select(OrganizationSettingsRow))).scalars().first()
    if not row:
        # Skapa en default-rad om det inte finns någon än
        row = OrganizationSettingsRow(
            org_name="Töreboda Hemvård",
            org_number="",
            peppol_id="",
            zz_reference="",
            invoice_email="",
            billing_plan="yearly",
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        
    return OrganizationSettingsSchema(
        org_name=row.org_name,
        org_number=row.org_number,
        peppol_id=row.peppol_id,
        zz_reference=row.zz_reference,
        invoice_email=row.invoice_email,
        billing_plan=row.billing_plan,
    )


@router.put("/settings", response_model=OrganizationSettingsSchema)
async def update_settings(
    settings: OrganizationSettingsSchema,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Uppdaterar fakturerings- och profiluppgifter för kommunen.

    Args:
        settings: De uppdaterade fälten.
        db: Async database session.
        current_user: The authenticated administrator/planner.

    Returns:
        OrganizationSettingsSchema med de sparade uppgifterna.
    """
    row = (await db.execute(select(OrganizationSettingsRow))).scalars().first()
    if not row:
        row = OrganizationSettingsRow()
        db.add(row)
        
    row.org_name = settings.org_name
    row.org_number = settings.org_number
    row.peppol_id = settings.peppol_id
    row.zz_reference = settings.zz_reference
    row.invoice_email = settings.invoice_email
    row.billing_plan = settings.billing_plan
    
    await db.commit()
    return settings
