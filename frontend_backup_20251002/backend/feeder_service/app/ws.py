from __future__ import annotations

import json
import asyncio
from typing import List
from fastapi import WebSocket

try:
    from backend.feeder_core.events import DncEvent, DncEventType
except Exception:
    from backend.feeder_core.events import DncEvent, DncEventType  # type: ignore


class WsManager:
    """Manages WebSocket clients and broadcasts events."""

    def __init__(self):
        self._clients: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._clients.append(ws)

    def disconnect(self, ws: WebSocket):
        try:
            self._clients.remove(ws)
        except ValueError:
            pass

    def broadcast_event(self, event: DncEvent):
        # Convert core event to WS JSON message
        payload = self._event_to_json(event)
        # Fire-and-forget tasks
        for ws in list(self._clients):
            asyncio.create_task(self._safe_send(ws, payload))

    async def _safe_send(self, ws: WebSocket, payload: str):
        try:
            await ws.send_text(payload)
        except Exception:
            # On failure, drop the client
            self.disconnect(ws)

    def _event_to_json(self, event: DncEvent) -> str:
        et = event.event_type
        data = {"ts": event.timestamp}
        if et == DncEventType.LOG:
            data.update({
                "type": "log",
                "level": event.data.get("level", "info"),
                "msg": event.data.get("message", ""),
            })
        elif et == DncEventType.PROGRESS:
            data.update({
                "type": "progress",
                "bytes": event.data.get("bytes_sent", 0),
                "total": event.data.get("total_bytes", 0),
                "rate_bps": event.data.get("rate_bps"),
                "percent": event.data.get("percent", 0),
            })
        elif et == DncEventType.STATE_CHANGE:
            data.update({
                "type": "state",
                "state": event.data.get("state", "unknown"),
            })
        elif et == DncEventType.ERROR:
            data.update({
                "type": "error",
                "code": event.data.get("code", "UNKNOWN"),
                "message": event.data.get("message", ""),
            })
        else:
            data.update({"type": "unknown", **event.data})
        return json.dumps(data)

