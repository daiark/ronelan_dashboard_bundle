#!/usr/bin/env python3
"""
heidenhain_sender.py — Unified sender for TNC 407/410

Supports:
- Standard file transfer (to TNC memory) -> mode=standard
- Drip-feed (EXT1 continuous execution) -> mode=drip

Protocol decisions grounded in HEIDENHAIN manuals:
- EXT1/FE modes require 7 data bits, even parity, 2 stop bits (7-E-2)
- Drip-feed uses TNC-initiated BCC protocol with <SOH>H<name>E<ETB>BCC
- Flow control: software XON/XOFF (DC1/DC3), NOT hardware RTS/CTS by default
- Line ending: CRLF (<CR><LF>)
- End of program: <ETX> (TNC may send <EOT> after)
- BCC = XOR of all bytes in block (including STX/SOH and ETB)

TNC 410 is functionally identical to TNC 407 (LE 407 logic unit) per 599456-02-A-02.pdf.
"""

import argparse
import os
import sys
import time
from typing import Optional, Tuple

import serial

# Control characters (per HEIDENHAIN manuals)
NUL = b"\x00"
SOH = b"\x01"
STX = b"\x02"
ETX = b"\x03"
EOT = b"\x04"
ACK = b"\x06"
DC1 = b"\x11"  # XON
DC3 = b"\x13"  # XOFF
ETB = b"\x17"  # End of block
NAK = b"\x15"


def compute_bcc(block: bytes) -> int:
    """XOR all bytes in block (including SOH/STX and ETB)."""
    bcc = 0
    for b in block:
        bcc ^= b
    return bcc & 0xFF


def open_serial(args) -> serial.Serial:
    bytesize = serial.SEVENBITS if args.bits == 7 else serial.EIGHTBITS
    parity_map = {"N": serial.PARITY_NONE, "E": serial.PARITY_EVEN, "O": serial.PARITY_ODD}
    parity = parity_map[args.parity]
    stopbits = serial.STOPBITS_ONE if args.stopbits == 1 else serial.STOPBITS_TWO
    return serial.Serial(
        port=args.port,
        baudrate=args.baud,
        bytesize=bytesize,
        parity=parity,
        stopbits=stopbits,
        timeout=0.2,
        xonxoff=args.xonxoff,
        rtscts=args.rtscts,
        dsrdtr=False,
        write_timeout=2,
    )


def wait_for(ser: serial.Serial, targets: bytes, timeout: float) -> Optional[int]:
    end = time.time() + timeout
    while time.time() < end:
        if ser.in_waiting:
            b = ser.read(1)
            if b in [bytes([t]) for t in targets]:
                return b[0]
        time.sleep(0.01)
    return None


def drain_xonxoff(ser: serial.Serial, pause_state: dict):
    """Handle DC1/DC3 flow control."""
    while ser.in_waiting:
        b = ser.read(1)
        if b == DC3:
            pause_state["paused"] = True
        elif b == DC1:
            pause_state["paused"] = False


# ========================
# STANDARD FILE TRANSFER
# ========================

def send_standard(args):
    ser = open_serial(args)
    print(f"Standard mode: {args.port} @ {args.baud} {args.bits}{args.parity}{args.stopbits}")
    print(f"Flow: XON/XOFF={args.xonxoff}, RTS/CTS={args.rtscts}")

    if not args.no_wait:
        print("Waiting for DC1 (XON) from TNC...")
        if wait_for(ser, b"\x11", args.handshake_timeout)!= 0x11:
            ser.close()
            raise TimeoutError("No DC1 received. Ensure TNC is in RECEIVE FILE mode.")
        print("Got DC1 — sending file")

    # Send preamble
    ser.write(NUL * args.nuls)
    ser.flush()
    print(f"Sent {args.nuls} NULs")

    pause = {"paused": False}
    with open(args.file, "r", encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f, 1):
            drain_xonxoff(ser, pause)
            while pause["paused"]:
                time.sleep(0.01)
                drain_xonxoff(ser, pause)
            payload = line.rstrip("\n").encode("ascii", errors="ignore") + b"\r\n"
            ser.write(payload)
            ser.flush()
            if args.verbose:
                print(f"Line {i}: {payload!r}")

    ser.write(ETX)
    ser.flush()
    print("Sent ETX")

    if wait_for(ser, b"\x04", args.complete_timeout) == 0x04:
        print("Received EOT — transfer complete")
    else:
        print("Warning: EOT not received (timeout)")

    ser.close()


# ========================
# DRIP-FEED (EXT1 MODE)
# ========================

def recv_bcc_header(ser: serial.Serial, timeout: float) -> Tuple[bool, str, str, str, bool]:
    """Wait for <SOH> X NAME Y <ETB> BCC from TNC."""
    end = time.time() + timeout
    hdr = bytearray()
    got_soh = False
    while time.time() < end:
        if ser.in_waiting:
            b = ser.read(1)
            if not got_soh:
                if b == SOH:
                    got_soh = True
                    hdr.append(b[0])
            else:
                hdr.append(b[0])
                if b == ETB:
                    break
        time.sleep(0.01)
    else:
        return False, "", "", "", False

    bcc_byte = ser.read(1)
    if not bcc_byte:
        return False, "", "", "", False
    bcc_recv = bcc_byte[0]

    # Check for optional DC1
    had_dc1 = False
    time.sleep(0.01)
    if ser.in_waiting and ser.read(1) == DC1:
        had_dc1 = True

    if compute_bcc(bytes(hdr))!= bcc_recv:
        return False, "", "", "", had_dc1

    try:
        code1 = chr(hdr[1]) if len(hdr) > 1 else ""
        code2 = chr(hdr[-2]) if len(hdr) >= 2 else ""
        name = bytes(hdr[2:-2]).decode("ascii", errors="ignore") if len(hdr) > 4 else ""
        return True, code1, name, code2, had_dc1
    except Exception:
        return False, "", "", "", had_dc1


def send_block_with_bcc(
    ser: serial.Serial,
    framed: bytes,
    retries: int,
    desc: str,
    send_dc1: bool,
    ack_timeout: float,
    delay: float,
    xonxoff: bool,
) -> bool:
    pause = {"paused": False}
    for attempt in range(1, retries + 1):
        if xonxoff:
            drain_xonxoff(ser, pause)
            while pause["paused"]:
                time.sleep(0.01)
                drain_xonxoff(ser, pause)

        ser.write(framed)
        ser.flush()
        if send_dc1:
            ser.write(DC1)
            ser.flush()

        resp = wait_for(ser, b"\x06\x15", ack_timeout)
        if resp == 0x06:
            if delay:
                time.sleep(delay)
            return True
        elif resp == 0x15:
            print(f"NAK on {desc}, retry {attempt}/{retries}")
        else:
            print(f"ACK timeout on {desc}, retry {attempt}/{retries}")
        if delay:
            time.sleep(delay)
    return False


def send_drip(args):
    ser = open_serial(args)
    print(f"Drip-feed mode: {args.port} @ {args.baud} {args.bits}{args.parity}{args.stopbits}")
    print(f"Flow: XON/XOFF={args.xonxoff}, RTS/CTS={args.rtscts}")

    # Wait for TNC header
    print("Waiting for TNC BCC header...")
    ok, c1, name, c2, had_dc1 = recv_bcc_header(ser, args.handshake_timeout)
    if not ok:
        ser.close()
        raise TimeoutError("No valid BCC header. Ensure TNC is in PROGRAM RUN -> EXT1 and program selected.")
    print(f"Header: {c1} '{name}' {c2} | DC1_after={had_dc1}")

    # Auto-detect DC1-after-BCC if enabled
    send_dc1 = had_dc1 if args.auto_dc1_after_bcc else args.dc1_after_bcc
    print(f"DC1-after-BCC: {'enabled' if send_dc1 else 'disabled'}")

    ser.write(ACK)
    ser.flush()
    print("Sent ACK")

    # Stream blocks
    with open(args.file, "r", encoding="utf-8", errors="ignore") as f:
        for ln, line in enumerate(f, 1):
            data = line.rstrip("\n").encode("ascii", errors="ignore") + b"\r\n"
            body = STX + data + ETB
            bcc = compute_bcc(body)
            framed = body + bytes([bcc])
            if not send_block_with_bcc(
                ser, framed, args.retries, f"block {ln}",
                send_dc1, args.ack_timeout, args.delay, args.xonxoff
            ):
                ser.close()
                raise RuntimeError(f"Block {ln} failed after {args.retries} retries")
            if args.verbose:
                preview = data.decode("ascii", errors="ignore").rstrip()
                print(f"Block {ln}: {preview[:50]}...")

    ser.write(ETX)
    ser.flush()
    print("Sent ETX")

    # Wait for TNC EOT (do not send EOT ourselves in drip mode)
    if wait_for(ser, b"\x04", args.complete_timeout) == 0x04:
        print("Received EOT — drip-feed complete")
    else:
        print("Note: EOT not received (normal if program still running)")

    ser.close()


# ========================
# MAIN
# ========================

def main():
    ap = argparse.ArgumentParser(description="Heidenhain TNC 407/410 sender")
    ap.add_argument("port")
    ap.add_argument("--file", required=True)
    ap.add_argument("--mode", choices=["standard", "drip"], default="standard")
    ap.add_argument("-b", "--baud", type=int, default=9600)
    ap.add_argument("--bits", type=int, choices=[7, 8], default=7)
    ap.add_argument("--parity", choices=["N", "E", "O"], default="E")
    ap.add_argument("--stopbits", type=int, choices=[1, 2], default=2)
    ap.add_argument("--xonxoff", action="store_true", default=True)
    ap.add_argument("--rtscts", action="store_true", default=False)
    ap.add_argument("--verbose", action="store_true")

    # Standard mode options
    ap.add_argument("--nuls", type=int, default=3)
    ap.add_argument("--no-wait", action="store_true")

    # Drip mode options
    ap.add_argument("--retries", type=int, default=5, help="Number of retries for failed blocks")
    ap.add_argument("--dc1-after-bcc", action="store_true", default=False)
    ap.add_argument("--auto-dc1-after-bcc", action="store_true")
    ap.add_argument("--ack-timeout", type=float, default=30.0)
    ap.add_argument("--handshake-timeout", type=float, default=20.0)
    ap.add_argument("--complete-timeout", type=float, default=30.0)
    ap.add_argument("--delay", type=float, default=0.0)

    args = ap.parse_args()

    try:
        if args.mode == "standard":
            send_standard(args)
        elif args.mode == "drip":
            send_drip(args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
