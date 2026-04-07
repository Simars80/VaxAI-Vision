#!/usr/bin/env python3
"""
create_demo_user.py
===================
Idempotently create the demo@vaxaivision.com user for one-click demo access.

Usage:
    # From the backend/ directory with venv active:
    python scripts/create_demo_user.py

    # With a custom DB URL:
    DATABASE_URL=postgresql+asyncpg://user:pass@host/db python scripts/create_demo_user.py
"""

import asyncio
import logging
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("create_demo_user")

DEMO_EMAIL    = "demo@vaxaivision.com"
DEMO_PASSWORD = "Demo1234!"
DEMO_FULLNAME = "Demo User"
DEMO_ROLE     = "analyst"
DEMO_COUNTRY  = "NG"


def _hash_password(plain: str) -> str:
    from passlib.context import CryptContext
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return ctx.hash(plain)


async def run() -> None:
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://vaxai:vaxai_dev_password@localhost:5432/vaxai_vision",
    )
    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        try:
            row = await session.execute(
                text("SELECT id, is_active FROM users WHERE email = :email"),
                {"email": DEMO_EMAIL},
            )
            existing = row.fetchone()

            if existing:
                user_id, is_active = existing
                if not is_active:
                    await session.execute(
                        text("UPDATE users SET is_active = true WHERE id = :id"),
                        {"id": user_id},
                    )
                    await session.commit()
                    log.info("Re-activated existing demo user  %s", user_id)
                else:
                    log.info("Demo user already exists and is active  %s", user_id)
            else:
                hashed = _hash_password(DEMO_PASSWORD)
                new_id = uuid.uuid4()
                await session.execute(
                    text("""
                        INSERT INTO users
                            (id, email, full_name, hashed_password, role, is_active, country_code)
                        VALUES
                            (:id, :email, :full_name, :hashed_password, :role, true, :country_code)
                    """),
                    {
                        "id": new_id,
                        "email": DEMO_EMAIL,
                        "full_name": DEMO_FULLNAME,
                        "hashed_password": hashed,
                        "role": DEMO_ROLE,
                        "country_code": DEMO_COUNTRY,
                    },
                )
                await session.commit()
                log.info("Created demo user  %s  (%s)", new_id, DEMO_EMAIL)

        except Exception:
            await session.rollback()
            log.exception("Failed to create demo user; rolled back.")
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
