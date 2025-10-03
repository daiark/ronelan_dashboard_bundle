"""
Event system for DNC communication.

Provides structured events for logging, progress tracking, state changes, and errors.
"""

import time
from enum import Enum, auto
from dataclasses import dataclass
from typing import Optional, Dict, Any, Callable


class DncEventType(Enum):
    """Event types emitted by DNC operations."""
    LOG = auto()
    PROGRESS = auto()
    STATE_CHANGE = auto()
    ERROR = auto()


class LogLevel(Enum):
    """Log message levels."""
    DEBUG = "debug"
    INFO = "info" 
    WARNING = "warning"
    ERROR = "error"


class DncState(Enum):
    """DNC operation states."""
    IDLE = "idle"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    SENDING = "sending"
    PAUSED = "paused"
    RECEIVING = "receiving"
    LISTENING = "listening"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class DncEvent:
    """Structure for DNC events."""
    event_type: DncEventType
    timestamp: float
    data: Dict[str, Any]
    
    @classmethod
    def log(cls, level: LogLevel, message: str, **extra) -> 'DncEvent':
        """Create a log event."""
        return cls(
            event_type=DncEventType.LOG,
            timestamp=time.time(),
            data={
                "level": level.value,
                "message": message,
                **extra
            }
        )
    
    @classmethod
    def progress(cls, bytes_sent: int, total_bytes: int, rate_bps: Optional[int] = None) -> 'DncEvent':
        """Create a progress event."""
        return cls(
            event_type=DncEventType.PROGRESS,
            timestamp=time.time(),
            data={
                "bytes_sent": bytes_sent,
                "total_bytes": total_bytes,
                "rate_bps": rate_bps,
                "percent": (bytes_sent / total_bytes * 100) if total_bytes > 0 else 0
            }
        )
    
    @classmethod
    def state_change(cls, new_state: DncState, previous_state: Optional[DncState] = None) -> 'DncEvent':
        """Create a state change event."""
        return cls(
            event_type=DncEventType.STATE_CHANGE,
            timestamp=time.time(),
            data={
                "state": new_state.value,
                "previous_state": previous_state.value if previous_state else None
            }
        )
    
    @classmethod
    def error(cls, code: str, message: str, **extra) -> 'DncEvent':
        """Create an error event."""
        return cls(
            event_type=DncEventType.ERROR,
            timestamp=time.time(),
            data={
                "code": code,
                "message": message,
                **extra
            }
        )


# Type alias for event handlers
EventCallback = Callable[[DncEvent], None]
