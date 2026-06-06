# -*- coding: utf-8 -*-
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
import calendar

from app.database import get_db
from app.db_models import BemanningskravRow, StaffingTemplateRow, UserRow
from app.auth_utils import require_admin_or_schemaansvarig
from app.engine.schemas import Bemanningskrav, Group, HourlyRequirement

router = APIRouter(prefix="/api/staffing", tags=["staffing"])


class DayKrav(BaseModel):
    fm: int = 2
    kval: int = 2
    natt: int = 0
    hourly_requirements: list[HourlyRequirement] = []


class StaffingTemplate(BaseModel):
    group_name: str
    per_weekday: list[DayKrav] = []  # 7 items, index 0=Mån … 6=Sön

    @classmethod
    def default(cls, group_name: str) -> "StaffingTemplate":
        return cls(
            group_name=group_name,
            per_weekday=[DayKrav() for _ in range(7)],
        )

    def day(self, weekday: int) -> DayKrav:
        if len(self.per_weekday) == 7:
            return self.per_weekday[weekday]
        return DayKrav()


def _krav_from_template(tmpl: StaffingTemplate, group: Group, year: int, month: int) -> list[Bemanningskrav]:
    _, last_day = calendar.monthrange(year, month)
    krav = []
    for d_num in range(1, last_day + 1):
        d = date(year, month, d_num)
        day = tmpl.day(d.weekday())
        krav.append(Bemanningskrav(
            group=group,
            date=d,
            fm_heads=day.fm,
            em_heads=0,
            kval_heads=day.kval,
            natt_heads=day.natt,
            hourly_requirements=day.hourly_requirements,
        ))
    return krav


def _default_krav(group: Group, year: int, month: int) -> list[Bemanningskrav]:
    return _krav_from_template(StaffingTemplate.default(group.value), group, year, month)


@router.get("/template/{group}", response_model=StaffingTemplate)
async def get_template(
    group: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    row = (await db.execute(
        select(StaffingTemplateRow).where(StaffingTemplateRow.group_name == group)
    )).scalar_one_or_none()
    if not row or not row.per_weekday:
        return StaffingTemplate.default(group)
    return StaffingTemplate(
        group_name=group,
        per_weekday=[DayKrav(**d) for d in row.per_weekday],
    )


@router.put("/template/{group}", response_model=StaffingTemplate)
async def save_template(
    group: str,
    tmpl: StaffingTemplate,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    row = (await db.execute(
        select(StaffingTemplateRow).where(StaffingTemplateRow.group_name == group)
    )).scalar_one_or_none()
    payload = [d.model_dump() for d in tmpl.per_weekday]
    if row:
        row.per_weekday = payload
    else:
        db.add(StaffingTemplateRow(group_name=group, per_weekday=payload))
    await db.commit()
    return tmpl


@router.get("/{group}/{year}/{month}", response_model=list[Bemanningskrav])
async def get_staffing(
    group: str, year: int, month: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    stmt = select(BemanningskravRow).where(
        BemanningskravRow.group_name == group,
        BemanningskravRow.year == year,
        BemanningskravRow.month == month,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if not row or not row.requirements:
        return _default_krav(Group(group), year, month)

    return [
        Bemanningskrav(
            group=Group(r["group"]),
            date=date.fromisoformat(r["date"]),
            fm_heads=r.get("fm_heads", 2),
            em_heads=r.get("em_heads", 0),
            kval_heads=r.get("kval_heads", 2),
            natt_heads=r.get("natt_heads", 0),
            hourly_requirements=[HourlyRequirement(**hr) for hr in r.get("hourly_requirements", [])],
        )
        for r in row.requirements
    ]


@router.post("", status_code=204)
async def set_staffing(
    krav_list: list[Bemanningskrav],
    db: AsyncSession = Depends(get_db),
    current_user: UserRow = Depends(require_admin_or_schemaansvarig),
):
    if not krav_list:
        return
    group_name = krav_list[0].group.value
    year = krav_list[0].date.year
    month = krav_list[0].date.month

    stmt = select(BemanningskravRow).where(
        BemanningskravRow.group_name == group_name,
        BemanningskravRow.year == year,
        BemanningskravRow.month == month,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    payload = [
        {
            "group": k.group.value,
            "date": k.date.isoformat(),
            "fm_heads": k.fm_heads,
            "em_heads": k.em_heads,
            "kval_heads": k.kval_heads,
            "natt_heads": k.natt_heads,
            "hourly_requirements": [hr.model_dump() for hr in k.hourly_requirements],
        }
        for k in krav_list
    ]

    if row:
        row.requirements = payload
    else:
        db.add(BemanningskravRow(
            group_name=group_name,
            year=year,
            month=month,
            requirements=payload,
        ))
    await db.commit()
