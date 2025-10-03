# Development Progress Summary

This document summarizes the development work performed to address issues and improve the codebase.

## 1. Initial Problem: Blank Webpage

The primary issue reported was a completely black webpage when booting the project. This was traced to a JavaScript runtime error in the frontend.

## 2. Frontend Fixes

### 2.1. Blank Screen / `k is undefined` Error

- **Issue:** The webpage was black, and the browser console showed `Uncaught TypeError: k is undefined` (minified) or `Uncaught TypeError: react_production_min is undefined` (unminified). This indicated a problem with React module loading.
- **Root Cause:** The `vite.config.ts` file had a `manualChunks` configuration that was causing incorrect dependency resolution between JavaScript chunks, leading to React not being loaded correctly.
- **Resolution:**
    - Removed the `manualChunks` configuration from `frontend/vite.config.ts`. This allows Vite to use its default, more robust chunking strategy.
    - Performed a clean build of the frontend (`npm install` and `npm run build`) to ensure fresh bundles were generated.
    - Restarted the Nginx container serving the frontend to ensure the new bundles were served.

### 2.2. Linting and Code Quality Improvements

Several linting errors and warnings were identified and fixed to improve code quality and maintainability.

- **`frontend/src/components/ImprovedDashboardLayout.tsx`:**
    - Removed unused `programId` parameters from `handlePauseProgram` and `handleStopProgram`.
    - Added `calculateGridColumns` to the `useEffect` dependency array to resolve a missing dependency warning.
- **`frontend/src/components/TimeSeriesDataGraph.tsx`:**
    - Removed unused import `getDataSourceById`.
    - Replaced `Record<string, any>` with a more specific `ChartPoint` type to improve type safety.
- **`frontend/src/components/panels/TimeSeriesPanel.tsx`:**
    - Replaced `any[]` with `SensorData[]` for the `data` prop to improve type safety.
- **`frontend/src/hooks/useMachineProgram.ts`:**
    - Removed unused `programId` parameters from `onPauseProgram`, `onStopProgram`, and `onResumeProgram`.
- **`frontend/src/pages/MachineDetailPage.tsx`:**
    - Removed unused imports `Machine` and `SensorData`.
- **`frontend/src/services/dncHub.ts`:**
    - Removed unused `deviceId` from the `destroy` function.
    - Renamed unused `e` to `error` in `destroy` and `notifyListeners` functions for clarity.
- **`frontend/src/store/dncStore.ts`:**
    - Removed unused imports `mapDncStateToStatus`, `ProgressEvent`, and `ProgressCanonical`.
- **`frontend/src/store/machineStore.ts`:**
    - Removed unused `removedStatus` and `removedData` variables in the `deleteMachine` function.

### 2.3. API Service and State Management Enhancements

- **`frontend/src/services/apiService.ts`:**
    - Removed `console.log` statements from request and response interceptors.
    - Improved error handling in `fetchMachines`, `createMachine`, `updateMachine`, `deleteMachine`, and `assignDevice` functions to provide more context from `axios` errors.
    - Added `updateMachine`, `deleteMachine`, and `assignDevice` functions to interact with the backend API.
- **`frontend/src/store/machineStore.ts`:**
    - Simplified the mock data logic in `fetchMachines` to avoid complex merging of mock and real data.
    - Updated `addMachine`, `updateMachine`, `deleteMachine`, and `assignDevice` actions to use the newly implemented `apiService` functions, transitioning from mock implementations to actual API calls.

## 3. Backend Fixes

### 3.1. `go vet` and `staticcheck` Issues

- **`backend/internal/platform/taskqueue/liteq.go`:**
    - **Issue:** `go vet` reported `undefined: liteq.Queue` and `job.Payload undefined`.
    - **Root Cause:** The code was using an incorrect API for the `github.com/khepin/liteq` library version `v0.1.0`. The type should be `liteq.JobQueue`, and the job data field should be `Job`.
    - **Resolution:**
        - Replaced `liteq.Queue` with `liteq.JobQueue` in function signatures.
        - Replaced `job.Payload` (and subsequent incorrect guesses like `job.Message`, `job.Data`, `job.Body`) with `job.Job` to correctly access the job data.
- **`staticcheck`:** Ran `staticcheck` on the main application packages (`cmd`, `edge`, `internal`) and found no issues after the `go vet` fixes.

### 3.2. Configuration and Deployment Consistency

- **`backend/docker-compose.yml`:**
    - **Issue:** Mismatch between `POSTGRES_DB` environment variable (`cnc_monitor_new`) and the database name used in the `postgres` service healthcheck (`cnc_monitor`). This would prevent the `monitor` service from starting.
    - **Resolution:** Changed `POSTGRES_DB` to `cnc_monitor` to align with the healthcheck.
- **`backend/Dockerfile`:**
    - **Issue:** The `EXPOSE` instruction was set to `8080`, but the application's configured port (and `docker-compose.yml` mapping) was `8081`.
    - **Resolution:** Changed `EXPOSE 8080` to `EXPOSE 8081` for consistency.
- **`backend/configs/config.yaml`:
    - **Issue:** The `dbname` was set to `cnc_monitor_new`, which was inconsistent with the corrected `docker-compose.yml` and the database name used by the application.
    - **Resolution:** Changed `dbname` to `cnc_monitor`.
- **`backend/internal/api/handlers.go`:**
    - **Issue:** URL parameter extraction in `GetMachineData` was brittle (`strings.Split`) and error handling returned plain text.
    - **Resolution:**
        - Updated `GetMachineData` to use `r.PathValue("id")` for robust URL parameter extraction (available in Go 1.22+).
        - Modified all API handlers to return JSON error messages instead of plain text, providing more structured error responses.

## 4. Next Steps / Further Improvements

- **Backend `scripts` directory:** The `scripts` directory still contains `go vet` errors related to `main` redeclarations. These are not critical for the main application but should be addressed for overall code hygiene.
- **Frontend `package-lock.json`:** Ensure `package-lock.json` is updated and committed after all frontend dependency changes.
- **Comprehensive Testing:** Implement or expand unit/integration tests for the newly integrated API calls in the frontend and the corrected backend logic.
- **Error Reporting Service:** Integrate a proper error reporting service (e.g., Sentry, Bugsnag) for production environments, as noted in `ErrorBoundary.tsx`.
- **DNC Service Integration:** Fully integrate the DNC service with the frontend, moving beyond mock implementations where applicable.

## 5. TNC 410 Serial Communication - DRIP Mode Success (2025-10-03)

### 5.1. Hardware Setup
- **Equipment:** Heidenhain TNC 410 CNC controller
- **Interface:** Raspberry Pi connected via RS-232 serial (UART)
- **Connection:** `/dev/ttyAMA0` at 9600 baud, 7 data bits, Even parity, 2 stop bits (7-E-2)

### 5.2. TNC Parameters Configuration
- **5020.0 = 104** (RS-232 settings):
  ```
  7 data bits:                                    +0
  Any BCC allowed (accepts any byte 0-255):       +0
  RTS inactive:                                   +0
  DC3 active (XON/XOFF flow control):             +8
  Even parity:                                    +0
  Parity requested:                               +32
  2 stop bits:                                    +64
                                              -------
                                      TOTAL = 104
  ```
- **5030.0 = 1** (Block transmission mode - CRITICAL for drip-feed/BCC protocol)

### 5.3. Issues Encountered and Resolved

#### 5.3.1. Python Byte Handling Bugs in `heidenhain_sender.py`
Multiple byte-to-integer conversion errors caused runtime failures:

**Bug 1:** `wait_for()` function (Line 74)
- ❌ **Issue:** `return b` (returned bytes object instead of integer)
- ✅ **Fix:** `return b[0]` (extract integer from single-byte read)

**Bug 2:** `recv_bcc_header()` bytearray appends (Lines 150, 152)
- ❌ **Issue:** `hdr.append(b)` (attempting to append bytes object to bytearray)
- ✅ **Fix:** `hdr.append(b[0])` (append integer value)

**Bug 3:** BCC byte comparison (Line 162)
- ❌ **Issue:** `bcc_recv = bcc_byte` (bytes vs int comparison failure)
- ✅ **Fix:** `bcc_recv = bcc_byte[0]` (convert to int for comparison)

**Bug 4:** `argparse` choices syntax (Line 281)
- ❌ **Issue:** `choices=,` (empty choices list)
- ✅ **Fix:** `choices=[7, 8],` (valid data bits options)

#### 5.3.2. Communication Issues
- **TNC freezing:** Resolved by ensuring proper parameter settings (5020, 5030) and using correct transmission mode
- **No DC1 received:** TNC was not sending XON - communication was one-way initially due to incorrect expectations
- **Data erroneous errors:** Fixed by adding inter-block delay (`--delay 0.05`) to give TNC processing time

### 5.4. Successful Drip-Feed Transfer

**Working Command:**
```bash
python3 /home/pi/heidenhain_sender.py /dev/ttyAMA0 \
  --mode drip \
  --file /home/pi/BOR2.H \
  --auto-dc1-after-bcc \
  --delay 0.05 \
  --verbose
```

**Results:**
- ✅ TNC successfully sent BCC header: `H 'BOR2' E | DC1_after=False`
- ✅ Auto-detected DC1-after-BCC requirement (disabled for this TNC)
- ✅ Transmitted all 34 program blocks successfully
- ✅ No checksum errors or data corruption
- ✅ Proper ETX sent at completion

**Key Success Factors:**
1. **Correct parameter 5030.0 = 1** (block transmission mode enabled)
2. **Inter-block delay of 50ms** (`--delay 0.05`) - gave TNC time to process each block
3. **Auto-detection of DC1-after-BCC** - script correctly identified TNC doesn't need DC1 after each block
4. **XON/XOFF flow control** enabled (software flow control)
5. **All byte-handling bugs fixed** in the Python script

### 5.5. Network Auto-Discovery Enhancement

**Problem:** Dashboard needed manual IP configuration when switching between networks (home, factory, hotspot).

**Solution Implemented:**
- Set Raspberry Pi hostname to `cncpi` via `hostnamectl`
- Enabled mDNS/Avahi daemon on Pi
- Pi now discoverable as `cncpi.local` on any network
- SSH key-based authentication configured between laptop and Pi

**Benefits:**
- `make hotspot` auto-detects laptop and Pi IPs
- No manual config.env editing when switching networks
- Consistent hostname-based addressing (`cncpi.local`)

### 5.6. Two-Mode System (Standard + Drip)

The updated `heidenhain_sender.py` now supports only two modes:

**Standard Mode** (File Transfer):
- Sends complete program to TNC memory
- TNC must be in "RECEIVE FILE" mode
- Uses simple transmission without BCC
- Parameter 5030.0 = 0

**Drip Mode** (Continuous Execution):
- Streams program line-by-line during execution
- TNC must be in "PROGRAM RUN → EXT1" mode
- Uses BCC protocol with block-by-block checksums
- Parameter 5030.0 = 1
- Supports programs too large for TNC memory

### 5.7. Files Updated
- ✅ `/home/pi/heidenhain_sender.py` (on Raspberry Pi)
- ✅ `/home/ed/ronelan_dashboard_bundle/heidenhain_sender.py` (local bundle)
- ✅ DNC service deployed via `make pi-deploy`
- ✅ Both files syntax-validated and tested

### 5.8. DNC Web UI Integration Issues & Fixes

After successful command-line testing, the web UI integration revealed several issues:

**Issue 1: Transfers Not Executing**
- ❌ **Problem:** Web UI accepted send requests (202) but no subprocess was spawned
- ✅ **Root Cause:** DNC service had incorrect default configuration
- ✅ **Fix:** Updated `dnc_service/main.py`:
  - Changed default port: `/dev/serial0` → `/dev/ttyAMA0`
  - Changed `dc1_after_bcc`: `False` → `True` (enables auto-detection)
  - Changed default delay: `0.0` → `0.05` seconds

**Issue 2: Incorrect Command Flags**
- ❌ **Problem:** Service was using `--dc1-after-bcc` / `--no-dc1-after-bcc` flags
- ✅ **Fix:** Updated `dnc_service/transfers.py` to use `--auto-dc1-after-bcc` flag

**Issue 3: "EXT Input Not Ready" Error**
- ❌ **Problem:** TNC showed "EXT input not ready" during transfer
- ✅ **Root Cause:** Serial cable was disconnected during machine restart
- ✅ **Resolution:** Reconnect cable and ensure proper TNC mode sequence

**Final Working Configuration:**
```python
# dnc_service/main.py - startup config
"serial": {
    "port": "/dev/ttyAMA0",    # Changed from /dev/serial0
    "baud": 9600,
    "bytesize": 7,
    "parity": "E",
    "stopbits": 2,
    "rtscts": False,
    "xonxoff": True,
}

# main.py line 170-171
dc1_after_bcc=True,           # Changed from False
delay=0.05,                   # Changed from 0.0
```

**Result:** ✅ Web UI successfully transmitted BOR2.H (34 blocks) via drip mode!

### 5.9. Production Recommendations

1. **Always use `--delay 0.05`** for drip mode to prevent TNC processing overload
2. **Verify TNC parameters** before transmission:
   - 5020.0 = 104 (RS-232 settings)
   - 5030.0 = 1 (for drip mode) or 0 (for standard mode)
3. **Use `--auto-dc1-after-bcc`** flag to auto-detect DC1 requirements
4. **Enable `--verbose`** during testing/troubleshooting
5. **Ensure TNC is in correct mode sequence:**
   - Drip: PROGRAM RUN → Select program → EXT1 → Start Transfer
   - Standard: RECEIVE FILE → Start Transfer
6. **Monitor serial connection** - if TNC freezes, check cable wiring and baud rate settings
7. **Web UI workflow:** Upload file → Select mode → Prepare TNC → Click Start Transfer

### 5.10. Next Steps & Testing Plan

**Phase 1: Core Functionality Verification (High Priority)**
1. ✅ Test drip mode via command line - SUCCESS
2. ✅ Test drip mode via Web UI - SUCCESS
3. ⏳ Test standard mode via Web UI
   - TNC setup: RECEIVE FILE mode
   - Parameter: 5030.0 = 0
   - Expected: File stored in TNC memory
4. ⏳ Verify progress tracking in Web UI
   - Check real-time block count updates
   - Verify progress bar functionality
   - Test WebSocket event delivery

**Phase 2: Error Handling & Recovery (Medium Priority)**
5. ⏳ Test error scenarios:
   - Wrong TNC mode (drip when in RECEIVE FILE)
   - Mid-transfer cable disconnection
   - BCC checksum retry logic
   - Port busy (multiple simultaneous transfers)
6. ⏳ Test with larger programs (100+ lines)
7. ⏳ Verify NATS event publishing to backend
   - Monitor NATS stream for DNC_PROGRESS events
   - Verify events reach TimescaleDB
   - Check dashboard real-time updates

**Phase 3: Performance & Optimization (Low Priority)**
8. ⏳ Benchmark transfer speeds with different delays (0.01, 0.05, 0.1)
9. ⏳ Test multiple file management:
   - Upload multiple programs
   - Delete programs via API
   - List/browse uploaded files
10. ⏳ End-to-end integration testing:
    - Upload → Select → Transfer → Monitor → Complete workflow
    - Verify all frontend components update correctly

**Phase 4: Documentation & Deployment (Ongoing)**
11. ⏳ Create user guide for TNC operator workflow
12. ✅ Document parameter settings and troubleshooting
13. ⏳ Package configuration for easy deployment
14. ⏳ Set up automated testing framework

**Files Requiring Update:**
- ✅ `/home/pi/heidenhain_sender.py` (Pi)
- ✅ `/home/ed/ronelan_dashboard_bundle/heidenhain_sender.py` (local)
- ✅ `/home/pi/cnc-dnc/dnc-service/dnc_service/main.py` (Pi)
- ✅ `/home/pi/cnc-dnc/dnc-service/dnc_service/transfers.py` (Pi)
- ⏳ Local bundle edge/dnc-service (needs sync from Pi)

**Known Limitations:**
- Progress tracking regex looks for "RX: ACK" but sender outputs "Block N:"
- Need to update regex in `transfers.py` to parse actual sender output
- Standard mode not yet tested
- NATS event publishing not verified end-to-end
