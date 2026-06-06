# -*- coding: utf-8 -*-
"""
SQLAlchemy-tabeller för Töreboda schemamotor.
Schemat lagras som JSONB-blobs per period — enkelt och flexibelt för MVP.
"""

from datetime import datetime
from sqlalchemy import String, Integer, JSON, UniqueConstraint, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class EmployeeRow(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    contract_type: Mapped[str] = mapped_column(String, nullable=False)
    group_name: Mapped[str] = mapped_column(String, nullable=False)
    absences: Mapped[list] = mapped_column(JSON, default=list)
    wishes: Mapped[list] = mapped_column(JSON, default=list)
    vetos: Mapped[list] = mapped_column(JSON, default=list)
    soft_constraints: Mapped[list] = mapped_column(JSON, default=list)  # list[SoftConstraint]
    wish_schedule: Mapped[list] = mapped_column(JSON, default=list)    # list[{date, start_time, end_time, shift_type, note}]
    is_dagansvarig: Mapped[bool] = mapped_column(default=False)        # Aldrig kväll/natt, alltid dag
    is_planerare: Mapped[bool] = mapped_column(default=False)
    percentage: Mapped[float] = mapped_column(default=1.0)


class SchedulePeriodRow(Base):
    """Schema per grupp och månad, lagrat som JSON-blob."""
    __tablename__ = "schedule_periods"
    __table_args__ = (UniqueConstraint("group_name", "year", "month"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    phase: Mapped[str] = mapped_column(String, default="wish")  # wish | correction | attested
    schedule: Mapped[list] = mapped_column(JSON, default=list)   # list[ScheduleDay som dict]
    apt_date: Mapped[str | None] = mapped_column(String, nullable=True)  # ISO-datum för APT denna period
    decisions: Mapped[list] = mapped_column(JSON, default=list)  # list[str] beslutslogg från generatorn


class ShiftConfigRow(Base):
    """Passtider per passtyp — globala defaults eller per grupp (group_name=None → global)."""
    __tablename__ = "shift_configs"
    __table_args__ = (UniqueConstraint("group_name", "shift_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_name: Mapped[str | None] = mapped_column(String, nullable=True)   # None = global default
    shift_type: Mapped[str] = mapped_column(String, nullable=False)          # ShiftType value
    start_time: Mapped[str] = mapped_column(String, nullable=False)          # "HH:MM"
    end_time: Mapped[str] = mapped_column(String, nullable=False)            # "HH:MM"
    label: Mapped[str | None] = mapped_column(String, nullable=True)         # valfri etikett


class EmployeeBalanceRow(Base):
    """Manuellt inmatat ingångssaldo från Medvind per anställd och period."""
    __tablename__ = "employee_balances"
    __table_args__ = (UniqueConstraint("employee_id", "year", "month"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_balance_h: Mapped[float] = mapped_column(default=0.0)  # + = plustid, - = minustid
    note: Mapped[str | None] = mapped_column(String, nullable=True)  # valfri notering, t.ex. "Hämtat från Medvind 2026-06-01"


class UserRow(Base):
    """Användare med inloggning och roll."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)  # None = ej accepterat inbjudan
    role: Mapped[str] = mapped_column(String, nullable=False, default="personal")  # superadmin | schemaansvarig | personal
    employee_id: Mapped[str | None] = mapped_column(String, nullable=True)  # Koppling till anställd (personal-rollen)
    full_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    invite_token: Mapped[str | None] = mapped_column(String, nullable=True)  # UUID för inbjudningslänk
    invite_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class StaffingTemplateRow(Base):
    """Bemanningskrav-mall per grupp — per veckodag (0=Mån … 6=Sön)."""
    __tablename__ = "staffing_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    # JSON-lista med 7 objekt: [{fm, kval, natt}, ...] index 0=Mån, 6=Sön
    per_weekday: Mapped[list] = mapped_column(JSON, default=list)


class BemanningskravRow(Base):
    """Bemanningskrav per grupp och månad."""
    __tablename__ = "bemanningskrav"
    __table_args__ = (UniqueConstraint("group_name", "year", "month"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    requirements: Mapped[list] = mapped_column(JSON, default=list)  # list[Bemanningskrav som dict]


class RagDocumentRow(Base):
    """Dokument i RAG-scopet som kan godkännas (attesteras) eller tas bort."""
    __tablename__ = "rag_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    file_size_kb: Mapped[float] = mapped_column(default=0.0)
    is_attested: Mapped[bool] = mapped_column(default=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    uploaded_by: Mapped[str] = mapped_column(String, nullable=False)


class OrganizationSettingsRow(Base):
    """Fakturerings- och profiluppgifter för kommuner (B2G)."""
    __tablename__ = "organization_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_name: Mapped[str] = mapped_column(String, nullable=False, default="Töreboda Hemvård")
    org_number: Mapped[str | None] = mapped_column(String, nullable=True)       # Organisationsnummer (t.ex. 212000-1652)
    peppol_id: Mapped[str | None] = mapped_column(String, nullable=True)        # PEPPOL-mottagar-ID för e-faktura
    zz_reference: Mapped[str | None] = mapped_column(String, nullable=True)     # Fakturareferens (ZZ-kod / ansvarsnummer)
    invoice_email: Mapped[str | None] = mapped_column(String, nullable=True)    # Kontaktperson för ekonomi
    billing_plan: Mapped[str] = mapped_column(String, default="yearly")         # yearly | pilot | demo

