from __future__ import annotations

from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

# Import core enums and types via adapters
try:
    from backend.feeder_core.modes import DncConfig as CoreDncConfig, DncMode as CoreDncMode, SerialConfig as CoreSerialConfig
except Exception:
    from backend.feeder_core.modes import DncConfig as CoreDncConfig, DncMode as CoreDncMode, SerialConfig as CoreSerialConfig  # type: ignore


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class SerialConfigModel(BaseModel):
    port: str = "/dev/serial0"
    baud: int = 9600
    bytesize: int = 7
    parity: Literal["N", "E", "O", "M", "S"] = "E"
    stopbits: int = 1
    rtscts: bool = True
    xonxoff: bool = False
    timeout: float = 1.0

    @classmethod
    def from_core(cls, c: CoreSerialConfig) -> "SerialConfigModel":
        return cls(
            port=c.port, baud=c.baud, bytesize=c.bytesize, parity=c.parity.value,
            stopbits=c.stopbits, rtscts=c.rtscts, xonxoff=c.xonxoff, timeout=c.timeout
        )

    def to_core(self) -> CoreSerialConfig:
        return CoreSerialConfig(
            port=self.port, baud=self.baud, bytesize=self.bytesize, parity=self.parity,
            stopbits=self.stopbits, rtscts=self.rtscts, xonxoff=self.xonxoff, timeout=self.timeout
        )


class StandardConfigModel(BaseModel):
    nuls: int = 50
    delay: float = 0.10
    wait_dc1: bool = True
    handshake_timeout: float = 20.0
    complete_timeout: float = 10.0


class BccConfigModel(BaseModel):
    retries: int = 3
    delay: float = 0.10
    dc1_after_bcc: bool = False
    program_name: Optional[str] = None


class ReceiveConfigModel(BaseModel):
    handshake_timeout: float = 20.0
    complete_timeout: float = 10.0
    dc1_to_start: bool = False
    output_dir: Optional[str] = None


class DncModeModel(BaseModel):
    value: Literal["standard", "bcc", "bcc_listen", "receive"]

    def to_core(self) -> CoreDncMode:
        return CoreDncMode(self.value)


class DncConfigModel(BaseModel):
    serial: SerialConfigModel = Field(default_factory=SerialConfigModel)
    mode: DncModeModel = Field(default_factory=lambda: DncModeModel(value="standard"))
    encoding: str = "ascii"
    eol: Literal["\r", "\n", "\r\n"] = "\r\n"
    standard: StandardConfigModel = Field(default_factory=StandardConfigModel)
    bcc: BccConfigModel = Field(default_factory=BccConfigModel)
    receive: ReceiveConfigModel = Field(default_factory=ReceiveConfigModel)

    @classmethod
    def from_core(cls, cfg: CoreDncConfig) -> "DncConfigModel":
        return cls(
            serial=SerialConfigModel.from_core(cfg.serial),
            mode=DncModeModel(value=cfg.mode.value),
            encoding=cfg.encoding,
            eol=cfg.eol,
            standard=StandardConfigModel(
                nuls=cfg.standard.nuls,
                delay=cfg.standard.delay,
                wait_dc1=cfg.standard.wait_dc1,
                handshake_timeout=cfg.standard.handshake_timeout,
                complete_timeout=cfg.standard.complete_timeout,
            ),
            bcc=BccConfigModel(
                retries=cfg.bcc.retries,
                delay=cfg.bcc.delay,
                dc1_after_bcc=cfg.bcc.dc1_after_bcc,
                program_name=cfg.bcc.program_name,
            ),
            receive=ReceiveConfigModel(
                handshake_timeout=cfg.receive.handshake_timeout,
                complete_timeout=cfg.receive.complete_timeout,
                dc1_to_start=cfg.receive.dc1_to_start,
                output_dir=cfg.receive.output_dir,
            ),
        )

    def to_core(self) -> CoreDncConfig:
        cfg = CoreDncConfig()
        cfg.serial = self.serial.to_core()
        cfg.mode = self.mode.to_core()
        cfg.encoding = self.encoding
        cfg.eol = self.eol
        # standard
        cfg.standard.nuls = self.standard.nuls
        cfg.standard.delay = self.standard.delay
        cfg.standard.wait_dc1 = self.standard.wait_dc1
        cfg.standard.handshake_timeout = self.standard.handshake_timeout
        cfg.standard.complete_timeout = self.standard.complete_timeout
        # bcc
        cfg.bcc.retries = self.bcc.retries
        cfg.bcc.delay = self.bcc.delay
        cfg.bcc.dc1_after_bcc = self.bcc.dc1_after_bcc
        cfg.bcc.program_name = self.bcc.program_name
        # receive
        cfg.receive.handshake_timeout = self.receive.handshake_timeout
        cfg.receive.complete_timeout = self.receive.complete_timeout
        cfg.receive.dc1_to_start = self.receive.dc1_to_start
        cfg.receive.output_dir = self.receive.output_dir
        return cfg


class ModeUpdate(BaseModel):
    mode: DncModeModel


class SendRequest(BaseModel):
    file_id: str


class ReceiveRequest(BaseModel):
    output_dir: Optional[str] = None


class SimpleAck(BaseModel):
    ok: bool


class StateResponse(BaseModel):
    state: str


class ProgressResponse(BaseModel):
    bytes_sent: int
    total_bytes: int
    rate_bps: int
    elapsed_seconds: float
    eta_seconds: float
    percent: float


class SanitizeRequest(BaseModel):
    content: str
    rules: Optional[Dict[str, Any]] = None


class SanitizeResponse(BaseModel):
    clean: str
    issues: Dict[str, Any]

