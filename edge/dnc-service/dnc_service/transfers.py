import asyncio
import os
import re
import shlex
import signal
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse
from starlette.templating import Jinja2Templates

from .models import TransferRequest, TransferStatus, ProgressEvent
from .locks import port_lock
from .nats_pub import NatsPublisher

router = APIRouter()


class TransferManager:
    def __init__(self, cfg, publisher: Optional[NatsPublisher], loop: asyncio.AbstractEventLoop):
        self.cfg = cfg
        self.publisher = publisher
        self.loop = loop
        self._statuses: Dict[str, TransferStatus] = {}
        self._procs: Dict[str, subprocess.Popen] = {}
        self._queues: Dict[str, asyncio.Queue] = {}
        self._port_in_use: Dict[str, str] = {}  # port -> transfer_id

    def _program_path(self, file_name: str) -> Path:
        return self.cfg.program_dir / file_name

    def _count_lines(self, path: Path) -> int:
        try:
            with path.open("r", encoding="utf-8", errors="ignore") as f:
                return sum(1 for _ in f)
        except Exception:
            return 0

    def _build_cmd(self, req: TransferRequest, program_path: Path) -> [str]:
        args = [
            "python3",
            self.cfg.sender_path,
            req.port,
            "--mode", req.mode,
            "--file", str(program_path),
            "-b", str(req.baud),
            "--bits", str(req.bits),
            "--parity", req.parity,
            "--stopbits", str(req.stopbits),
        ]
        if req.rtscts:
            args.append("--rtscts")
        if req.xonxoff:
            args.append("--xonxoff")
        if req.dc1_after_bcc:
            args.append("--dc1-after-bcc")
        else:
            args.append("--no-dc1-after-bcc")
        if req.delay is not None:
            args += ["--delay", f"{req.delay:.2f}"]
        return args

    async def start(self, req: TransferRequest) -> str:
        program_path = self._program_path(req.file_name)
        if not program_path.exists():
            raise HTTPException(status_code=404, detail="Program file not found")

        # Lock the port
        if req.port in self._port_in_use:
            raise HTTPException(status_code=409, detail=f"Port {req.port} already in use by transfer {self._port_in_use[req.port]}")

        transfer_id = str(uuid.uuid4())
        self._port_in_use[req.port] = transfer_id
        self._queues[transfer_id] = asyncio.Queue()

        status = TransferStatus(
            transfer_id=transfer_id,
            state="queued",
            port=req.port,
            file_name=req.file_name,
            line=0,
            lines_total=self._count_lines(program_path),
            bytes_sent=0,
            rate_lps=0.0,
            eta_sec=None,
            error=None,
        )
        self._statuses[transfer_id] = status

        def _run():
            try:
                with port_lock(req.port):
                    cmd = self._build_cmd(req, program_path)
                    env = os.environ.copy()
                    env["PYTHONUNBUFFERED"] = "1"
                    start_time = time.time()
                    self._statuses[transfer_id].state = "running"
                    self.loop.call_soon_threadsafe(self._queues[transfer_id].put_nowait, {"state": "running"})
                    try:
                        proc = subprocess.Popen(
                            cmd,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True,
                            bufsize=1,
                            env=env,
                            preexec_fn=os.setsid,
                        )
                        self._procs[transfer_id] = proc
                    except Exception as e:
                        self._statuses[transfer_id].state = "error"
                        self._statuses[transfer_id].error = str(e)
                        self.loop.call_soon_threadsafe(self._queues[transfer_id].put_nowait, {"state": "error", "error": str(e)})
                        return

                    ack_re = re.compile(r"RX: ACK on (?:block\s*)?(\d+)")
                    last_line = 0
                    last_ts = start_time
                    while True:
                        line = proc.stdout.readline()
                        if not line:
                            if proc.poll() is not None:
                                break
                            time.sleep(0.05)
                            continue
                        m = ack_re.search(line)
                        if m:
                            cur = int(m.group(1))
                            self._statuses[transfer_id].line = max(self._statuses[transfer_id].line, cur)
                            now = time.time()
                            dt = max(1e-6, now - last_ts)
                            dl = self._statuses[transfer_id].line - last_line
                            self._statuses[transfer_id].rate_lps = dl / dt if dl >= 0 else 0.0
                            last_ts = now
                            last_line = self._statuses[transfer_id].line
                            # compute ETA
                            total = max(1, self._statuses[transfer_id].lines_total)
                            remaining = max(0, total - self._statuses[transfer_id].line)
                            rate = self._statuses[transfer_id].rate_lps or 0.0001
                            self._statuses[transfer_id].eta_sec = remaining / rate

                            ev = {
                                "transfer_id": transfer_id,
                                "machine_id": req.machine_id or self.cfg.machine_id,
                                "program_name": req.program_name or req.file_name,
                                "mode": req.mode,
                                "state": self._statuses[transfer_id].state,
                                "line": self._statuses[transfer_id].line,
                                "lines_total": self._statuses[transfer_id].lines_total,
                                "bytes_sent": self._statuses[transfer_id].bytes_sent,
                                "rate_lps": self._statuses[transfer_id].rate_lps,
                                "eta_sec": self._statuses[transfer_id].eta_sec,
                                "event": "ack",
                                "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            }
                            self.loop.call_soon_threadsafe(self._queues[transfer_id].put_nowait, ev)
                            if self.publisher:
                                fut = asyncio.run_coroutine_threadsafe(self.publisher.publish_event(ev), self.loop)
                                try:
                                    fut.result(timeout=2)
                                except Exception:
                                    pass
                        # Optional: parse other sender outputs for TX, EOT/ETX, etc.

                    rc = proc.poll()
                    if rc == 0:
                        self._statuses[transfer_id].state = "completed"
                        self.loop.call_soon_threadsafe(self._queues[transfer_id].put_nowait, {"state": "completed"})
                    else:
                        self._statuses[transfer_id].state = "error"
                        self._statuses[transfer_id].error = f"sender exited rc={rc}"
                        self.loop.call_soon_threadsafe(self._queues[transfer_id].put_nowait, {"state": "error", "error": self._statuses[transfer_id].error})
            finally:
                self._port_in_use.pop(req.port, None)

        threading.Thread(target=_run, daemon=True).start()
        return transfer_id

    async def cancel(self, transfer_id: str) -> None:
        proc = self._procs.get(transfer_id)
        if not proc:
            return
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            try:
                proc.terminate()
            except Exception:
                pass
        self._statuses[transfer_id].state = "canceled"
        await self._queues[transfer_id].put({"state": "canceled"})

    def get_status(self, transfer_id: str) -> Optional[TransferStatus]:
        return self._statuses.get(transfer_id)

    def get_queue(self, transfer_id: str) -> Optional[asyncio.Queue]:
        return self._queues.get(transfer_id)


def _templates() -> Jinja2Templates:
    base = Path(__file__).resolve().parent / "templates"
    return Jinja2Templates(directory=str(base))


@router.post("/dnc/transfers", response_class=HTMLResponse)
async def start_transfer(request: Request):
    tm: TransferManager = request.app.state.tm
    form = await request.form()
    # Convert form fields to appropriate types
    def as_bool(val):
        return str(val).lower() in ("1", "true", "on", "yes")
    req = TransferRequest(
        port=str(form.get("port")),
        file_name=str(form.get("file_name")),
        mode=str(form.get("mode", "drip")),
        baud=int(form.get("baud", 9600)),
        bits=int(form.get("bits", 7)),
        parity=str(form.get("parity", "E")),
        stopbits=int(form.get("stopbits", 2)),
        rtscts=as_bool(form.get("rtscts")),
        xonxoff=as_bool(form.get("xonxoff")),
        dc1_after_bcc=as_bool(form.get("dc1_after_bcc")),
        delay=float(form.get("delay", 0.10) or 0.10),
    )
    tid = await tm.start(req)
    return _templates().TemplateResponse("transfer.html", {"request": request, "transfer_id": tid})


@router.get("/dnc/transfers/{transfer_id}/status")
async def get_status(request: Request, transfer_id: str):
    tm: TransferManager = request.app.state.tm
    st = tm.get_status(transfer_id)
    if not st:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return JSONResponse(st.dict())


@router.post("/dnc/transfers/{transfer_id}/cancel")
async def cancel_transfer(request: Request, transfer_id: str):
    tm: TransferManager = request.app.state.tm
    await tm.cancel(transfer_id)
    return JSONResponse({"ok": True})

