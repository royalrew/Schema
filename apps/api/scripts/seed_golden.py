# -*- coding: utf-8 -*-
"""
Seed-skript: laddar golden dataset (100 anställda) till PostgreSQL.
Kör: python -m scripts.seed_golden  (från apps/api/)
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal, create_tables
from app.db_models import EmployeeRow
from tests.fixtures.golden_employees import GOLDEN_EMPLOYEES
from sqlalchemy import select, delete


async def seed():
    await create_tables()

    async with AsyncSessionLocal() as session:
        # Rensa befintliga
        await session.execute(delete(EmployeeRow))
        await session.commit()

        count = 0
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
            )
            session.add(row)
            count += 1

        await session.commit()
        print(f"OK: Seedade {count} anstallda till databasen.")


if __name__ == "__main__":
    asyncio.run(seed())
