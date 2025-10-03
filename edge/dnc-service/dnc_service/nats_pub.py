import json
from typing import Any, Dict


class NatsPublisher:
    def __init__(self, js, stream: str, machine_id: str):
        self.js = js
        self.stream = stream
        self.machine_id = machine_id

    async def publish_event(self, payload: Dict[str, Any]):
        subject = f"{self.stream}.{payload.get('machine_id', self.machine_id)}"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        await self.js.publish(subject, data)

