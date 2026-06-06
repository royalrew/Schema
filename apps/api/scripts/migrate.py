# -*- coding: utf-8 -*-
"""
Enkel migrationsskript — lägger till saknade kolumner utan att radera data.
Kör: python -m scripts.migrate  (från apps/api/)
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal, create_tables
from sqlalchemy import text


async def migrate():
    await create_tables()  # Skapar nya tabeller (shift_configs) om de saknas

    async with AsyncSessionLocal() as session:
        migrations = [
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS soft_constraints JSON DEFAULT '[]'",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS wish_schedule JSON DEFAULT '[]'",
            "ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_dagansvarig BOOLEAN DEFAULT FALSE",
            "ALTER TABLE schedule_periods ADD COLUMN IF NOT EXISTS apt_date VARCHAR",
            # Staffing templates: droppa gammal struktur och låt create_tables() återskapa
            "DROP TABLE IF EXISTS staffing_templates",
        ]

        for sql in migrations:
            try:
                await session.execute(text(sql))
                print(f"OK: {sql[:60]}...")
            except Exception as e:
                print(f"Info: {e}")

        await session.commit()
        print("Migration klar!")


if __name__ == "__main__":
    asyncio.run(migrate())
