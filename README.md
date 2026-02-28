# Rendera

Open source video editor (Camtasia-like) with Recorder and Editor.

## Architecture

- **Main process** – Electron; spawns FastAPI **first** on a **random free port**, then launches Recorder and Editor. All apps share the same API URL (exposed via IPC from main).
- **FastAPI server** – Central backend: SQLite, FFmpeg, AI; async, Uvicorn. Port is chosen by the main process at startup.
- **Recorder** – UI/UX only; streams recording to FastAPI (camera, mic, PC sound controls)
- **Editor** – UI/UX only; timeline, preview, chatbot; all via API

## Tech stack

- Electron, React, Vite, Tailwind CSS, Zustand
- FastAPI (async), Uvicorn, SQLite
- FFmpeg (bundled, configurable)
- i18n (en, ar, RTL), multi-theme

## Setup

```bash
# Install Node dependencies
npm install

# Create the FastAPI server venv and install Python dependencies
npm run setup:server
```

The server uses its own virtual environment at `server/.venv` (created by `setup:server`). The Electron main process and `npm run dev:server` use this venv automatically.

## Development

Run these in separate terminals (or use `npm run dev` for all):

```bash
# 1. Start FastAPI server (required first)
npm run dev:server

# 2. Start Recorder app
npm run dev:recorder

# 3. Start Editor app
npm run dev:editor

# 4. Start Electron (opens Recorder window; server must be running)
npm run dev:main
```

Or start all at once: `npm run dev`

## Build

```bash
npm run build
npm start
```
