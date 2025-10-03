import asyncio
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.get("/events/{transfer_id}")
async def sse_events(request: Request, transfer_id: str):
    tm = request.app.state.tm
    q: asyncio.Queue = tm.get_queue(transfer_id)
    if not q:
        raise HTTPException(status_code=404, detail="Transfer not found")

    async def event_stream():
        # Heartbeat every 5 seconds
        heartbeat = 5
        while True:
            if await request.is_disconnected():
                break
            try:
                evt = await asyncio.wait_for(q.get(), timeout=heartbeat)
                yield f"event: progress\n".encode()
                import json
                yield f"data: {json.dumps(evt)}\n\n".encode()
            except asyncio.TimeoutError:
                yield b": keepalive\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

