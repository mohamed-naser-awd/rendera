"""
Rendera FastAPI app - async only, deployed with Uvicorn.
Central backend: projects (SQLite), FFmpeg, AI, marketplace.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import projects, transforms, settings

app = FastAPI(
    title="Rendera API",
    description="Backend for Rendera video editor",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(transforms.router, prefix="/api/projects", tags=["transforms"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check."""
    return {"status": "ok"}
