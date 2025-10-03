# Ronelan Dashboard Documentation

Comprehensive documentation for the Ronelan CNC monitoring and DNC system.

---

## 📚 Documentation Structure

### 📖 Guides
User-facing guides and quick-start documentation:
- **[Hotspot Quick Start](../HOTSPOT-QUICK-START.md)** - Network switching and auto-discovery setup
- **[Main README](../README.md)** - Project overview and getting started

### 🔧 Technical Reference
Detailed technical documentation:
- **[Development Progress](../DEVELOPMENT_PROGRESS.md)** - Complete development history and fixes
- **[Edge Sync Process](../EDGE_SYNC_PROCESS.md)** - Edge device synchronization

### 🐛 Troubleshooting
Issue diagnosis and resolution guides:
- **[TNC Freeze on Last Line](./troubleshooting/TNC-FREEZE-ON-LAST-LINE.md)** - Drip-feed end-of-transmission issue

---

## 🚀 Quick Reference

### TNC 410 Parameters
```
5020.0 = 104  (RS-232: 9600 baud, 7-E-2, XON/XOFF)
5030.0 = 0    (Standard mode - file transfer)
5030.0 = 1    (Drip mode - block-by-block with BCC)
```

### DNC Service
```bash
# Status
systemctl status cnc-dnc.service

# Logs
journalctl -u cnc-dnc.service -f

# Restart
sudo systemctl restart cnc-dnc.service
```

### Key Commands

**Standard Mode (File Transfer):**
```bash
python3 /home/pi/heidenhain_sender.py /dev/ttyAMA0 \
  --mode standard \
  --file /var/lib/cnc-dnc/programs/PROGRAM.H
```

**Drip Mode (Continuous Execution):**
```bash
python3 /home/pi/heidenhain_sender.py /dev/ttyAMA0 \
  --mode drip \
  --file /var/lib/cnc-dnc/programs/PROGRAM.H \
  --auto-dc1-after-bcc \
  --delay 0.05
```

### Network Discovery
```bash
# Auto-configure for hotspot
make hotspot

# Then start services
make backend-up
make gen-frontend-env
cd frontend && npm run dev
```

---

## 📊 System Architecture

```
┌─────────────────┐
│  Web Dashboard  │  (localhost:5173)
│   (Frontend)    │
└────────┬────────┘
         │
    HTTP/WS
         │
┌────────┴────────┐
│  Backend API    │  (port 8081)
│  NATS / TSDB    │
└────────┬────────┘
         │
      NATS
         │
┌────────┴────────┐
│   Raspberry Pi  │  (cncpi.local)
│   DNC Service   │  (port 8083)
└────────┬────────┘
         │
    RS-232 (7-E-2, 9600 baud)
         │
┌────────┴────────┐
│  TNC 410 CNC    │
│   Controller    │
└─────────────────┘
```

---

## 🔄 Current Status

### ✅ Working
- Command-line drip mode transfers
- Web UI file uploads
- Web UI drip mode transfers
- Network auto-discovery (mDNS)
- SSH key authentication
- NATS connectivity

### ⏳ In Progress
- Progress tracking in Web UI (regex mismatch)
- TNC freeze on last line (under investigation)
- Standard mode testing

### 📋 Planned
- Error recovery mechanisms
- Automated testing
- User documentation
- Production deployment package

---

## 🆘 Getting Help

1. Check **[Troubleshooting](./troubleshooting/)** for known issues
2. Review **[Development Progress](../DEVELOPMENT_PROGRESS.md)** for recent changes
3. Check service logs: `journalctl -u cnc-dnc.service -f`
4. Verify TNC parameters (5020.0, 5030.0)
5. Test with manual command before using Web UI

---

## 📝 Contributing

When updating documentation:
1. Place guides in `/docs/guides/`
2. Technical docs in `/docs/technical/`
3. Troubleshooting in `/docs/troubleshooting/`
4. Update this README with new document links
5. Keep DEVELOPMENT_PROGRESS.md as the master changelog

---

## 🔗 External Resources

- [TNC 410 Programming Manual](https://www.heidenhain.com/)
- [NATS Documentation](https://docs.nats.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vite Documentation](https://vitejs.dev/)

---

**Last Updated:** 2025-10-03
