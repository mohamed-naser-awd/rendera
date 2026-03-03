"""Projects API - CRUD for projects stored in SQLite."""

import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Any

from app.db import get_db

router = APIRouter()

MEDIA_BASE = Path(__file__).resolve().parent.parent.parent / "media"
TEMP_FILENAME = ".project_temp.json"


def _project_dir(project_id: str) -> Path:
    """Project folder: media/{project_id}/. Contains uploaded media, generated/, and temp file."""
    d = MEDIA_BASE / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _generated_dir(project_id: str) -> Path:
    """Generated files from transforms (noise cancellation, nano banana, voice over, etc.)."""
    d = _project_dir(project_id) / "generated"
    d.mkdir(parents=True, exist_ok=True)
    return d


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    resolution: str = "1920x1080"
    fps: int = 30
    root: dict[str, Any]


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    resolution: str | None = None
    fps: int | None = None
    root: dict[str, Any] | None = None
    duration: float | None = None


@router.get("")
async def list_projects() -> list[dict]:
    """List all projects."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, name, description, resolution, fps, duration, created_at, updated_at, root FROM projects"
        )
        rows = await cursor.fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "description": r["description"],
            "resolution": r["resolution"],
            "fps": r["fps"],
            "duration": r["duration"],
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"],
            "root": _root_with_media(json.loads(r["root"]) if r["root"] else {"type": "stack", "items": []}),
        }
        for r in rows
    ]


def _root_with_media(root: dict | None) -> dict:
    """Ensure root has media array."""
    r = dict(root) if root else {"type": "stack", "items": []}
    media = r.get("media")
    r["media"] = media if isinstance(media, list) else []
    return r


@router.post("/{project_id}/media")
async def add_project_media(project_id: str, file: UploadFile = File(...)) -> dict:
    """Upload a file to project media and update the project."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT root FROM projects WHERE id = ?", (project_id,)
        )
        row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")

    root = json.loads(row["root"]) if row["root"] else {"type": "stack", "items": []}
    root = _root_with_media(root)
    media_list = list(root.get("media") or [])

    # Save file to project folder media/{project_id}/{unique}_{filename}
    ext = Path(file.filename or "file").suffix
    safe_name = f"{uuid.uuid4().hex[:8]}{ext}"
    project_media_dir = _project_dir(project_id)
    dest = project_media_dir / safe_name
    contents = await file.read()
    dest.write_bytes(contents)

    # Store path relative to project (media/filename)
    stored_path = f"media/{safe_name}"
    media_list.append({"path": stored_path})
    root["media"] = media_list

    async with get_db() as db:
        await db.execute(
            "UPDATE projects SET root = ?, updated_at = ? WHERE id = ?",
            (json.dumps(root), datetime.utcnow().isoformat(), project_id),
        )
        await db.commit()

    return {"path": stored_path}


@router.get("/{project_id}/media/{filename:path}")
async def get_project_media_file(project_id: str, filename: str) -> FileResponse:
    """Serve a media file from a project (e.g. 'foo.mp4' or 'generated/voiceover_xxx.mp3')."""
    if ".." in filename or filename.startswith("/") or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
    file_path = MEDIA_BASE / project_id / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(file_path, media_type=None)


@router.get("/{project_id}")
async def get_project(project_id: str) -> dict:
    """Get a single project by id."""
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT id, name, description, resolution, fps, duration, created_at, updated_at, root FROM projects WHERE id = ?",
            (project_id,),
        )
        row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "resolution": row["resolution"],
        "fps": row["fps"],
        "duration": row["duration"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "root": _root_with_media(json.loads(row["root"]) if row["root"] else {"type": "stack", "items": []}),
    }


@router.post("")
async def create_project(body: ProjectCreate) -> dict:
    """Create a new project."""
    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    root = _root_with_media(body.root)

    async with get_db() as db:
        await db.execute(
            """INSERT INTO projects (id, name, description, resolution, fps, duration, created_at, updated_at, root)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)""",
            (
                project_id,
                body.name,
                body.description or "",
                body.resolution,
                body.fps,
                now,
                now,
                json.dumps(root),
            ),
        )
        await db.commit()

    return {"id": project_id, "name": body.name}


@router.put("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate) -> dict:
    """Update a project."""
    from datetime import datetime

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")

        updates = []
        params = []
        if body.name is not None:
            updates.append("name = ?")
            params.append(body.name)
        if body.description is not None:
            updates.append("description = ?")
            params.append(body.description)
        if body.resolution is not None:
            updates.append("resolution = ?")
            params.append(body.resolution)
        if body.fps is not None:
            updates.append("fps = ?")
            params.append(body.fps)
        if body.duration is not None:
            updates.append("duration = ?")
            params.append(body.duration)
        if body.root is not None:
            updates.append("root = ?")
            params.append(json.dumps(body.root))

        if updates:
            updates.append("updated_at = ?")
            params.append(datetime.utcnow().isoformat())
            params.append(project_id)
            await db.execute(
                f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params
            )
            await db.commit()

    return {"id": project_id}


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict:
    """Delete a project."""
    async with get_db() as db:
        await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await db.commit()
    return {"id": project_id}


# ----- Temporary project state (draft): copy of latest, updated on each change; sync on save, discard on cancel -----

@router.get("/{project_id}/temp")
async def get_project_temp(project_id: str) -> dict:
    """Get temporary/draft project state if it exists (unsaved changes). Returns 404 if no temp."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    temp_path = _project_dir(project_id) / TEMP_FILENAME
    if not temp_path.exists() or not temp_path.is_file():
        raise HTTPException(status_code=404, detail="No temporary project state")
    root = json.loads(temp_path.read_text(encoding="utf-8"))
    return {"root": _root_with_media(root)}


class ProjectTempUpdate(BaseModel):
    root: dict[str, Any]


@router.put("/{project_id}/temp")
async def put_project_temp(project_id: str, body: ProjectTempUpdate) -> dict:
    """Store temporary project state (full root). Overwrites any existing temp."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    temp_path = _project_dir(project_id) / TEMP_FILENAME
    temp_path.write_text(json.dumps(body.root), encoding="utf-8")
    return {"ok": True}


@router.delete("/{project_id}/temp")
async def delete_project_temp(project_id: str) -> dict:
    """Discard temporary project state (e.g. on cancel)."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if await cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Project not found")
    temp_path = _project_dir(project_id) / TEMP_FILENAME
    if temp_path.exists():
        temp_path.unlink()
    return {"ok": True}


@router.post("/{project_id}/sync-temp")
async def sync_temp_to_project(project_id: str) -> dict:
    """Copy temp project state into the project (save). Then remove temp file."""
    async with get_db() as db:
        cursor = await db.execute("SELECT id, root FROM projects WHERE id = ?", (project_id,))
        row = await cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Project not found")
    temp_path = _project_dir(project_id) / TEMP_FILENAME
    if not temp_path.exists() or not temp_path.is_file():
        raise HTTPException(status_code=400, detail="No temporary state to sync")
    root = json.loads(temp_path.read_text(encoding="utf-8"))
    root = _root_with_media(root)
    async with get_db() as db:
        await db.execute(
            "UPDATE projects SET root = ?, updated_at = ? WHERE id = ?",
            (json.dumps(root), datetime.utcnow().isoformat(), project_id),
        )
        await db.commit()
    temp_path.unlink()
    return {"id": project_id}
