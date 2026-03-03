"""SQLite database - async via aiosqlite."""

import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "rendera.db"


async def init_db() -> None:
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                resolution TEXT DEFAULT '1920x1080',
                fps INTEGER DEFAULT 30,
                duration REAL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                root TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        await db.commit()


class get_db:
    """Async context manager for DB connection."""

    async def __aenter__(self):
        await init_db()
        self._conn = await aiosqlite.connect(DB_PATH)
        self._conn.row_factory = aiosqlite.Row
        return self._conn

    async def __aexit__(self, *args):
        await self._conn.close()
