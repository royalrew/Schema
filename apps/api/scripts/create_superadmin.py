# -*- coding: utf-8 -*-
"""
Skapar ett superadmin-konto. Kör en gång per installation.
Usage: python -m scripts.create_superadmin
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal, create_tables
from app.db_models import UserRow
from app.auth_utils import hash_password
from sqlalchemy import select


async def main():
    await create_tables()
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(UserRow).where(UserRow.role == "superadmin"))).scalar_one_or_none()
        if existing:
            print(f"Superadmin finns redan: {existing.username}")
            return

        username = input("Användarnamn för superadmin [admin]: ").strip() or "admin"
        full_name = input("Fullständigt namn [Sara Arnham]: ").strip() or "Sara Arnham"
        password = input("Lösenord (min 6 tecken): ").strip()
        if len(password) < 6:
            print("För kort lösenord!")
            return

        row = UserRow(
            username=username,
            full_name=full_name,
            password_hash=hash_password(password),
            role="superadmin",
            invite_accepted=True,
        )
        db.add(row)
        await db.commit()
        print(f"\n✓ Superadmin skapad: {username}")
        print(f"  Logga in på /login med dessa uppgifter.")


if __name__ == "__main__":
    asyncio.run(main())
