from __future__ import annotations

import os
import sys
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Make feeder_core importable in dev; fallback to local package name if rearranged on Pi
try:
    from backend.feeder_core import DncSession, DncConfig
    from backend.feeder_core.events import DncEventType
    from backend.feeder_core.serial_io import SerialManager
    from backend.feeder_core.sanitize import sanitize_program
except Exception:
    sys.path.append(str(Path(__file__).resolve().parents[2]))
    from backend.feeder_core import DncSession, DncConfig  # type: ignore
    from backend.feeder_core.events import DncEventType  # type: ignore
    from backend.feeder_core.serial_io import SerialManager  # type: ignore
    from backend.feeder_core.sanitize import sanitize_program  # type: ignore

from .models import (
    HealthResponse,
    DncConfigModel,
    ModeUpdate,
    SendRequest,
    ReceiveRequest,
    SanitizeRequest,
    SanitizeResponse,
    SimpleAck,
    StateResponse,
    ProgressResponse,
)

app = FastAPI(title="DNC Feeder Service", version="0.1.0")

# CORS (optional; typically the gateway will call this service)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session and state
SESSION = DncSession()
SPOOL_DIR = Path(os.getenv("DNC_SPOOL_DIR", "./spool")).resolve()
SPOOL_DIR.mkdir(parents=True, exist_ok=True)

# === REST Endpoints ===
@app.get("/api/v1/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", version=app.version)

@app.get("/api/v1/ports")
def ports():
    return SerialManager.enumerate_ports()

@app.get("/api/v1/config", response_model=DncConfigModel)
def get_config():
    cfg = SESSION.get_config() or DncConfig()
    return DncConfigModel.from_core(cfg)

@app.put("/api/v1/config", response_model=DncConfigModel)
def set_config(cfg: DncConfigModel):
    core = cfg.to_core()
    SESSION.configure(core)
    return DncConfigModel.from_core(core)

@app.post("/api/v1/connect")
def connect():
    ok = SESSION.connect()
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to connect")
    return SimpleAck(ok=True)

@app.post("/api/v1/disconnect")
def disconnect():
    SESSION.disconnect()
    return SimpleAck(ok=True)

@app.post("/api/v1/mode")
def set_mode(update: ModeUpdate):
    cfg = SESSION.get_config() or DncConfig()
    cfg.mode = update.mode.to_core()
    SESSION.configure(cfg)
    return {"mode": update.mode.value}

@app.post("/api/v1/upload")
def upload(file: UploadFile = File(...)):
    # Save to spool dir
    import uuid
    file_id = uuid.uuid4().hex
    dest = SPOOL_DIR / f"{file_id}_{file.filename}"
    with dest.open("wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    size = dest.stat().st_size
    return {"file_id": file_id, "filename": file.filename, "size": size}

@app.post("/api/v1/send")
def send(req: SendRequest):
    # Find file by id
    candidates = list(SPOOL_DIR.glob(f"{req.file_id}_*"))
    if not candidates:
        raise HTTPException(status_code=404, detail="file_id not found")
    path = candidates[0]
    ok = SESSION.send_file(path)
    if not ok:
        raise HTTPException(status_code=500, detail="failed to start send")
    return JSONResponse(status_code=202, content={"started": True})

@app.post("/api/v1/receive")
def receive(req: ReceiveRequest):
    ok = SESSION.receive(req.output_dir)
    if not ok:
        raise HTTPException(status_code=500, detail="failed to start receive")
    return JSONResponse(status_code=202, content={"started": True})

@app.post("/api/v1/pause")
def pause():
    return {"paused": SESSION.pause()}

@app.post("/api/v1/resume")
def resume():
    return {"resumed": SESSION.resume()}

@app.post("/api/v1/stop")
def stop():
    return {"stopped": SESSION.stop()}

@app.get("/api/v1/progress", response_model=ProgressResponse)
def progress():
    return ProgressResponse(**SESSION.get_progress())

@app.get("/api/v1/state", response_model=StateResponse)
def state():
    return StateResponse(state=SESSION.get_state().value)

@app.post("/api/v1/sanitize", response_model=SanitizeResponse)
def sanitize(req: SanitizeRequest):
    clean, result = sanitize_program(req.content, req.rules or {})
    return SanitizeResponse(clean=clean, issues=result.to_dict())


# === WebSocket ===
from .ws import WsManager
ws_manager = WsManager()

@SESSION.on_event  # type: ignore[attr-defined]
def _wire_session_event(event):
    # this decorator won't work; we instead register in startup event
    pass

@app.on_event("startup")
def _startup():
    # register event forwarder
    def forward(event):
        ws_manager.broadcast_event(event)
    SESSION.on_event(forward)

@app.websocket("/api/v1/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            # optional client messages; we ignore for now
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)

