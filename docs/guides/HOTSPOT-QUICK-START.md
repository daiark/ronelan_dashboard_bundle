# Hotspot Quick Start

## When You Switch Networks (Home → Hotspot → Shop, etc.)

### 🚀 One Command Setup
```bash
make hotspot
```

This will:
1. ✓ Auto-detect your laptop's current IP
2. ✓ Find the Pi on the network (tries `cncpi.local`, `cncpi`, `raspberrypi.local`)
3. ✓ Update `config.env` with correct IPs
4. ✓ Deploy updated configuration to Pi
5. ✓ Restart Pi DNC service with correct NATS URL

### Then Start Services
```bash
# 1. Start backend (NATS + TimescaleDB + Monitor)
make backend-up

# 2. Generate frontend environment
make gen-frontend-env

# 3. Start frontend dev server
cd frontend && npm run dev
```

### Open in Browser
- Dashboard: http://localhost:5173
- DNC Interface: http://localhost:5173/dnc

---

## Troubleshooting

### "Cannot reach Pi"
```bash
# Manual Pi discovery
ping cncpi.local
# or
ping raspberrypi.local
# or find Pi's IP on your hotspot admin page
```

### "Wrong subnet" warning
- Your laptop and Pi are on different networks
- Connect both to the same hotspot/WiFi
- Re-run `make hotspot`

### Check Pi service status
```bash
make pi-status
make pi-logs
```

### Verify connectivity
```bash
# Test Pi API
curl http://cncpi.local:8083/api/v1/health

# Test Pi config (should show "drip" mode)
curl http://cncpi.local:8083/api/v1/config
```

---

## Manual Mode (if auto-detection fails)

1. Find your laptop IP:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

2. Find Pi IP:
```bash
ping cncpi.local
# or check your hotspot's connected devices
```

3. Edit `config.env`:
```bash
BACKEND_HOST=<your-laptop-ip>
PI_HOST=cncpi.local  # or Pi's IP
```

4. Deploy:
```bash
make pi-deploy
make backend-up
make gen-frontend-env
cd frontend && npm run dev
```

---

## Network Architecture

```
┌─────────────────┐
│ Portable Hotspot│
│   10.42.0.x     │
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    │         │          │
┌───┴───┐ ┌──┴───┐  ┌───┴────┐
│Laptop │ │  Pi  │  │ CNC    │
│.132   │ │.133  │  │Machine │
└───────┘ └──────┘  └────────┘
    │         │          │
  NATS    DNC API    Serial
 :4222     :8083      /dev/
```

**Key Points:**
- Pi DNC service connects to laptop's NATS for progress tracking
- Frontend connects to Pi's DNC API for file transfers
- CNC machine connects to Pi via RS-232 serial

---

## Modes: Standard vs. Drip

### Standard (File Transfer)
- Uploads complete program to TNC memory
- TNC must be in "RECEIVE FILE" mode
- One-shot transfer, then TNC has the file

### Drip (Continuous Execution)  
- Streams program line-by-line during execution
- TNC must be in "PROGRAM RUN → EXT1" mode
- Used for programs too large for TNC memory
- **Default mode for machine integration**

---

## Tips

1. **Always use `make hotspot` when switching networks**
   - Don't manually edit config.env unless necessary
   
2. **Keep Pi hostname as `cncpi.local`**
   - mDNS makes it findable on any network
   - Avahi must be installed: `sudo apt-get install avahi-daemon`

3. **Check NATS connectivity**
   - If NATS fails, Pi still works (just no progress events to backend)
   - Look for "NATS connection failed (non-fatal)" in Pi logs

4. **Frontend .env.local is regenerated**
   - Run `make gen-frontend-env` after `make hotspot`
   - Dev server will hot-reload automatically
