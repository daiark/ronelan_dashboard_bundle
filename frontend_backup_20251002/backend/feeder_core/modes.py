"""
DNC modes and configuration structures.

Defines the various communication modes and configuration options for CNC DNC.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any


class DncMode(Enum):
    """DNC communication modes."""
    STANDARD = "standard"       # Standard RS-232 streaming
    BCC = "bcc"                # Block check character protocol
    BCC_LISTEN = "bcc_listen"  # Listen for BCC requests from machine
    RECEIVE = "receive"        # Receive programs from machine


class Parity(Enum):
    """Serial parity options."""
    NONE = "N"
    EVEN = "E"  
    ODD = "O"
    MARK = "M"
    SPACE = "S"


class FlowControl(Enum):
    """Flow control options."""
    NONE = "None"
    RTS_CTS = "RTS/CTS"
    XON_XOFF = "XON/XOFF"


@dataclass
class SerialConfig:
    """Serial port configuration."""
    port: str = "/dev/serial0"
    baud: int = 9600
    bytesize: int = 7
    parity: Parity = Parity.EVEN
    stopbits: int = 1
    rtscts: bool = True
    xonxoff: bool = False
    timeout: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "port": self.port,
            "baud": self.baud,
            "bytesize": self.bytesize,
            "parity": self.parity.value,
            "stopbits": self.stopbits,
            "rtscts": self.rtscts,
            "xonxoff": self.xonxoff,
            "timeout": self.timeout
        }


@dataclass
class StandardModeConfig:
    """Configuration for standard mode."""
    nuls: int = 50              # NUL preamble count
    delay: float = 0.10         # Inter-line delay seconds
    wait_dc1: bool = True       # Wait for DC1 before sending
    handshake_timeout: float = 20.0
    complete_timeout: float = 10.0


@dataclass
class BccModeConfig:
    """Configuration for BCC mode."""
    retries: int = 3            # Retries per block
    delay: float = 0.10         # Inter-block delay
    dc1_after_bcc: bool = False # Send DC1 after BCC (EXT variants)
    program_name: Optional[str] = None


@dataclass
class ReceiveModeConfig:
    """Configuration for receive mode."""
    handshake_timeout: float = 20.0
    complete_timeout: float = 10.0
    dc1_to_start: bool = False  # Send DC1 to poke receiver
    output_dir: Optional[str] = None


@dataclass
class DncConfig:
    """Complete DNC configuration."""
    serial: SerialConfig
    mode: DncMode
    encoding: str = "ascii"
    eol: str = "\r\n"           # End of line: "\r", "\n", or "\r\n"
    
    # Mode-specific configurations
    standard: StandardModeConfig
    bcc: BccModeConfig
    receive: ReceiveModeConfig
    
    def __init__(self):
        self.serial = SerialConfig()
        self.mode = DncMode.STANDARD
        self.encoding = "ascii"
        self.eol = "\r\n"
        self.standard = StandardModeConfig()
        self.bcc = BccModeConfig()
        self.receive = ReceiveModeConfig()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "serial": self.serial.to_dict(),
            "mode": self.mode.value,
            "encoding": self.encoding,
            "eol": self.eol,
            "standard": {
                "nuls": self.standard.nuls,
                "delay": self.standard.delay,
                "wait_dc1": self.standard.wait_dc1,
                "handshake_timeout": self.standard.handshake_timeout,
                "complete_timeout": self.standard.complete_timeout
            },
            "bcc": {
                "retries": self.bcc.retries,
                "delay": self.bcc.delay,
                "dc1_after_bcc": self.bcc.dc1_after_bcc,
                "program_name": self.bcc.program_name
            },
            "receive": {
                "handshake_timeout": self.receive.handshake_timeout,
                "complete_timeout": self.receive.complete_timeout,
                "dc1_to_start": self.receive.dc1_to_start,
                "output_dir": self.receive.output_dir
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DncConfig':
        """Create configuration from dictionary."""
        config = cls()
        
        if "serial" in data:
            s = data["serial"]
            config.serial = SerialConfig(
                port=s.get("port", "/dev/serial0"),
                baud=s.get("baud", 9600),
                bytesize=s.get("bytesize", 7),
                parity=Parity(s.get("parity", "E")),
                stopbits=s.get("stopbits", 1),
                rtscts=s.get("rtscts", True),
                xonxoff=s.get("xonxoff", False),
                timeout=s.get("timeout", 1.0)
            )
        
        config.mode = DncMode(data.get("mode", "standard"))
        config.encoding = data.get("encoding", "ascii")
        config.eol = data.get("eol", "\r\n")
        
        if "standard" in data:
            s = data["standard"]
            config.standard = StandardModeConfig(
                nuls=s.get("nuls", 50),
                delay=s.get("delay", 0.10),
                wait_dc1=s.get("wait_dc1", True),
                handshake_timeout=s.get("handshake_timeout", 20.0),
                complete_timeout=s.get("complete_timeout", 10.0)
            )
        
        if "bcc" in data:
            b = data["bcc"]
            config.bcc = BccModeConfig(
                retries=b.get("retries", 3),
                delay=b.get("delay", 0.10),
                dc1_after_bcc=b.get("dc1_after_bcc", False),
                program_name=b.get("program_name")
            )
        
        if "receive" in data:
            r = data["receive"]
            config.receive = ReceiveModeConfig(
                handshake_timeout=r.get("handshake_timeout", 20.0),
                complete_timeout=r.get("complete_timeout", 10.0),
                dc1_to_start=r.get("dc1_to_start", False),
                output_dir=r.get("output_dir")
            )
        
        return config
