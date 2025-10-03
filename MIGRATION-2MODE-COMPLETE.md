# DNC Mode Migration: Complete ✅

**Date:** 2025-10-03  
**Migration:** 4-mode system → 2-mode system (standard, drip)

---

## Summary

Successfully migrated the **frontend** and **Pi edge service** from the legacy 4-mode DNC system to the new 2-mode `heidenhain_sender.py` system.

### Old System (4 modes) - DEPRECATED
- `standard` - RS-232 streaming
- `bcc` - Block check character protocol
- `bcc_listen` - Listen for BCC requests
- `receive` - Receive programs from machine

**Location:** `frontend/backend/feeder_core/` (untouched, for legacy laptop workflows)

### New System (2 modes) - ACTIVE ✅
- `standard` - One-shot file transfer to TNC memory
- `drip` - Continuous drip-feed execution (EXT1 mode)

**Location:** `heidenhain_sender.py` (root), used by Pi edge service

---

## Changes Made

### Frontend (`frontend/src/`)

1. **Types** (`types/dnc.ts`):
   - `DncMode = 'standard' | 'drip'`
   - Replaced `BccConfig` and `ReceiveConfig` with `DripConfig`
   - Updated `DncConfig` interface

2. **UI** (`components/dnc/ModeControls.tsx`):
   - Dropdown shows only "Standard (File Transfer)" and "Drip-Feed (EXT1)"
   - Removed `receive()` function calls
   - Both modes use same upload → start workflow

3. **Page** (`pages/DncFeederPage.tsx`):
   - Machine integration defaults to `drip` mode (was `bcc_listen`)

4. **Store** (`store/dncStore.ts`):
   - Removed `receive()` action
   - `resume()` always sets state to `sending` (no more `receive` → `receiving`)

5. **Services** (`services/dncApi.ts`, `services/dncMock.ts`):
   - Removed `receive()` method
   - Mock config uses `drip` instead of `bcc`/`receive`

### Pi Edge Service (`edge/dnc-service/`)

1. **Main** (`dnc_service/main.py`):
   - Default mode: `"drip"` (was `"bcc_listen"`)
   - Fallback mode: `"drip"` (was `"bcc_listen"`)
   - Config delay: Uses `drip.delay` (was `bcc.delay`)
   - **NATS timeout**: Added 3-second timeout to prevent blocking HTTP server

2. **Models** (`dnc_service/models.py`):
   - `TransferRequest.mode` pattern: `^(standard|drip)$` (was `^(standard|bcc|bcc_listen|receive)$`)
   - Default mode: `"drip"`

3. **Transfers** (`dnc_service/transfers.py`):
   - Fallback mode: `"drip"`

### Documentation

1. **README.md**:
   - Updated mode references: `standard|drip` (was `standard|bcc_listen`)
   - Added mode details and migration note
   - **Added hotspot auto-detection workflow**

2. **HOTSPOT-QUICK-START.md** (NEW):
   - Complete guide for portable hotspot usage
   - Auto-detection script usage
   - Troubleshooting guide

### Infrastructure

1. **scripts/detect-and-deploy.sh** (NEW):
   - Auto-detects laptop IP on any network
   - Finds Pi using mDNS (`cncpi.local`)
   - Updates `config.env` with correct IPs
   - Redeploys to Pi automatically

2. **Makefile**:
   - Added `make hotspot` target
   - Auto-detection workflow integration

3. **config.env**:
   - `BACKEND_HOST` now dynamically detected (was `localhost`)
   - Pi connects to laptop's NATS server

---

## Verification

### ✅ Frontend
- TypeScript compilation: **PASSING**
- Mode dropdown: **Shows 2 modes only**
- Configuration loading: **No type errors**
- Machine integration: **Defaults to drip**

### ✅ Pi Edge Service
- HTTP API: **Responding**
- Default mode: **drip**
- NATS timeout: **Working** (non-blocking startup)
- Hostname resolution: **Fixed** (`/etc/hosts`)

### ✅ Networking
- Backend NATS: **Running** on 192.168.1.132:4222
- Pi DNC API: **Running** on cncpi.local:8083
- Frontend: **Configured** for real Pi (not mock)

---

## How to Use

### Regular Network (Fixed IPs)
```bash
make dashboard
cd frontend && npm run dev
```

### Portable Hotspot (Dynamic IPs)
```bash
make hotspot          # Auto-detect and deploy
make backend-up       # Start NATS/DB
make gen-frontend-env # Update frontend config
cd frontend && npm run dev
```

### Manual Verification
```bash
# Check Pi API
curl http://cncpi.local:8083/api/v1/health
curl http://cncpi.local:8083/api/v1/config  # Should show "drip"

# Check Pi logs
make pi-logs

# Check frontend config
cat frontend/.env.local
```

---

## What Was NOT Changed

- **Laptop backend** (`frontend/backend/feeder_core/`): Still uses 4-mode system
- **`heidenhain_sender.py`**: Already supported 2 modes (no changes)
- **Backend Docker stack**: NATS, TimescaleDB, Monitor (no changes)

---

## Troubleshooting

### "Loading configuration" errors
✅ **FIXED** - Type mismatch resolved

### "Unable to resolve host cncpi" warnings
✅ **FIXED** - Updated `/etc/hosts` on Pi

### HTTP server not starting on Pi
✅ **FIXED** - Added NATS connection timeout (3 seconds)

### Wrong IP after switching networks
✅ **FIXED** - Use `make hotspot` to auto-detect

---

## Next Steps

1. **Test with real CNC machine**:
   - Upload a program
   - Try both standard and drip modes
   - Verify serial communication

2. **Monitor progress tracking**:
   - Check NATS messages flow to backend
   - Verify TimescaleDB stores progress data

3. **Add firewall rules** (if needed):
   - Allow port 4222 (NATS) from Pi to laptop
   - `sudo ufw allow from 192.168.1.133 to any port 4222`

4. **Consider production deployment**:
   - Build frontend: `cd frontend && npm run build`
   - Serve static files from backend or separate server
   - Remove dev-only dependencies

---

## Files Changed

**Frontend:**
- `src/types/dnc.ts`
- `src/components/dnc/ModeControls.tsx`
- `src/pages/DncFeederPage.tsx`
- `src/store/dncStore.ts`
- `src/services/dncApi.ts`
- `src/services/dncMock.ts`

**Pi Edge:**
- `edge/dnc-service/dnc_service/main.py`
- `edge/dnc-service/dnc_service/models.py`
- `edge/dnc-service/dnc_service/transfers.py`

**Infrastructure:**
- `Makefile` (added `hotspot` target)
- `config.env` (BACKEND_HOST updated)
- `README.md` (added hotspot docs)
- `scripts/detect-and-deploy.sh` (NEW)
- `HOTSPOT-QUICK-START.md` (NEW)

---

## Credits

Migration completed using:
- **CKH methodology**: Start simple, iterate fast, measure first
- **First principles**: Direct > abstraction, obvious > clever
- **Reasoning engine**: Maximum correctness, minimum tokens

**Assistant:** Claude (Sonnet 4.5)  
**User:** ed  
**Duration:** ~30 minutes  
**Lines changed:** ~200 lines across 11 files
