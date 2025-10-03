# Known Issues - Ronelan Dashboard

**Last Updated:** 2025-10-03

---

## 🔴 Critical Issues

### 1. TNC Freezes on Last Line During Drip-Feed Transfer

**Status:** 🔴 OPEN - Under Investigation  
**Severity:** HIGH  
**Affects:** Web UI drip-feed transfers  
**Detailed Guide:** [TNC-FREEZE-ON-LAST-LINE.md](./TNC-FREEZE-ON-LAST-LINE.md)

**Symptom:**
- All 34 blocks transfer successfully
- TNC freezes when processing final line (END PGM statement)
- Requires power cycle or manual intervention

**Workaround:** None yet - under investigation

**Investigation Tasks:**
- [ ] Determine exact TNC screen state when frozen
- [ ] Enable verbose logging in Web UI
- [ ] Test if manual command has same issue
- [ ] Compare ETX/EOT handling between modes

---

## 🟡 Medium Priority Issues

### 2. Progress Tracking Not Working in Web UI

**Status:** 🟡 IDENTIFIED - Fix Ready  
**Severity:** MEDIUM  
**Affects:** Web UI real-time progress display

**Symptom:**
- Web UI shows transfer starting but no progress updates
- Progress bar doesn't move
- Block count doesn't increment

**Root Cause:**
```python
# dnc_service/transfers.py line 114
ack_re = re.compile(r"RX: ACK on (?:block\s*)?(\d+)")
```
- Regex looks for "RX: ACK" pattern
- But sender outputs "Block 1:", "Block 2:", etc.
- Pattern never matches, so progress never updates

**Fix:**
```python
# Update regex to match actual sender output
block_re = re.compile(r"Block\s+(\d+):")
```

**Workaround:** Check logs manually or monitor TNC screen

---

### 3. Verbose Output Not Captured in Web UI Transfers

**Status:** 🟡 IDENTIFIED - Enhancement Needed  
**Severity:** MEDIUM  
**Affects:** Debugging Web UI transfers

**Symptom:**
- Manual command shows detailed output with `--verbose`
- Web UI transfers have no visible output
- Difficult to debug transfer issues

**Root Cause:**
- Web UI doesn't pass `--verbose` flag to sender
- Subprocess output not logged to journalctl

**Fix:** Add `--verbose` flag to command builder in `transfers.py`

**Workaround:** Use manual command for debugging

---

### 4. Standard Mode Not Yet Tested

**Status:** 🟡 PENDING TESTING  
**Severity:** MEDIUM  
**Affects:** Standard file transfer mode

**Tasks:**
- [ ] Set TNC parameter 5030.0 = 0
- [ ] Test file upload to TNC memory
- [ ] Verify file stored correctly
- [ ] Document any issues

---

## 🟢 Minor Issues

### 5. DNC Service Configuration Mismatch

**Status:** ✅ FIXED  
**Severity:** LOW (was HIGH before fix)  
**Fixed In:** 2025-10-03 session

**What Was Wrong:**
- Default port: `/dev/serial0` (incorrect)
- Default delay: `0.0` (too fast)
- DC1 flag: hardcoded `False`

**Fix Applied:**
- Port changed to `/dev/ttyAMA0`
- Delay changed to `0.05`
- DC1 changed to `True` (auto-detect)

---

### 6. NATS Event Publishing Not Verified

**Status:** 🟡 NEEDS VERIFICATION  
**Severity:** LOW  
**Affects:** Backend integration, real-time dashboards

**Tasks:**
- [ ] Monitor NATS stream during transfer
- [ ] Verify events reach TimescaleDB
- [ ] Check if backend dashboard updates

**Workaround:** System works without NATS (local only)

---

## 📋 Enhancement Requests

### 7. File Management UI

**Priority:** LOW  
**Status:** NOT STARTED

**Missing Features:**
- Delete uploaded files
- Browse file list
- Rename files
- View file contents

**Workaround:** Use SSH to manage files in `/var/lib/cnc-dnc/programs/`

---

### 8. Error Recovery Mechanisms

**Priority:** MEDIUM  
**Status:** NOT STARTED

**Missing Features:**
- Auto-retry on failure
- Resume partial transfers
- Graceful cable disconnect handling
- Port busy detection

---

### 9. Multi-Device Support

**Priority:** LOW  
**Status:** NOT STARTED

**Current Limitation:**
- Single Pi, single TNC
- No support for multiple machines

**Future Enhancement:**
- Multi-device mapping
- Concurrent transfers
- Device selection in UI

---

## 🔧 Workarounds & Quick Fixes

### If Transfer Doesn't Start
1. Check DNC service: `systemctl status cnc-dnc.service`
2. Verify file uploaded: `ls -la /var/lib/cnc-dnc/programs/`
3. Check TNC parameters (5020.0=104, 5030.0=1 for drip)
4. Ensure TNC in correct mode (EXT1 for drip)

### If TNC Shows "EXT Input Not Ready"
1. Check serial cable connection
2. Verify TNC power is on
3. Confirm TNC is in EXT1 mode with program selected

### If Progress Doesn't Update
- This is a known issue (#2)
- Monitor TNC screen directly
- Or use manual command with `--verbose`

### If Transfer Completes But TNC Frozen
- This is under investigation (#1)
- Try power cycling TNC
- See [TNC-FREEZE-ON-LAST-LINE.md](./TNC-FREEZE-ON-LAST-LINE.md)

---

## 📊 Issue Statistics

- **Total Issues:** 9
- **Critical (🔴):** 1
- **Medium (🟡):** 5
- **Fixed (✅):** 1
- **Enhancement (📋):** 2

---

## 🆘 Reporting New Issues

When reporting issues, include:

1. **What you were trying to do**
2. **What actually happened**
3. **Error messages** (from Web UI and logs)
4. **TNC screen state** (photo if possible)
5. **Service logs:**
   ```bash
   journalctl -u cnc-dnc.service -n 100 --no-pager
   ```
6. **Transfer command used** (manual or Web UI)
7. **TNC parameters** (5020.0, 5030.0 values)

---

**Next Review:** After addressing critical issue #1
