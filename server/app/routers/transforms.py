"""Transform API: noise cancellation, Nano Banana, transcript, voice over, record voice.
All outputs are stored in the project folder under generated/.
"""

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from typing import Any

from app.db import get_db
from app.routers.projects import _project_dir, _generated_dir
from app.routers.settings import NANO_BANANA_API_KEY

router = APIRouter()


def _resolve_media_path(project_id: str, path: str) -> Path | None:
    """Resolve stored path (e.g. media/filename) to absolute file path. Returns None for pending/text."""
    if not path or path.startswith("pending:") or path.startswith("text:"):
        return None
    if path.startswith("media/"):
        filename = path.replace("media/", "", 1)
    else:
        filename = path
    if ".." in filename or filename.startswith("/") or "\\" in filename:
        return None
    full = _project_dir(project_id) / filename
    return full if full.exists() and full.is_file() else None


class TransformSource(BaseModel):
    """Source for a transform: either media path (sidebar or node) or node id (timeline)."""
    media_path: str | None = None
    node_id: str | None = None


# ----- Noise Cancellation (audio/video) -----

class NoiseCancellationBody(BaseModel):
    source: TransformSource
    options: dict[str, Any] | None = None


@router.post("/{project_id}/transform/noise-cancellation")
async def transform_noise_cancellation(project_id: str, body: NoiseCancellationBody) -> dict:
    """Run noise cancellation on the given media/node. Returns new media path in project."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id, root FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Project not found")
    root = json.loads(row["root"]) if row["root"] else {}
    media_path = body.source.media_path
    if body.source.node_id and not media_path:
        for tl in (root.get("timelines") or []):
            for item in (tl.get("items") or []):
                if item.get("id") == body.source.node_id:
                    media_path = item.get("mediaPath")
                    break
            if media_path:
                break
    if not media_path:
        raise HTTPException(status_code=400, detail="No media path or node provided")
    src = _resolve_media_path(project_id, media_path)
    if not src:
        raise HTTPException(status_code=400, detail="Source file not found or is pending/text")
    out_dir = _generated_dir(project_id)
    ext = src.suffix
    out_name = f"noise_cancelled_{uuid.uuid4().hex[:8]}{ext}"
    out_path = out_dir / out_name
    # Stub: copy file (real impl would run FFmpeg/RNNoise or similar)
    out_path.write_bytes(src.read_bytes())
    stored_path = f"media/generated/{out_name}"
    return {"path": stored_path, "node_id": body.source.node_id}


# ----- Nano Banana (Google AI image/video) -----

class NanoBananaBody(BaseModel):
    source: TransformSource
    prompt: str | None = None  # for edit/generate; optional if source is image
    options: dict[str, Any] | None = None


async def _get_nano_banana_api_key() -> str | None:
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT value FROM settings WHERE key = ?", (NANO_BANANA_API_KEY,)
        )
        row = await cursor.fetchone()
    return row["value"] if row and row["value"] else None


@router.post("/{project_id}/transform/nano-banana")
async def transform_nano_banana(project_id: str, body: NanoBananaBody) -> dict:
    """Nano Banana (Gemini image gen/edit) for images and video frames. Returns new media path."""
    api_key = await _get_nano_banana_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Nano Banana API key not set. Add it in Settings (gear icon).",
        )
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    media_path = body.source.media_path
    if body.source.node_id:
        async with get_db() as db:
            cursor = await db.execute("SELECT root FROM projects WHERE id = ?", (project_id,))
            r = await cursor.fetchone()
            if r and r["root"]:
                root = json.loads(r["root"])
                for tl in (root.get("timelines") or []):
                    for item in (tl.get("items") or []):
                        if item.get("id") == body.source.node_id:
                            media_path = item.get("mediaPath")
                            break
    if not media_path:
        raise HTTPException(status_code=400, detail="No media path or node provided")
    src = _resolve_media_path(project_id, media_path)
    out_dir = _generated_dir(project_id)
    out_name = f"nanobanana_{uuid.uuid4().hex[:8]}.png"
    out_path = out_dir / out_name
    # Stub: if source exists, copy first byte as placeholder; else create minimal PNG placeholder
    if src and src.exists():
        out_path.write_bytes(src.read_bytes()[:1] + b"\n# Nano Banana placeholder; integrate Google AI API\n")
    else:
        out_path.write_text("# Nano Banana placeholder; integrate Google AI Studio / Gemini API\n", encoding="utf-8")
    stored_path = f"media/generated/{out_name}"
    return {"path": stored_path, "node_id": body.source.node_id}


# ----- Extract Transcript -----

class ExtractTranscriptBody(BaseModel):
    source: TransformSource


@router.post("/{project_id}/transform/extract-transcript")
async def transform_extract_transcript(project_id: str, body: ExtractTranscriptBody) -> dict:
    """Extract transcript from video/audio. Returns transcript text and optional path to saved .txt."""
    async with get_db() as db:
        cursor = await db.execute("SELECT root FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Project not found")
    source = body.source
    media_path = source.media_path
    if source.node_id and not media_path:
        root = json.loads(row["root"]) if row["root"] else {}
        for tl in (root.get("timelines") or []):
            for item in (tl.get("items") or []):
                if item.get("id") == source.node_id:
                    media_path = item.get("mediaPath")
                    break
    if not media_path:
        raise HTTPException(status_code=400, detail="No media path or node provided")
    src = _resolve_media_path(project_id, media_path)
    if not src:
        raise HTTPException(status_code=400, detail="Source file not found")
    out_dir = _generated_dir(project_id)
    txt_name = f"transcript_{uuid.uuid4().hex[:8]}.txt"
    txt_path = out_dir / txt_name
    # Stub: placeholder transcript (real impl: Whisper / Speech-to-Text API)
    txt_path.write_text("# Transcript placeholder; integrate Whisper or Google Speech-to-Text\n", encoding="utf-8")
    return {"transcript": "", "path": f"media/generated/{txt_name}", "node_id": source.node_id}


# ----- Voice Over (text-to-speech) -----

class VoiceOverBody(BaseModel):
    source: TransformSource | None = None  # optional: attach to node timing
    text: str
    node_id: str | None = None  # if set, clip is placed on track above this node
    options: dict[str, Any] | None = None


@router.post("/{project_id}/transform/voice-over")
async def transform_voice_over(project_id: str, body: VoiceOverBody) -> dict:
    """Generate audio from text (TTS). Returns path to generated audio and optional node placement."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    out_dir = _generated_dir(project_id)
    out_name = f"voiceover_{uuid.uuid4().hex[:8]}.mp3"
    out_path = out_dir / out_name
    # Stub: placeholder file (real impl: Google TTS / ElevenLabs / etc.)
    out_path.write_text(f"# Voice over: {body.text[:50]}...\n", encoding="utf-8")
    stored_path = f"media/generated/{out_name}"
    return {"path": stored_path, "node_id": body.node_id}


# ----- Record Voice (upload recorded audio) -----

@router.post("/{project_id}/transform/record-voice")
async def transform_record_voice(
    project_id: str,
    file: UploadFile = File(...),
    node_id: str | None = Form(None),
    start_time: float | None = Form(None),
) -> dict:
    """Store user-recorded voice; can be placed on track above given node. Record can extend past node."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    out_dir = _generated_dir(project_id)
    ext = Path(file.filename or "audio").suffix or ".webm"
    out_name = f"recorded_voice_{uuid.uuid4().hex[:8]}{ext}"
    out_path = out_dir / out_name
    contents = await file.read()
    out_path.write_bytes(contents)
    stored_path = f"media/generated/{out_name}"
    return {"path": stored_path, "node_id": node_id, "start_time": start_time}
