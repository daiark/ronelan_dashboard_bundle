import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    program_dir: Path
    nats_url: str
    nats_stream: str
    machine_id: str
    sender_path: str
    log_level: str


def load_config() -> Config:
    program_dir = Path(os.getenv("DNC_PROGRAM_DIR", "/var/lib/cnc-dnc/programs"))
    program_dir.mkdir(parents=True, exist_ok=True)

    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    nats_stream = os.getenv("NATS_STREAM", "DNC_PROGRESS")
    machine_id = os.getenv("MACHINE_ID", "CNC-PI-001")
    sender_path = os.getenv("HEIDENHAIN_SENDER", "/home/pi/heidenhain_sender.py")
    log_level = os.getenv("LOG_LEVEL", "info")

    return Config(
        program_dir=program_dir,
        nats_url=nats_url,
        nats_stream=nats_stream,
        machine_id=machine_id,
        sender_path=sender_path,
        log_level=log_level,
    )

