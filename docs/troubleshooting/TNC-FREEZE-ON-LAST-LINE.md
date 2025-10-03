# TNC 410 Freezing on Last Line - Troubleshooting Guide

**Date:** 2025-10-03  
**Status:** 🔴 OPEN ISSUE  
**Severity:** HIGH  
**Context:** Web UI drip-feed transfer successful but TNC freezes when processing final line

---

## Symptom

During drip-feed transmission via Web UI, the TNC successfully receives all program blocks (34 lines for BOR2.H) but **freezes when loading the last line** (line 33: "END PGM BOR2 MM").

### Observed Behavior

- ✅ All blocks transmitted successfully (Block 1-34)
- ✅ Web UI shows transfer progress
- ✅ No transmission errors or BCC failures
- ❌ TNC freezes on final line
- ❌ Requires power cycle or manual intervention to recover

---

## Diagnostic Questions

To pinpoint the root cause, we need to determine:

### 1. TNC Screen State When Frozen

**Question:** When you say "froze when loading the last line", what exactly does the TNC screen show?

**Options:**
- [ ] **A.** Shows line 33 "END PGM BOR2 MM" but is unresponsive
- [ ] **B.** Stuck on line 32, trying to load line 33
- [ ] **C.** Shows "Waiting for data..." message
- [ ] **D.** Shows an error message (specify: _____________)
- [ ] **E.** Blank screen or garbled display
- [ ] **F.** Other: _____________

### 2. TNC Mode State

**Question:** What is the TNC state when frozen?

**Check:**
- [ ] Still in EXT1 mode
- [ ] Reverted to another mode
- [ ] Mode indicator not visible/responsive
- [ ] Error state indicator

### 3. TNC Responsiveness

**Question:** Can you interact with the TNC when frozen?

**Test:**
- [ ] **A.** Completely unresponsive - no buttons work
- [ ] **B.** Can press STOP/CANCEL to exit
- [ ] **C.** Can navigate menus but program won't execute
- [ ] **D.** Only power cycle recovers it

### 4. Web UI Final Status

**Question:** What does the Web UI show when the TNC freezes?

**Check:**
- [ ] Progress: ___% (specify percentage)
- [ ] Status: "Transfer Complete" or "Sending"
- [ ] Blocks: ___/34 completed
- [ ] Any error messages?

### 5. Timing of Freeze

**Question:** When exactly does the freeze occur?

**Timeline:**
- [ ] **A.** Immediately after receiving line 33
- [ ] **B.** After a delay (how long? ___ seconds)
- [ ] **C.** During "END PGM" line processing
- [ ] **D.** After sender sends ETX

---

## Potential Root Causes

### A. Missing Final ETX Acknowledgment

**Theory:** Sender sends ETX but TNC expects additional control sequence.

**Technical Details:**
```python
# heidenhain_sender.py lines 258-266
ser.write(ETX)
ser.flush()
print("Sent ETX")

# Wait for TNC EOT (do not send EOT ourselves in drip mode)
if wait_for(ser, b"\x04", args.complete_timeout) == 0x04:
    print("Received EOT — drip-feed complete")
else:
    print("Note: EOT not received (normal if program still running)")
```

**Possible Issues:**
- TNC expects DC1 (XON) after ETX
- TNC expects ACK after final block before ETX
- ETX timing is too fast after last block

**Test:** Add delay before ETX or send DC1 after ETX

---

### B. TNC Waiting for EOT That Never Comes

**Theory:** TNC expects explicit EOT (0x04) from sender to close transfer.

**Current Behavior:**
- Sender sends ETX (0x03) - End of Text
- Sender **waits** for EOT from TNC
- TNC might be waiting for EOT from sender instead

**EOT Protocol Differences:**
- **Standard mode:** TNC sends EOT after receiving ETX
- **Drip mode:** EOT behavior might be reversed or not required

**Test:** 
1. Send EOT explicitly after ETX
2. Check if timeout in `complete_timeout` (default 30s) is happening

---

### C. "END PGM" Line Special Handling

**Theory:** The last line "END PGM BOR2 MM" requires special processing by TNC.

**Considerations:**
- TNC might validate program structure on END PGM
- May need to wait for program compilation/verification
- Could be waiting for operator confirmation
- Might expect different termination for program vs blocks

**Test:** Try a program without formal END PGM statement

---

### D. Missing Final Block ACK

**Theory:** Sender doesn't properly ACK the END PGM block.

**Transfer Flow:**
```
Block 33 (END PGM):
  TNC → Sender: <STX>END PGM BOR2 MM<CR><LF><ETB><BCC>
  Sender → TNC: ACK  ← Might be missing or wrong
  
Final Sequence:
  Sender → TNC: ETX
  TNC → Sender: EOT  ← TNC frozen waiting for this?
```

**Current regex in transfers.py:**
```python
ack_re = re.compile(r"RX: ACK on (?:block\s*)?(\d+)")
```

**Problem:** Sender outputs "Block 34:" but regex looks for "RX: ACK"
- Progress tracking broken
- Might affect final ACK handling

**Test:** Check if sender actually sends ACK for block 34

---

### E. DC1/DC3 Flow Control Issues

**Theory:** XON/XOFF flow control confusion at end of transmission.

**Scenario:**
1. TNC sends DC3 (XOFF) before processing END PGM
2. Sender pauses transmission
3. TNC freezes before sending DC1 (XON)
4. Deadlock

**Current Setting:** `xonxoff=True` (enabled)

**Test:** Try `--xonxoff` disabled for drip mode

---

### F. Timeout in EOT Wait

**Theory:** Sender times out waiting for EOT, exits, but TNC still processing.

**Timeout Settings:**
```python
--complete-timeout 30.0  # Default 30 seconds
```

**Scenario:**
1. Sender sends ETX
2. Waits 30s for EOT
3. Times out and exits
4. TNC still processing, expects more data
5. TNC freezes when sender connection closes

**Test:** Increase timeout or check sender exit behavior

---

## Comparison with Manual Command Success

### Working Manual Command
```bash
python3 /home/pi/heidenhain_sender.py /dev/ttyAMA0 \
  --mode drip \
  --file /home/pi/BOR2.H \
  --auto-dc1-after-bcc \
  --delay 0.05 \
  --verbose
```

**Result:** ✅ All 34 blocks transmitted, "Sent ETX" output, completed successfully

**Key Question:** Did the TNC also freeze when using the manual command, or did it complete normally?

- [ ] Manual command: TNC completed normally
- [ ] Manual command: TNC also froze (same issue)
- [ ] Don't remember / didn't observe

---

## Web UI Command Differences

**Web UI executes:**
```bash
python3 /home/pi/heidenhain_sender.py /dev/ttyAMA0 \
  --mode drip \
  --file /var/lib/cnc-dnc/programs/BOR2.H \
  --auto-dc1-after-bcc \
  --delay 0.05 \
  -b 9600 --bits 7 --parity E --stopbits 2 --xonxoff
```

**Differences:**
1. ❌ **No `--verbose` flag** - can't see sender output
2. ✅ Same file content (different path)
3. ✅ Same serial parameters
4. ⚠️ Running as background subprocess vs foreground

**Impact:** Web UI version has no debugging output, harder to diagnose

---

## Immediate Investigation Steps

### Step 1: Enable Verbose Logging
```python
# Edit dnc_service/transfers.py - add --verbose flag
args = [
    "python3",
    self.cfg.sender_path,
    req.port,
    "--mode", req.mode,
    "--file", str(program_path),
    "--verbose",  # ADD THIS LINE
    ...
]
```

### Step 2: Capture Full Output
Check journalctl after next transfer:
```bash
ssh pi@cncpi.local "journalctl -u cnc-dnc.service -n 200 | grep -E 'Block|ETX|EOT|Header'"
```

### Step 3: Test Manual Command Again
Run manual drip command and **observe TNC carefully** during last line:
```bash
ssh pi@cncpi.local
python3 /home/pi/heidenhain_sender.py /dev/ttyAMA0 \
  --mode drip \
  --file /var/lib/cnc-dnc/programs/BOR2.H \
  --auto-dc1-after-bcc \
  --delay 0.05 \
  --verbose
```

**Watch for:**
- "Sent ETX" message
- "Received EOT" or "Warning: EOT not received"
- Time between last block and ETX
- TNC screen behavior after ETX

### Step 4: Try Modified Termination Sequence

**Option A: Send EOT explicitly**
```python
# After line 258-260 in heidenhain_sender.py
ser.write(ETX)
ser.flush()
print("Sent ETX")

# ADD:
time.sleep(0.1)
ser.write(EOT)
ser.flush()
print("Sent EOT")
```

**Option B: Send DC1 after ETX**
```python
ser.write(ETX)
ser.flush()
print("Sent ETX")

# ADD:
ser.write(DC1)  # XON
ser.flush()
print("Sent final DC1")
```

**Option C: Add delay before ETX**
```python
# Before ETX
time.sleep(0.5)  # Give TNC time to process END PGM
ser.write(ETX)
```

---

## Next Actions

1. ✅ **Answer diagnostic questions above**
2. ⏳ **Enable verbose logging** in Web UI transfers
3. ⏳ **Reproduce issue** with manual command while monitoring
4. ⏳ **Capture complete sender output** for analysis
5. ⏳ **Test modified termination sequences** based on findings

---

## Related Issues

- Progress tracking regex mismatch (separate but related)
- Web UI subprocess output not captured in logs
- No real-time debugging for background transfers

---

## References

- TNC 410 Programming Manual: Section on EXT1 protocol termination
- `heidenhain_sender.py` lines 258-267 (drip mode ETX/EOT handling)
- `dnc_service/transfers.py` subprocess execution
- DEVELOPMENT_PROGRESS.md Section 5.8-5.10
