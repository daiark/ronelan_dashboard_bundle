import hashlib
import os
from pathlib import Path
from typing import List
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from starlette.templating import Jinja2Templates

router = APIRouter()

def _templates() -> Jinja2Templates:
    base = Path(__file__).resolve().parent / "templates"
    return Jinja2Templates(directory=str(base))


def _sanitize_name(name: str) -> str:
    # Allow letters, digits, dash, underscore, dot
    import re
    s = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    if not s:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return s


def _program_dir(request: Request) -> Path:
    return request.app.state.cfg.program_dir


@router.get("/files", response_class=HTMLResponse)
async def list_files(request: Request):
    pdir = _program_dir(request)
    pdir.mkdir(parents=True, exist_ok=True)
    files: List[dict] = []
    for p in sorted(pdir.glob("*")):
        if not p.is_file():
            continue
        stat = p.stat()
        sha256 = hashlib.sha256(p.read_bytes()).hexdigest()[:12]
        files.append({
            "name": p.name,
            "size": stat.st_size,
            "mtime": int(stat.st_mtime),
            "sha": sha256,
        })
    return _templates().TemplateResponse("files.html", {"request": request, "files": files})


@router.post("/files/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    pdir = _program_dir(request)
    name = _sanitize_name(file.filename)
    data = await file.read()
    # Normalize to CRLF
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        text = data.decode("latin-1", errors="ignore")
    lines = text.splitlines()
    normalized = ("\r\n").join(lines) + "\r\n"
    (pdir / name).write_text(normalized, encoding="ascii", errors="ignore")
    return PlainTextResponse("OK")


@router.get("/files/{name}", response_class=HTMLResponse)
async def edit_file(request: Request, name: str):
    p = _program_dir(request) / _sanitize_name(name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")
    content = p.read_text(encoding="utf-8", errors="ignore")
    # show content as-is; on save we'll normalize
    return _templates().TemplateResponse("files.html", {"request": request, "files": [], "edit_name": p.name, "edit_content": content})


@router.post("/files/{name}/save")
async def save_file(request: Request, name: str, content: str = Form(...)):
    p = _program_dir(request) / _sanitize_name(name)
    lines = content.splitlines()
    normalized = ("\r\n").join(lines) + "\r\n"
    p.write_text(normalized, encoding="ascii", errors="ignore")
    return PlainTextResponse("OK")

