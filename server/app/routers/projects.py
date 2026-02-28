"""Projects API - CRUD for projects stored in SQLite."""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any

from app.db import get_db

router = APIRouter()


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
            "root": json.loads(r["root"]) if r["root"] else {"type": "stack", "items": []},
        }
        for r in rows
    ]


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
        "root": json.loads(row["root"]) if row["root"] else {"type": "stack", "items": []},
    }


@router.post("")
async def create_project(body: ProjectCreate) -> dict:
    """Create a new project."""
    import uuid
    from datetime import datetime

    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

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
                json.dumps(body.root),
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
