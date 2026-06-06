# -*- coding: utf-8 -*-
"""
FastAPI-router för RAG-dokumentadministration.
Gör det möjligt för administratörer att ladda upp, ta bort och attestera (godkänna) dokument i RAG-scopet.
"""

import os
import shutil
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.db_models import RagDocumentRow, UserRow
from app.auth_utils import get_current_user, require_admin_or_schemaansvarig

router = APIRouter(prefix="/api/rag", tags=["rag"])

# Mapp där fysiska RAG-filer sparas
RAG_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "resources", "rag_docs")

# ── Pydantic-modeller ────────────────────────────────────────────────────────

class RagDocumentOut(BaseModel):
    """Returmodell för ett RAG-dokument."""
    id: int
    filename: str
    title: str
    content_type: str
    file_size_kb: float
    is_attested: bool
    uploaded_at: datetime
    uploaded_by: str

    class Config:
        from_attributes = True

# ── Slutpunkter ──────────────────────────────────────────────────────────────

@router.get("/documents", response_model=List[RagDocumentOut])
async def list_rag_documents(
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(get_current_user),
):
    """
    Hämtar alla dokument som ligger i RAG-scopet.
    Tillgängligt för alla inloggade användare (för att veta källomfånget).
    """
    stmt = select(RagDocumentRow).order_by(RagDocumentRow.uploaded_at.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return rows


@router.post("/upload", response_model=RagDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_rag_document(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=2, description="Titel för dokumentet"),
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Laddar upp ett nytt dokument till RAG-scopet.
    Endast tillgängligt för administratörer och schemaansvariga.
    Filen hamnar i 'Utkast'-läge (is_attested = False).
    """
    # 1. Validera filtyp
    allowed_exts = {".txt", ".md", ".json", ".pdf", ".docx", ".xlsx"}
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ogiltig filtyp. Tillåtna typer: {', '.join(allowed_exts)}"
        )

    # 2. Skapa katalogen om den saknas
    os.makedirs(RAG_DOCS_DIR, exist_ok=True)

    # Sanitisera filnamnet
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._-").strip()
    if not safe_filename:
        safe_filename = f"upload_{int(datetime.now().timestamp())}{ext}"

    # 3. Skapa databaspost först för att få ett unikt ID
    db_row = RagDocumentRow(
        filename=safe_filename,
        title=title,
        content_type=file.content_type or "text/plain",
        file_size_kb=0.0,
        is_attested=False,
        uploaded_by=current_user.full_name or current_user.username
    )
    db.add(db_row)
    await db.flush() # Fyller i db_row.id

    # 4. Spara filen fysiskt på servern med ID-prefix
    disk_filename = f"{db_row.id}_{safe_filename}"
    file_path = os.path.join(RAG_DOCS_DIR, disk_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Beräkna storlek i KB
        file_size_kb = round(os.path.getsize(file_path) / 1024.0, 1)
        db_row.file_size_kb = file_size_kb
        db_row.filename = disk_filename # Uppdatera med unika namnet
        
        await db.commit()
        await db.refresh(db_row)
        return db_row

    except Exception as e:
        # Vid fel, ta bort databaspost och eventuellt sparad fil
        await db.rollback()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Det gick inte att spara filen: {str(e)}"
        )


@router.patch("/documents/{doc_id}/attest", response_model=RagDocumentOut)
async def toggle_attest_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Godkänner (attesterar) eller drar tillbaka godkännandet för ett RAG-dokument.
    Endast tillgängligt för administratörer och schemaansvariga.
    """
    stmt = select(RagDocumentRow).where(RagDocumentRow.id == doc_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokumentet hittades inte."
        )

    row.is_attested = not row.is_attested
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/documents/{doc_id}", status_code=status.HTTP_200_OK)
async def delete_rag_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    """
    Tar bort ett dokument från databasen och raderar det fysiskt från filsystemet.
    Endast tillgängligt för administratörer och schemaansvariga.
    """
    stmt = select(RagDocumentRow).where(RagDocumentRow.id == doc_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokumentet hittades inte."
        )

    # 1. Radea fysisk fil
    file_path = os.path.join(RAG_DOCS_DIR, row.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            import logging
            logging.warning(f"Kunde inte radera RAG-fil {file_path}: {e}")

    # 2. Radera databaspost
    await db.delete(row)
    await db.commit()
    return {"detail": "Dokumentet har tagits bort från RAG-scopet."}
