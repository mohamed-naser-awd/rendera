"""Settings API - key/value stored as raw text (local, no encryption)."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.db import get_db

router = APIRouter()

NANO_BANANA_API_KEY = "nano_banana_api_key"


class SettingsBody(BaseModel):
    nano_banana_api_key: str | None = None


@router.get("")
async def get_settings() -> dict:
    """Return current settings (e.g. API keys). Values are returned as stored."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key = ?", (NANO_BANANA_API_KEY,)
        )
        row = await cursor.fetchone()
    value = row["value"] if row else None
    return {"nano_banana_api_key": value}


@router.put("")
async def put_settings(body: SettingsBody) -> dict:
    """Update settings. Send only keys you want to set; null clears the key."""
    async with get_db() as db:
        if body.nano_banana_api_key is not None:
            if body.nano_banana_api_key.strip():
                await db.execute(
                    """INSERT INTO settings (key, value) VALUES (?, ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
                    (NANO_BANANA_API_KEY, body.nano_banana_api_key.strip()),
                )
            else:
                await db.execute("DELETE FROM settings WHERE key = ?", (NANO_BANANA_API_KEY,))
        await db.commit()
    return {"ok": True}
