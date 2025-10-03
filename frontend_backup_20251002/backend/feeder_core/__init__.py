"""
DNC Feeder Core Library

A pure Python library for CNC DNC communication extracted from the PySide6 GUI.
Provides headless operation suitable for web services and automation.
"""

from .dnc import DncSession
from .events import DncEvent, DncEventType, LogLevel
from .modes import DncMode, DncConfig
from .sanitize import sanitize_program_preview, apply_sanitize_in_text

__version__ = "1.0.0"
__all__ = [
    "DncSession",
    "DncEvent", 
    "DncEventType",
    "LogLevel",
    "DncMode",
    "DncConfig",
    "sanitize_program_preview",
    "apply_sanitize_in_text"
]
