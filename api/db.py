"""Lazily created asyncpg pool. Works with ?sslmode=require for Tiger Cloud."""
import asyncio
import os

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/savel")

_pool: asyncpg.Pool | None = None
_lock = asyncio.Lock()


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        async with _lock:
            if _pool is None:
                _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5, command_timeout=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        pool, _pool = _pool, None
        await pool.close()
