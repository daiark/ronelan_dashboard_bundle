import asyncio
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

import asyncio
import nats
import uuid
from typing import Dict, Any

from .config import load_config
from .nats_pub import NatsPublisher
from .ports import router as ports_router, list_ports
from .files import router as files_router
from .transfers import router as transfers_router, TransferManager, TransferRequest
from .progress import router as progress_router


def _templates() -> Jinja2Templates:
    base = Path(__file__).resolve().parent / "templates"
    return Jinja2Templates(directory=str(base))


app = FastAPI(title="CNC DNC Service")

# static (optional if you add local assets)
static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# basic health endpoint for API clients
@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "cnc-dnc", "version": "0.1.0"}


@app.on_event("startup")
async def startup():
    cfg = load_config()
    app.state.cfg = cfg
    # NATS
    try:
        nc = await nats.connect(cfg.nats_url)
        js = nc.jetstream()
        app.state.nc = nc
        app.state.js = js
        app.state.publisher = NatsPublisher(js, cfg.nats_stream, cfg.machine_id)
    except Exception:
        app.state.nc = None
        app.state.js = None
        app.state.publisher = None
    # Transfer manager and runtime state
    loop = asyncio.get_event_loop()
    app.state.tm = TransferManager(cfg, app.state.publisher, loop)
    app.state.connected = False
    app.state.current_cfg: Dict[str, Any] = {
        "serial": {
            "port": "/dev/serial0",
            "baud": 9600,
            "bytesize": 7,
            "parity": "E",
            "stopbits": 2,
            "rtscts": False,
            "xonxoff": True,
            "timeout": 1.0,
        },
        "mode": {"value": "bcc_listen"},
    }
    app.state.files: Dict[str, str] = {}
    app.state.current_transfer_id = None
    app.state.ws_clients: Dict[int, WebSocket] = {}


@app.on_event("shutdown")
async def shutdown():
    # Close NATS
    nc = getattr(app.state, "nc", None)
    if nc is not None:
        await nc.drain()
        await nc.close()


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    ports = list_ports()
    pdir = request.app.state.cfg.program_dir
    files = [p.name for p in pdir.glob("*") if p.is_file()]
    return _templates().TemplateResponse("dashboard.html", {"request": request, "ports": ports, "files": files})

# Minimal DNC Feeder API for frontend compatibility
@app.get("/api/v1/config")
async def get_config():
    return app.state.current_cfg

@app.put("/api/v1/config")
async def set_config(cfg: Dict[str, Any]):
    app.state.current_cfg = cfg
    return cfg

@app.post("/api/v1/connect")
async def connect_dev():
    app.state.connected = True
    return {"ok": True}

@app.post("/api/v1/disconnect")
async def disconnect_dev():
    app.state.connected = False
    return {"ok": True}

@app.post("/api/v1/mode")
async def set_mode(body: Dict[str, Any]):
    if "mode" in body:
        app.state.current_cfg["mode"] = body["mode"]
    return {"mode": app.state.current_cfg.get("mode", {"value": "standard"})["value"]}

@app.post("/api/v1/upload")
async def upload_compat(request: Request):
    form = await request.form()
    up = form.get("file")
    if up is None:
        return JSONResponse({"detail": "file missing"}, status_code=400)
    data = await up.read()
    fn = up.filename or f"PROGRAM_{uuid.uuid4().hex}.H"
    # normalize CRLF
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        text = data.decode("latin-1", errors="ignore")
    normalized = ("\r\n").join(text.splitlines()) + "\r\n"
    p = app.state.cfg.program_dir / fn
    p.write_text(normalized, encoding="ascii", errors="ignore")
    fid = uuid.uuid4().hex
    app.state.files[fid] = fn
    return {"file_id": fid, "filename": fn, "size": len(normalized.encode("ascii", errors="ignore"))}

@app.post("/api/v1/send")
async def send_compat(body: Dict[str, Any]):
    fid = body.get("file_id")
    if not fid or fid not in app.state.files:
        return JSONResponse({"detail": "file_id not found"}, status_code=404)
    fn = app.state.files[fid]
    cfg = app.state.current_cfg
    serial = cfg.get("serial", {})
    mode = cfg.get("mode", {}).get("value", "bcc_listen")
    req = TransferRequest(
        port=str(serial.get("port", "/dev/serial0")),
        file_name=fn,
        mode=str(mode),
        baud=int(serial.get("baud", 9600)),
        bits=int(serial.get("bytesize", 7)),
        parity=str(serial.get("parity", "E")),
        stopbits=int(serial.get("stopbits", 2)),
        rtscts=bool(serial.get("rtscts", False)),
        xonxoff=bool(serial.get("xonxoff", True)),
        dc1_after_bcc=False,
        delay=float(cfg.get("bcc", {}).get("delay", 0.10)) if isinstance(cfg.get("bcc"), dict) else 0.10,
    )
    tid = await app.state.tm.start(req)
    app.state.current_transfer_id = tid
    return JSONResponse({"started": True}, status_code=202)

@app.get("/api/v1/progress")
async def progress_compat():
    tid = app.state.current_transfer_id
    if not tid:
        return {"bytes_sent": 0, "total_bytes": 0, "rate_bps": 0, "elapsed_seconds": 0, "eta_seconds": 0, "percent": 0}
    st = app.state.tm.get_status(tid)
    if not st:
        return {"bytes_sent": 0, "total_bytes": 0, "rate_bps": 0, "elapsed_seconds": 0, "eta_seconds": 0, "percent": 0}
    return {
        "bytes_sent": st.bytes_sent or 0,
        "total_bytes": (st.lines_total or 0) * 80,  # rough estimate
        "rate_bps": int((st.rate_lps or 0) * 80),
        "elapsed_seconds": 0,
        "eta_seconds": st.eta_sec or 0,
        "percent": 0 if not st.lines_total else min(100, int((st.line / max(1, st.lines_total)) * 100)),
    }

@app.get("/api/v1/state")
async def state_compat():
    if app.state.current_transfer_id:
        st = app.state.tm.get_status(app.state.current_transfer_id)
        if st and st.state in ("running", "queued"):
            return {"state": "sending"}
    return {"state": "connected" if app.state.connected else "idle"}

# Minimal WebSocket for connection indicator
@app.websocket("/api/v1/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    cid = id(ws)
    app.state.ws_clients[cid] = ws
    try:
        # Notify connected
        await ws.send_text('{"type":"state","state":"connected","ts":0}')
        # Keepalive loop
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=10.0)
            except asyncio.TimeoutError:
                await ws.send_text('{"type":"log","level":"info","msg":"keepalive"}')
                continue
    except WebSocketDisconnect:
        pass
    finally:
        app.state.ws_clients.pop(cid, None)


# Routers (mount both at root and under /api/v1 for compatibility)
app.include_router(ports_router)
app.include_router(files_router)
app.include_router(transfers_router)
app.include_router(progress_router)

app.include_router(ports_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")
app.include_router(transfers_router, prefix="/api/v1")
app.include_router(progress_router, prefix="/api/v1")

