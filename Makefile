# Variables are loaded from config.env
# Minimal CKH targets: backend-up/down, pi-deploy, pi-status, pi-logs, frontend-dev, dashboard

SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c

# Load config
ifneq (,$(wildcard ./config.env))
include ./config.env
export
endif

BACKEND_DIR := backend
FRONTEND_DIR := frontend
EDGE_DIR := edge/dnc-service

.PHONY: help backend-up backend-down backend-logs pi-deploy pi-status pi-logs frontend-dev dashboard gen-frontend-env

help:
	@echo "Targets:"
	@echo "  make dashboard     - backend up, deploy Pi DNC, start frontend"
	@echo "  make backend-up    - docker compose up -d (backend)"
	@echo "  make backend-down  - docker compose down (backend)"
	@echo "  make backend-logs  - tail backend logs"
	@echo "  make pi-deploy     - deploy/start edge DNC on PI_HOST"
	@echo "  make pi-status     - status of cnc-dnc.service"
	@echo "  make pi-logs       - tail logs on Pi"
	@echo "  make frontend-dev  - start Vite dev server"

backend-up:
	cd $(BACKEND_DIR)
	docker compose up -d --build
	@echo "Backend up on http://$(BACKEND_HOST):$(API_PORT)"

backend-down:
	cd $(BACKEND_DIR) && docker compose down --volumes --remove-orphans

backend-logs:
	cd $(BACKEND_DIR) && docker compose logs -f --tail=100

pi-deploy:
	@[ -n "$(PI_HOST)" ] || (echo "PI_HOST not set in config.env" && exit 1)
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "mkdir -p ~/cnc-dnc && python3 -m venv ~/cnc-dnc/venv && ~/cnc-dnc/venv/bin/pip install --upgrade pip wheel setuptools fastapi uvicorn jinja2 python-multipart nats-py aiofiles"
	rsync -az -e "ssh -i $(SSH_KEY)" $(EDGE_DIR)/ $(PI_USER)@$(PI_HOST):/home/$(PI_USER)/cnc-dnc/dnc-service/
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "cd ~/cnc-dnc/dnc-service && ~/cnc-dnc/venv/bin/pip install -e ."
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "sudo mkdir -p /var/lib/cnc-dnc/programs && sudo chown $(PI_USER):$(PI_USER) /var/lib/cnc-dnc/programs"
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "printf '%s\n' \
	  'DNC_PROGRAM_DIR=/var/lib/cnc-dnc/programs' \
	  'NATS_URL=nats://$(BACKEND_HOST):$(NATS_PORT)' \
	  'NATS_STREAM=DNC_PROGRESS' \
	  'MACHINE_ID=$(MACHINE_ID)' \
	  'HEIDENHAIN_SENDER=$(HEIDENHAIN_SENDER)' \
	  'LOG_LEVEL=info' | sudo tee /etc/cnc-dnc.env >/dev/null"
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "printf '%s\n' \
	  '[Unit]' 'Description=CNC DNC FastAPI service' 'After=network-online.target' 'Wants=network-online.target' '' \
	  '[Service]' 'EnvironmentFile=/etc/cnc-dnc.env' 'User=$(PI_USER)' 'Group=$(PI_USER)' \
	  'WorkingDirectory=/home/$(PI_USER)/cnc-dnc/dnc-service' \
	  'ExecStart=/home/$(PI_USER)/cnc-dnc/venv/bin/uvicorn dnc_service.main:app --host 0.0.0.0 --port $(DNC_PORT) --log-level info' \
	  'Restart=on-failure' 'RestartSec=2' '' \
	  '[Install]' 'WantedBy=multi-user.target' | sudo tee /etc/systemd/system/cnc-dnc.service >/dev/null"
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "sudo systemctl daemon-reload && sudo systemctl enable --now cnc-dnc.service && sleep 2 && systemctl is-active cnc-dnc.service || true"
	@echo "Pi DNC at http://$(PI_HOST):$(DNC_PORT)"

pi-status:
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "systemctl status --no-pager cnc-dnc.service" || true

pi-logs:
	ssh -i $(SSH_KEY) $(PI_USER)@$(PI_HOST) "journalctl -u cnc-dnc.service -f --no-pager" || true

# Generate frontend/.env.local from config
gen-frontend-env:
	@echo "VITE_DNC_USE_MOCK=false" > $(FRONTEND_DIR)/.env.local
	@echo "VITE_API_BASE_URL=http://$(BACKEND_HOST):$(API_PORT)" >> $(FRONTEND_DIR)/.env.local
	@echo "VITE_DNC_DEVICE_MAP='$(DEVICE_ID)=http://$(PI_HOST):$(DNC_PORT)'" >> $(FRONTEND_DIR)/.env.local
	@echo "Wrote $(FRONTEND_DIR)/.env.local"

frontend-dev: gen-frontend-env
	@echo "Node 18+ required. If using nvm: nvm use 20"
	cd $(FRONTEND_DIR) && npm install && npm run dev

# One-shot bring-up: backend up, deploy Pi, start frontend
dashboard: backend-up pi-deploy gen-frontend-env
	@echo "Open http://localhost:5173 in a new terminal with:"
	@echo "  cd $(PWD)/frontend && npm run dev"
