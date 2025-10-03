# 2025-09-04 — DNC deployment on Pi-2 (192.168.1.131)

What it is
- First working deploy of the FastAPI-based DNC service on Pi-2, wrapping heidenhain_sender.py with a web UI and NATS progress events.

Mental model
- Pi-2 systemd → uvicorn dnc_service.main:app → publishes DNC_PROGRESS.<machine_id> to backend NATS.
- Backend NATS exposed on host (192.168.1.132): 4222 (client), 8222 (monitor).

Do this now (state achieved)
- DNC service active at http://192.168.1.131:8083/
- NATS monitor reachable: http://192.168.1.132:8222/varz (connz shows Pi-2 connected)
- Program directory present on Pi: /var/lib/cnc-dnc/programs (pi:pi)
- Env on Pi (/etc/cnc-dnc.env):
  - DNC_PROGRAM_DIR=/var/lib/cnc-dnc/programs
  - NATS_URL=nats://192.168.1.132:4222
  - NATS_STREAM=DNC_PROGRESS
  - MACHINE_ID=2
  - HEIDENHAIN_SENDER=/home/pi/heidenhain_sender.py
  - UVICORN_HOST=0.0.0.0, UVICORN_PORT=8083, LOG_LEVEL=info
- systemd unit (/etc/systemd/system/cnc-dnc.service):
  - ExecStart=/opt/cnc-dnc/venv/bin/uvicorn dnc_service.main:app --host 0.0.0.0 --port 8083 --log-level info
- Backend docker-compose.yml (NATS):
  - command: ["-js", "-m", "8222", "-p", "4222"]
  - ports: 4222:4222 (client), 8222:8222 (monitor)
- Host firewall opened for 4222/tcp (client) and 8222/tcp (monitor).

Notes
- Earlier startup errors were due to shell quoting in systemd and missing dirs; fixed by direct ExecStart and creating /var/lib/cnc-dnc/programs.
- monitor_app 8081 bind conflict exists on host due to a local python process; backend API is not required for DNC but can be remapped later (e.g., 18081:8081) or free 8081.
- Packaging fix: edge/dnc-service/pyproject.toml author email updated to pass build validation (dev@example.com).

Follow-ups
- Optional: Make NATS connection lazy (non-blocking) so UI always starts even if NATS down.
- Add backend ingestion for DNC_PROGRESS stream if not yet enabled.
- Add tests for file upload parsing (boundary CR handling).

