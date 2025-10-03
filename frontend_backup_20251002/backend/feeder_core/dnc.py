"""
Main DNC session orchestrator.

Provides the primary DncSession class that manages serial communication,
file transfers, and event emission for CNC DNC operations.
"""

import time
import threading
import queue
from typing import Optional, List, Callable, Union, BinaryIO
from pathlib import Path

from .events import DncEvent, DncEventType, LogLevel, DncState, EventCallback
from .modes import DncConfig, DncMode
from .serial_io import SerialManager
from .sanitize import sanitize_program, SanitizeResult


class DncSession:
    """
    Main DNC session class.
    
    Manages the complete lifecycle of DNC operations including configuration,
    connection management, file transfers, and event emission.
    """
    
    def __init__(self):
        self._config: Optional[DncConfig] = None
        self._serial: Optional[SerialManager] = None
        self._state = DncState.IDLE
        self._event_callbacks: List[EventCallback] = []
        self._transfer_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        
        # Transfer state
        self._current_file: Optional[str] = None
        self._bytes_sent = 0
        self._total_bytes = 0
        self._start_time: Optional[float] = None
        
    def configure(self, config: DncConfig) -> None:
        """Configure the DNC session."""
        if self._state != DncState.IDLE:
            raise RuntimeError("Cannot configure while session is active")
        
        self._config = config
        self._emit_log(LogLevel.INFO, "Configuration updated")
    
    def get_config(self) -> Optional[DncConfig]:
        """Get current configuration."""
        return self._config
    
    def get_state(self) -> DncState:
        """Get current session state."""
        return self._state
    
    def on_event(self, callback: EventCallback) -> None:
        """Register an event callback."""
        self._event_callbacks.append(callback)
    
    def remove_event_callback(self, callback: EventCallback) -> None:
        """Remove an event callback."""
        if callback in self._event_callbacks:
            self._event_callbacks.remove(callback)
    
    def connect(self) -> bool:
        """Connect to the serial port."""
        if not self._config:
            self._emit_error("MISSING_CONFIG", "No configuration provided")
            return False
        
        if self._state not in (DncState.IDLE, DncState.ERROR):
            self._emit_error("INVALID_STATE", f"Cannot connect from state: {self._state}")
            return False
        
        try:
            self._change_state(DncState.CONNECTING)
            
            # Create serial manager if needed
            if not self._serial:
                self._serial = SerialManager()
            
            # Configure and open serial port
            success = self._serial.configure(self._config.serial)
            if not success:
                self._change_state(DncState.ERROR)
                return False
            
            success = self._serial.connect()
            if success:
                self._change_state(DncState.CONNECTED)
                self._emit_log(LogLevel.INFO, f"Connected to {self._config.serial.port}")
                return True
            else:
                self._change_state(DncState.ERROR)
                return False
                
        except Exception as e:
            self._emit_error("CONNECT_FAILED", f"Connection failed: {str(e)}")
            self._change_state(DncState.ERROR)
            return False
    
    def disconnect(self) -> None:
        """Disconnect from serial port."""
        if self._serial:
            self._serial.disconnect()
        
        self._change_state(DncState.IDLE)
        self._emit_log(LogLevel.INFO, "Disconnected")
    
    def send_file(self, file_path: Union[str, Path], content: Optional[str] = None) -> bool:
        """
        Send a file to the CNC machine.
        
        Args:
            file_path: Path to file to send, or filename for content
            content: Optional file content (if provided, file_path is used as name only)
            
        Returns:
            True if transfer started successfully
        """
        if self._state != DncState.CONNECTED:
            self._emit_error("NOT_CONNECTED", "Must be connected to send file")
            return False
        
        if self._config.mode not in (DncMode.STANDARD, DncMode.BCC):
            self._emit_error("INVALID_MODE", f"Cannot send file in {self._config.mode} mode")
            return False
        
        try:
            # Prepare file content
            if content is not None:
                file_content = content
                self._current_file = str(file_path)
            else:
                file_path = Path(file_path)
                if not file_path.exists():
                    self._emit_error("FILE_NOT_FOUND", f"File not found: {file_path}")
                    return False
                
                with open(file_path, 'r', encoding=self._config.encoding, errors='ignore') as f:
                    file_content = f.read()
                self._current_file = str(file_path)
            
            # Sanitize content if needed
            sanitized_content, sanitize_result = sanitize_program(file_content)
            if sanitize_result.has_changes:
                self._emit_log(LogLevel.INFO, f"Applied {len(sanitize_result.changes)} sanitization changes")
            if sanitize_result.errors:
                for error in sanitize_result.errors:
                    self._emit_log(LogLevel.ERROR, f"Sanitization error: {error}")
                return False
            
            self._total_bytes = len(sanitized_content.encode(self._config.encoding))
            self._bytes_sent = 0
            self._start_time = time.time()
            
            # Start transfer thread
            self._stop_event.clear()
            self._pause_event.clear()
            
            if self._config.mode == DncMode.STANDARD:
                self._transfer_thread = threading.Thread(
                    target=self._send_standard, 
                    args=(sanitized_content,)
                )
            elif self._config.mode == DncMode.BCC:
                self._transfer_thread = threading.Thread(
                    target=self._send_bcc,
                    args=(sanitized_content,)
                )
            
            self._change_state(DncState.SENDING)
            self._transfer_thread.start()
            
            self._emit_log(LogLevel.INFO, f"Started sending {self._current_file}")
            return True
            
        except Exception as e:
            self._emit_error("SEND_FAILED", f"Failed to start file transfer: {str(e)}")
            return False
    
    def receive(self, output_dir: Optional[str] = None) -> bool:
        """
        Start receiving a file from the CNC machine.
        
        Args:
            output_dir: Directory to save received file
            
        Returns:
            True if receive started successfully
        """
        if self._state != DncState.CONNECTED:
            self._emit_error("NOT_CONNECTED", "Must be connected to receive file")
            return False
        
        if self._config.mode != DncMode.RECEIVE:
            self._emit_error("INVALID_MODE", f"Cannot receive file in {self._config.mode} mode")
            return False
        
        try:
            output_path = output_dir or self._config.receive.output_dir or "."
            
            self._stop_event.clear()
            self._transfer_thread = threading.Thread(
                target=self._receive_file,
                args=(output_path,)
            )
            
            self._change_state(DncState.RECEIVING)
            self._transfer_thread.start()
            
            self._emit_log(LogLevel.INFO, f"Started receiving to {output_path}")
            return True
            
        except Exception as e:
            self._emit_error("RECEIVE_FAILED", f"Failed to start receive: {str(e)}")
            return False
    
    def listen(self, file_to_send: Optional[str] = None) -> bool:
        """
        Start listening for BCC requests from machine.
        
        Args:
            file_to_send: Optional file to send when requested
            
        Returns:
            True if listening started successfully
        """
        if self._state != DncState.CONNECTED:
            self._emit_error("NOT_CONNECTED", "Must be connected to listen")
            return False
        
        if self._config.mode != DncMode.BCC_LISTEN:
            self._emit_error("INVALID_MODE", f"Cannot listen in {self._config.mode} mode")
            return False
        
        try:
            self._stop_event.clear()
            self._transfer_thread = threading.Thread(
                target=self._listen_bcc,
                args=(file_to_send,)
            )
            
            self._change_state(DncState.LISTENING)
            self._transfer_thread.start()
            
            self._emit_log(LogLevel.INFO, "Started listening for BCC requests")
            return True
            
        except Exception as e:
            self._emit_error("LISTEN_FAILED", f"Failed to start listening: {str(e)}")
            return False
    
    def pause(self) -> bool:
        """Pause current operation."""
        if self._state not in (DncState.SENDING, DncState.RECEIVING, DncState.LISTENING):
            return False
        
        self._pause_event.set()
        self._change_state(DncState.PAUSED)
        self._emit_log(LogLevel.INFO, "Operation paused")
        return True
    
    def resume(self) -> bool:
        """Resume paused operation."""
        if self._state != DncState.PAUSED:
            return False
        
        self._pause_event.clear()
        # Determine previous state (this is simplified - real implementation would track this)
        if self._config.mode == DncMode.STANDARD or self._config.mode == DncMode.BCC:
            self._change_state(DncState.SENDING)
        elif self._config.mode == DncMode.RECEIVE:
            self._change_state(DncState.RECEIVING) 
        elif self._config.mode == DncMode.BCC_LISTEN:
            self._change_state(DncState.LISTENING)
        
        self._emit_log(LogLevel.INFO, "Operation resumed")
        return True
    
    def stop(self) -> bool:
        """Stop current operation."""
        if self._state in (DncState.SENDING, DncState.RECEIVING, DncState.LISTENING, DncState.PAUSED):
            self._stop_event.set()
            self._pause_event.clear()  # Ensure we're not stuck in pause
            
            if self._transfer_thread and self._transfer_thread.is_alive():
                self._transfer_thread.join(timeout=5.0)
            
            self._change_state(DncState.STOPPED)
            self._emit_log(LogLevel.INFO, "Operation stopped")
            return True
        
        return False
    
    def get_progress(self) -> dict:
        """Get current transfer progress."""
        elapsed = time.time() - self._start_time if self._start_time else 0
        rate = self._bytes_sent / elapsed if elapsed > 0 else 0
        eta = (self._total_bytes - self._bytes_sent) / rate if rate > 0 else 0
        
        return {
            "bytes_sent": self._bytes_sent,
            "total_bytes": self._total_bytes,
            "rate_bps": int(rate),
            "elapsed_seconds": elapsed,
            "eta_seconds": eta,
            "percent": (self._bytes_sent / self._total_bytes * 100) if self._total_bytes > 0 else 0
        }
    
    def cleanup(self) -> None:
        """Clean up resources."""
        self.stop()
        self.disconnect()
        self._event_callbacks.clear()
    
    # Private methods
    
    def _emit_event(self, event: DncEvent) -> None:
        """Emit an event to all registered callbacks."""
        for callback in self._event_callbacks:
            try:
                callback(event)
            except Exception as e:
                # Avoid infinite recursion by not emitting error events here
                print(f"Error in event callback: {e}")
    
    def _emit_log(self, level: LogLevel, message: str, **extra) -> None:
        """Emit a log event."""
        event = DncEvent.log(level, message, **extra)
        self._emit_event(event)
    
    def _emit_error(self, code: str, message: str, **extra) -> None:
        """Emit an error event."""
        event = DncEvent.error(code, message, **extra)
        self._emit_event(event)
        self._emit_log(LogLevel.ERROR, f"[{code}] {message}")
    
    def _emit_progress(self) -> None:
        """Emit a progress event."""
        if self._total_bytes > 0:
            elapsed = time.time() - self._start_time if self._start_time else 0
            rate = self._bytes_sent / elapsed if elapsed > 0 else None
            
            event = DncEvent.progress(self._bytes_sent, self._total_bytes, int(rate) if rate else None)
            self._emit_event(event)
    
    def _change_state(self, new_state: DncState) -> None:
        """Change session state and emit state change event."""
        previous_state = self._state
        self._state = new_state
        
        event = DncEvent.state_change(new_state, previous_state)
        self._emit_event(event)
    
    # Transfer method stubs - actual implementation would be more complex
    
    def _send_standard(self, content: str) -> None:
        """Send file using standard mode (simplified implementation)."""
        try:
            if not self._serial:
                return
            
            lines = content.splitlines()
            config = self._config.standard
            
            # Send NUL preamble
            if config.nuls > 0:
                self._serial.write(b'\x00' * config.nuls)
            
            for i, line in enumerate(lines):
                if self._stop_event.is_set():
                    break
                
                # Handle pause
                while self._pause_event.is_set() and not self._stop_event.is_set():
                    time.sleep(0.1)
                
                # Send line with configured EOL
                line_bytes = (line + self._config.eol).encode(self._config.encoding, errors='ignore')
                self._serial.write(line_bytes)
                
                self._bytes_sent += len(line_bytes)
                self._emit_progress()
                
                # Inter-line delay
                if config.delay > 0:
                    time.sleep(config.delay)
            
            if not self._stop_event.is_set():
                self._emit_log(LogLevel.INFO, "Transfer completed successfully")
                self._change_state(DncState.CONNECTED)
            
        except Exception as e:
            self._emit_error("TRANSFER_ERROR", f"Transfer failed: {str(e)}")
            self._change_state(DncState.ERROR)
    
    def _send_bcc(self, content: str) -> None:
        """Send file using BCC mode (stub implementation)."""
        # This would implement the BCC block protocol
        self._emit_log(LogLevel.INFO, "BCC mode transfer not yet implemented")
        time.sleep(1)  # Simulate work
        self._change_state(DncState.CONNECTED)
    
    def _receive_file(self, output_path: str) -> None:
        """Receive file from machine (stub implementation)."""
        self._emit_log(LogLevel.INFO, "Receive mode not yet implemented")
        time.sleep(1)  # Simulate work  
        self._change_state(DncState.CONNECTED)
    
    def _listen_bcc(self, file_to_send: Optional[str]) -> None:
        """Listen for BCC requests (stub implementation)."""
        self._emit_log(LogLevel.INFO, "BCC listen mode not yet implemented")
        time.sleep(1)  # Simulate work
        self._change_state(DncState.CONNECTED)
