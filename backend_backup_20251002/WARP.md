# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

What it is
- CNC Monitor: a Go backend (NATS JetStream → TimescaleDB → REST API) plus a Go edge agent for Raspberry Pi with robust offline buffering. Production orchestration uses Docker Compose and Makefile shortcuts.

Mental model
- Data path: Edge Agent → NATS JetStream (CNC_DATA.>) → Backend consumer → TimescaleDB → REST API (port 8081).
- On‑wire format: Each NATS message is [4‑byte big‑endian length][JSON payload]. Backend validates and terminates malformed frames (no redelivery loops) and NAKs retriable failures for redelivery.
- Backend layout:
  - cmd/monitor: entrypoint wiring config, DB pool, NATS, consumer goroutines, HTTP server.
  - internal/platform: database (pgxpool) and NATS/JetStream setup.
  - internal/ingestion: durable pull consumer, integrity checks, repository to TimescaleDB. Unique (machine_id, sequence_number) enforces idempotency.
  - internal/api: handlers and routes: GET/POST /api/v1/machines, GET /api/v1/machines/{id}/data?start_time&end_time (RFC3339).
- Edge Agent layout (edge/agent): sensor manager (GPIO/I2C/Modbus/simulator), multi‑tier buffering (hot/warm/cold + file‑backed offline buffer), NATS client, and a small state machine. Publishes to subject prefix CNC_DATA.edge (messages go to CNC_DATA.edge.data).

Do this now (commands)
Backend (Docker Compose + Makefile)
- Start backend services (TimescaleDB, NATS, API):
  make backend
- Full setup cycle (backend → deploy agents → start agents → status):
  make all
- Restart everything cleanly:
  make restart
- Show logs (backend):
  make logs
- Quick status (containers + Pi processes):
  make quick-status
- Tear down and clean volumes/cache:
  make clean
- System tests (API, NATS, Pi reachability quick checks):
  make test

Edge agents (Raspberry Pi)
- Build and deploy agents to configured Pis (cross‑compile + scp + per‑Pi config):
  ./LLM_SCRIPTS/deploy_edge_agent.sh
  # Env knobs (override as needed):
  # CNC_PI_IPS="<pi1> <pi2>" CNC_PI_USER=pi CNC_SSH_KEY=~/.ssh/id_rsa_pi CNC_BACKEND_IP=<backend-ip> ./LLM_SCRIPTS/deploy_edge_agent.sh
- Start all agents (mode 1=normal, 0=clean buffers):
  ./LLM_SCRIPTS/start_all_agents.sh 1
  ./LLM_SCRIPTS/start_all_agents.sh 0
- Stop all agents:
  ./LLM_SCRIPTS/stop_all_agents.sh
- Tail agent logs on Pi #1:
  make agent-logs

Local backend development (Go)
- Run load/perf scripts (publishers):
  go run scripts/publish_test_data.go
  go run scripts/performance.go
  go run scripts/stress.go
- Recreate a fresh DB (drops/recreates schema; restarts stack):
  ./LLM_SCRIPTS/fresh_db_test.sh

Testing (Go)
- Run all tests for a package tree:
  go test ./...
- Run a single test by name (example pattern):
  go test ./path/to/pkg -run '^TestName$' -v

Configuration
- Backend default config (configs/config.yaml): API port 8081; TimescaleDB at service timescale_db:5432; NATS at nats_server:4222; stream CNC_DATA; durable PROCESSOR.
- Edge default config (edge/agent pi-config*.yaml or edge/examples/configs/edge-config.yaml): subject_prefix: CNC_DATA.edge; stream: CNC_DATA; file paths under /var/tmp/cnc-agent.
- Parameterize Pi targets and backend IP via env when running LLM_SCRIPTS: CNC_PI_IPS, CNC_PI_USER, CNC_SSH_KEY, CNC_BACKEND_IP, CNC_API_PORT, CNC_NATS_PORT.

Pitfalls / Troubleshooting (repo‑specific)
- API port: Backend listens on 8081 (see configs/config.yaml). docker-compose maps 8081:8081. Dockerfile EXPOSE is 8080 (informational only); prefer compose mapping and config value.
- NATS subject alignment: Edge publishes to CNC_DATA.edge.data; backend stream is CNC_DATA.> and durable consumer PROCESSOR. If subjects don’t match this pattern, messages won’t land in the stream.
- DB schema: sensor_data enforces UNIQUE(machine_id, sequence_number). If you change sequence assignment at the edge, duplicates will be dropped silently by ON CONFLICT DO NOTHING (as intended).
- Pi permissions/paths: Ensure /var/tmp/cnc-agent exists and is writable by the pi user; warm.buffer/cold.log paths are used by edge buffering and get cleared by clean runs.
- Go toolchain: go.mod declares go 1.22 and a toolchain directive; build images use golang:1.22-alpine. For Pi binaries, LLM_SCRIPTS cross‑compiles with GOOS=linux GOARCH=arm GOARM=6.

References (files in this repo)
- Makefile: top‑level dev and ops targets (backend, deploy, start‑agents, stop‑agents, restart, logs, agent-logs, quick-status, test, clean).
- docker-compose.yml: services monitor_app (API 8081), timescale_db (5433 host), nats_server (4222, 8222 monitoring).
- configs/config.yaml: backend server/db/NATS settings.
- cmd/monitor/main.go and internal/*: backend wiring, JetStream consumer, repository, API routes.
- scripts/init.sql: Timescale schema (sensor_data, machines) with UNIQUE(machine_id, sequence_number).
- edge/agent/*: edge runtime, buffering (hot/warm/cold + offline), sensors, NATS publisher, configs.
- LLM_SCRIPTS/*: backend lifecycle, agent deploy/start/stop, status, DB reset.
- README.md and docs/*: architecture overview, deployment guide, troubleshooting, technical reference.

