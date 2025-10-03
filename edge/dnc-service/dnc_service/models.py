from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class TransferRequest(BaseModel):
    port: str
    file_name: str
    mode: str = Field(default="bcc_listen", pattern="^(standard|bcc|bcc_listen|receive)$")
    baud: int = 9600
    bits: int = 7
    parity: str = Field(default="E", pattern="^[NEO]$")
    stopbits: int = 2  # 7E2 default per user setup
    rtscts: bool = True
    xonxoff: bool = False
    delay: float = 0.10
    dc1_after_bcc: bool = False  # observed not required on this TNC
    machine_id: Optional[str] = None
    program_name: Optional[str] = None


class TransferStatus(BaseModel):
    transfer_id: str
    state: str  # queued|running|paused|completed|canceled|error
    port: str
    file_name: str
    line: int = 0
    lines_total: int = 0
    bytes_sent: int = 0
    rate_lps: float = 0.0
    eta_sec: Optional[float] = None
    error: Optional[str] = None


class ProgressEvent(BaseModel):
    transfer_id: str
    machine_id: str
    program_name: Optional[str]
    mode: str
    state: str
    line: int
    lines_total: int
    bytes_sent: int
    rate_lps: float
    eta_sec: Optional[float]
    event: str
    ts: str
    error: Optional[str] = None
    extra: Dict[str, Any] = {}

