# CNC Monitor - Makefile
# Simplifies common development and deployment tasks

# Load environment variables from .env file if it exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.PHONY: all help backend deploy agents start-agents stop-agents status clean restart logs test config

# Default target
all: backend deploy start-agents status

# Help target - shows available commands
help:
	@echo "🔧 CNC Monitor - Available Commands:"
	@echo ""
	@echo "📦 Setup & Deployment:"
	@echo "  make all          - Complete setup (backend + deploy + start agents + status)"
	@echo "  make backend      - Start backend services (Docker)"
	@echo "  make deploy       - Build and deploy agents to Pi devices"
	@echo "  make agents       - Deploy and start all agents"
	@echo ""
	@echo "🤖 Agent Management:"
	@echo "  make start-agents - Start all edge agents"
	@echo "  make stop-agents  - Stop all edge agents"
	@echo "  make restart-agents - Restart all agents (clean mode)"
	@echo ""
	@echo "📊 Monitoring:"
	@echo "  make status       - Check system status"
	@echo "  make logs         - Show backend logs"
	@echo "  make agent-logs   - Show agent logs from Pi #1"
	@echo "  make config       - Show current configuration"
	@echo ""
	@echo "🧹 Maintenance:"
	@echo "  make restart      - Restart entire system"
	@echo "  make clean        - Stop all services and clean up"
	@echo "  make test         - Run system tests"
	@echo ""
	@echo "💡 Examples:"
	@echo "  make              - Same as 'make all'"
	@echo "  make clean all    - Clean restart of entire system"

# Backend services
backend:
	@echo "🚀 Starting Backend Services..."
	./LLM_SCRIPTS/start_backend.sh
	@echo "✅ Backend services started"

# Deploy agents to Pi devices
deploy:
	@echo "📦 Deploying Edge Agents to Pi devices..."
	./LLM_SCRIPTS/deploy_edge_agent.sh
	@echo "✅ Agents deployed"

# Combined deploy and start agents
agents: deploy start-agents

# Start all edge agents
start-agents:
	@echo "🤖 Starting All Edge Agents..."
	./LLM_SCRIPTS/start_all_agents.sh
	@echo "✅ All agents started"

# Start agents in clean mode (clear buffers)
start-agents-clean:
	@echo "🧹 Starting All Edge Agents (Clean Mode)..."
	./LLM_SCRIPTS/start_all_agents.sh 0
	@echo "✅ All agents started in clean mode"

# Stop all edge agents
stop-agents:
	@echo "🛑 Stopping All Edge Agents..."
	./LLM_SCRIPTS/stop_all_agents.sh
	@echo "✅ All agents stopped"

# Restart agents (clean mode)
restart-agents: stop-agents start-agents-clean

# Check system status
status:
	@echo "🔍 Checking System Status..."
	./LLM_SCRIPTS/check_status.sh

# Show backend logs
logs:
	@echo "📋 Showing Backend Logs..."
	docker compose logs -f --tail=50

# Show agent logs from first Pi
agent-logs:
	@echo "🔋 Showing Agent Logs (Pi #1)..."
	@PI_IP=$$(echo "$${CNC_PI_IPS:-192.168.1.131 192.168.1.133}" | awk '{print $$1}'); \
	ssh -i ~/.ssh/id_rsa_pi $${CNC_PI_USER:-pi}@$$PI_IP 'tail -f ~/edge_code/agent.log'

# Restart entire system
restart: clean backend deploy start-agents-clean status

# Clean up everything
clean:
	@echo "🧹 Cleaning Up System..."
	-./LLM_SCRIPTS/stop_all_agents.sh
	docker compose down --remove-orphans --volumes
	go clean -cache
	@echo "✅ System cleaned"

# Run basic system tests
test: status
	@echo "🧪 Running System Tests..."
	@echo "Testing backend API..."
	@curl -s "http://localhost:$${CNC_API_PORT:-8081}/api/v1/machines" > /dev/null && echo "✅ API responding" || echo "❌ API not responding"
	@echo "Testing NATS monitoring..."
	@curl -s "http://localhost:8222/varz" > /dev/null && echo "✅ NATS responding" || echo "❌ NATS not responding"
	@echo "Testing Pi connectivity..."
	@for PI_IP in $${CNC_PI_IPS:-192.168.1.131 192.168.1.133}; do \
		ping -c 1 $$PI_IP > /dev/null 2>&1 && echo "✅ $$PI_IP reachable" || echo "❌ $$PI_IP unreachable"; \
	done
	@echo "🏁 Tests completed"

# Show current configuration
config:
	@echo "⚙️  Current Configuration:"
	@echo "========================"
	@echo "Backend IP:    $${CNC_BACKEND_IP:-192.168.1.132}"
	@echo "Pi IPs:        $${CNC_PI_IPS:-192.168.1.131 192.168.1.133}"
	@echo "Pi User:       $${CNC_PI_USER:-pi}"
	@echo "SSH Key:       $${CNC_SSH_KEY:-~/.ssh/id_rsa_pi}"
	@echo "API Port:      $${CNC_API_PORT:-8081}"
	@echo "NATS Port:     $${CNC_NATS_PORT:-4222}"
	@echo "DB Port:       $${CNC_DB_PORT:-5433}"
	@echo ""
	@echo "📝 To change configuration:"
	@echo "  1. Edit .env file:  nano .env"
	@echo "  2. Or use env vars: CNC_PI_IPS='192.168.1.10 192.168.1.11' make deploy"

# Development helpers
dev-backend:
	@echo "🔄 Restarting Backend (Development Mode)..."
	docker compose down
	docker compose up --build -d
	@echo "✅ Backend restarted in development mode"

# Quick status without full output
quick-status:
	@echo "⚡ Quick Status Check:"
	@docker compose ps --format "table {{.Name}}\t{{.Status}}" | grep -E "(NAME|monitor_app|nats_server|timescale_db)"
	@echo ""
	@echo "Pi Agents:"
	@i=1; for PI_IP in $${CNC_PI_IPS:-************* *************}; do \
		ssh -i ~/.ssh/id_rsa_pi $${CNC_PI_USER:-pi}@$$PI_IP "pgrep -f cnc-edge-agent > /dev/null && echo '  Pi #'$$i': ✅ Running' || echo '  Pi #'$$i': ❌ Stopped'" 2>/dev/null || echo "  Pi #$$i: ❓ Unreachable"; \
		i=$$((i+1)); \
	done

# DNC service ops on Pi (bare-metal)
.PHONY: dnc-deploy-pi dnc-restart dnc-status dnc-logs

# Deploys edge/dnc-service to the first Pi and installs dependencies, env, and systemd unit
# Requires: CNC_PI_IPS (first IP used), CNC_PI_USER (default pi), CNC_SSH_KEY (default ~/.ssh/id_rsa_pi), CNC_BACKEND_IP, CNC_NATS_PORT
# Optional: MACHINE_ID, HEIDENHAIN_SENDER (path on Pi), UVICORN_PORT (default 8083)
dnc-deploy-pi:
	@PI_IP=$$(echo "$${CNC_PI_IPS:-*************}" | awk '{print $$1}'); \
	USER=$${CNC_PI_USER:-pi}; KEY=$${CNC_SSH_KEY:-~/.ssh/id_rsa_pi}; \
	DNC_DIR=~/cnc-dnc; \
	echo "➡️  Deploying DNC service to $$USER@$$PI_IP"; \
	rsync -az -e "ssh -i $$KEY" edge/dnc-service $$USER@$$PI_IP:$$DNC_DIR; \
	ssh -i $$KEY $$USER@$$PI_IP "python3 -m venv /opt/cnc-dnc/venv && /opt/cnc-dnc/venv/bin/pip install --upgrade pip wheel setuptools && cd $$DNC_DIR/dnc-service && /opt/cnc-dnc/venv/bin/pip install ."; \
	ssh -i $$KEY $$USER@$$PI_IP "mkdir -p /var/lib/cnc-dnc/programs"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'DNC_PROGRAM_DIR=/var/lib/cnc-dnc/programs' | sudo tee /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'NATS_URL=nats://$${CNC_BACKEND_IP:-127.0.0.1}:$${CNC_NATS_PORT:-4222}' | sudo tee -a /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'NATS_STREAM=DNC_PROGRESS' | sudo tee -a /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'MACHINE_ID=$${MACHINE_ID:-CNC-PI-001}' | sudo tee -a /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'HEIDENHAIN_SENDER=$${HEIDENHAIN_SENDER:-/home/pi/heidenhain_sender.py}' | sudo tee -a /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'UVICORN_HOST=0.0.0.0' | sudo tee -a /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "echo 'UVICORN_PORT=$${UVICORN_PORT:-8083}' | sudo tee -a /etc/cnc-dnc.env >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "printf '%s\n' '[Unit]' 'Description=CNC DNC FastAPI service' 'After=network-online.target' 'Wants=network-online.target' '' '[Service]' 'EnvironmentFile=/etc/cnc-dnc.env' 'User=pi' 'Group=pi' 'WorkingDirectory=/home/pi' 'ExecStart=/opt/cnc-dnc/venv/bin/uvicorn dnc_service.main:app --host $${UVICORN_HOST} --port $${UVICORN_PORT} --log-level info' 'Restart=on-failure' 'RestartSec=2' '' '[Install]' 'WantedBy=multi-user.target' | sudo tee /etc/systemd/system/cnc-dnc.service >/dev/null"; \
	ssh -i $$KEY $$USER@$$PI_IP "sudo systemctl daemon-reload && sudo systemctl enable --now cnc-dnc.service"; \
	echo "✅ DNC service deployed and started"

# Restart/Status/Logs

dnc-restart:
	@PI_IP=$$(echo "$${CNC_PI_IPS:-*************}" | awk '{print $$1}'); \
	ssh -i $${CNC_SSH_KEY:-~/.ssh/id_rsa_pi} $${CNC_PI_USER:-pi}@$$PI_IP "sudo systemctl restart cnc-dnc.service && systemctl is-active cnc-dnc.service"

dnc-status:
	@PI_IP=$$(echo "$${CNC_PI_IPS:-*************}" | awk '{print $$1}'); \
	ssh -i $${CNC_SSH_KEY:-~/.ssh/id_rsa_pi} $${CNC_PI_USER:-pi}@$$PI_IP "systemctl status --no-pager cnc-dnc.service || true"

dnc-logs:
	@PI_IP=$$(echo "$${CNC_PI_IPS:-*************}" | awk '{print $$1}'); \
	ssh -i $${CNC_SSH_KEY:-~/.ssh/id_rsa_pi} $${CNC_PI_USER:-pi}@$$PI_IP "journalctl -u cnc-dnc.service -f --no-pager"
