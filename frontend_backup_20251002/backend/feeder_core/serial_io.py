"""
Serial I/O manager abstraction.

Provides a thin wrapper around pyserial with a simple interface for the DncSession.
"""

from __future__ import annotations

import time
from typing import Optional

try:
    import serial
    from serial.tools import list_ports
except Exception:  # pragma: no cover
    serial = None
    list_ports = None

from .modes import SerialConfig


class SerialManager:
    """Thin serial manager around pyserial."""

    def __init__(self):
        self._cfg: Optional[SerialConfig] = None
        self._ser: Optional[serial.Serial] = None if serial else None

    @staticmethod
    def enumerate_ports():
        """Return a list of available ports with basic metadata."""
        ports = []
        if list_ports:
            for p in list_ports.comports():
                ports.append({
                    "device": p.device,
                    "name": p.name,
                    "description": p.description,
                    "hwid": p.hwid,
                    "vid": getattr(p, 'vid', None),
                    "pid": getattr(p, 'pid', None),
                    "manufacturer": getattr(p, 'manufacturer', None),
                    "product": getattr(p, 'product', None),
                    "serial_number": getattr(p, 'serial_number', None),
                })
        # Add common Raspberry Pi defaults if not present
        common = ["/dev/serial0", "/dev/ttyAMA0", "/dev/ttyUSB0", "/dev/ttyUSB1"]
        for c in common:
            if not any(item.get("device") == c for item in ports):
                ports.append({"device": c, "description": "Common serial port"})
        return ports

    def configure(self, cfg: SerialConfig) -> bool:
        """Configure serial parameters (does not open port)."""
        if not serial:
            return False
        self._cfg = cfg
        return True

    def connect(self) -> bool:
        """Open the serial port."""
        if not serial:
            raise RuntimeError("pyserial not available")
        if not self._cfg:
            raise RuntimeError("Serial config not set")

        try:
            self._ser = serial.Serial(
                port=self._cfg.port,
                baudrate=self._cfg.baud,
                bytesize=serial.SEVENBITS if self._cfg.bytesize == 7 else serial.EIGHTBITS,
                parity={
                    'N': serial.PARITY_NONE,
                    'E': serial.PARITY_EVEN,
                    'O': serial.PARITY_ODD,
                    'M': serial.PARITY_MARK,
                    'S': serial.PARITY_SPACE,
                }[self._cfg.parity.value],
                stopbits=serial.STOPBITS_ONE if self._cfg.stopbits == 1 else serial.STOPBITS_TWO,
                timeout=self._cfg.timeout,
                xonxoff=self._cfg.xonxoff,
                rtscts=self._cfg.rtscts,
                write_timeout=5,
            )
            return True
        except Exception:
            self._ser = None
            return False

    def disconnect(self) -> None:
        """Close the serial port."""
        try:
            if self._ser and self._ser.is_open:
                self._ser.close()
        finally:
            self._ser = None

    def write(self, data: bytes) -> int:
        """Write bytes to the serial port."""
        if not self._ser or not self._ser.is_open:
            raise RuntimeError("Serial port not open")
        n = self._ser.write(data)
        self._ser.flush()
        return n

    def read(self, size: int = 1) -> bytes:
        """Read bytes from the serial port."""
        if not self._ser or not self._ser.is_open:
            raise RuntimeError("Serial port not open")
        return self._ser.read(size)
