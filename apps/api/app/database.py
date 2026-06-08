# -*- coding: utf-8 -*-
"""
Databasanslutning: async SQLAlchemy engine med asyncpg.
DATABASE_URL läses från miljövariabeln (satt i .env).
"""

import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://toreboda:toreboda@localhost:5432/toreboda")

# Konvertera standard postgresql:// eller postgres:// till postgresql+asyncpg://
# för att tvinga SQLAlchemy att använda asyncpg-drivrutinen.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


from sqlalchemy import text

async def create_tables():
    async with engine.begin() as conn:
        from app import db_models  # noqa: F401 — registrerar alla modeller
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS percentage DOUBLE PRECISION DEFAULT 1.0;"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS target_days_per_month INTEGER;"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE employees ADD COLUMN IF NOT EXISTS target_evenings_per_month INTEGER;"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE schedule_periods ADD COLUMN IF NOT EXISTS decisions TEXT;"))
        except Exception:
            pass
