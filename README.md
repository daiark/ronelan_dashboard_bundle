# Ronelan Dashboard Bundle

What it is
- Self‑contained folder to run the backend on your laptop, deploy/start the Pi edge DNC service, and run the frontend. Edit config.env once and use short make targets to boot everything.

Quick start
1) Edit config.env
- BACKEND_HOST: hostname/IP of this laptop (use <host>.local on hotspots if possible)
- PI_HOST: hostname/IP of the Pi (prefer cncpi.local)
- HEIDENHAIN_SENDER: path to the sender on the Pi, e.g. /home/pi/heidenhain_sender.py

2) Start dashboard
- make dashboard
  - boots backend (docker compose)
  - deploys/starts DNC service to the Pi and points NATS to BACKEND_HOST
  - writes frontend/.env.local to map DEVICE_ID → http://PI_HOST:DNC_PORT
  - starts the frontend dev server on http://localhost:5173

3) Use the app
- http://localhost:5173/dnc
- Select device (DEVICE_ID from config.env)
- Refresh ports, upload program, choose mode (standard|drip), Start.

Mode details:
- standard: One-shot file transfer to TNC memory (RECEIVE FILE mode)
- drip: Continuous execution via EXT1 (PROGRAM RUN → EXT1)

Frequently used targets
- make backend-up        # docker compose up -d in backend
- make backend-down      # docker compose down
- make pi-deploy         # deploy/refresh edge DNC service to Pi
- make pi-status         # systemctl status cnc-dnc.service
- make pi-logs           # journalctl -u cnc-dnc.service -f
- make frontend-dev      # start Vite dev server (Node 18+ required)

Hotspot / roaming networks

Method 1: Auto-detection (recommended)
- Connect laptop and Pi to your portable hotspot
- Run: make hotspot
  - Auto-detects laptop IP and Pi hostname
  - Updates config.env automatically
  - Deploys to Pi with correct NATS URL
- Then: make backend-up && make gen-frontend-env && cd frontend && npm run dev

Method 2: Manual mDNS (CKH best practice)
- Use mDNS hostnames instead of IPs:
  - On Pi: sudo apt-get install -y avahi-daemon; sudo hostnamectl set-hostname cncpi
  - Then set PI_HOST=cncpi.local in config.env.
  - For BACKEND_HOST use your laptop hostname + .local if the hotspot supports mDNS.
- If mDNS isn't available, update PI_HOST and BACKEND_HOST IPs in config.env and re-run make pi-deploy.

Pi verification checklist
- ssh $PI_USER@$PI_HOST
- sudo systemctl status --no-pager cnc-dnc.service
- sudo journalctl -u cnc-dnc.service -f --no-pager
- curl -s http://$PI_HOST:$DNC_PORT/api/v1/health
- ls -l /var/lib/cnc-dnc/programs

Migration note:
- Frontend and Pi edge now use the new 2-mode system (standard, drip) via heidenhain_sender.py.
- The laptop backend under frontend/backend/feeder_core/ still uses the legacy 4-mode system (standard, bcc, bcc_listen, receive) and is not affected by this change.

Serial setup on the Pi (summary)
- raspi-config: Disable login shell over serial, enable serial hardware.
- (Pi 3/4) Disable Bluetooth to free UART. Prefer /dev/serial0 or /dev/ttyAMA0.
- Add $PI_USER to dialout group.

