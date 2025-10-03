# Project Tools Reference

## Core Scripts

### `./LLM_SCRIPTS/fresh_db_test.sh`
**Purpose:** Create clean test environment  
**When:** Before testing offline buffer, need zero duplicates baseline  
**Actions:** Backs up existing data → drops/recreates `cnc_monitor` DB → resets NATS stream → restarts containers  
**Output:** Clean DB (0 records), NATS sequences start from 1  
**Run from:** Project root directory

### `./LLM_SCRIPTS/start_backend.sh`
**Purpose:** Start/restart backend services  
**When:** After config changes, need clean container restart  
**Actions:** `docker-compose down` → `docker-compose up -d`  
**Containers:** `timescale_db`, `nats_server`, `monitor_app`  
**Run from:** Project root directory

### `./LLM_SCRIPTS/deploy_edge_agent.sh` 
**Purpose:** Deploy edge agent to Pi  
**When:** After code changes to edge agent  
**Actions:** Builds binary → copies to Pi → updates config  
**Run from:** Project root directory

### `./run_agent.sh 0` (Pi-side)
**Purpose:** Run edge agent with clean buffers  
**When:** Testing offline buffer functionality  
**Actions:** Kills existing processes → clears buffers → starts agent  
**Params:** `0` = clean mode, `1` = preserve buffers  
**Location:** `/home/pi/edge_code/`

## Critical Database Commands

### Check Duplicates
```sql
SELECT COUNT(*) as duplicates FROM (
    SELECT time, COUNT(*) FROM sensor_data 
    GROUP BY time HAVING COUNT(*) > 1
) as dups;
```

### Analyze Outages
```sql
WITH time_gaps AS (
    SELECT time, LAG(time) OVER (ORDER BY time) as prev_time,
           EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as gap_seconds 
    FROM sensor_data
) 
SELECT MAX(gap_seconds) as max_gap, 
       COUNT(*) FILTER (WHERE gap_seconds > 1) as outages 
FROM time_gaps WHERE prev_time IS NOT NULL;
```

### Data Stats
```sql
SELECT COUNT(*) as total_records, 
       COUNT(DISTINCT time) as unique_timestamps,
       MIN(time) as first_record, 
       MAX(time) as last_record 
FROM sensor_data;
```

## Docker Shortcuts

### Database Access
```bash
# Connect to DB
docker exec -it timescale_db psql -U user -d cnc_monitor

# Without TTY (for scripts)
docker exec timescale_db psql -U user -d cnc_monitor -c "QUERY"
```

### Service Logs
```bash
# Backend logs
docker logs monitor_app --tail 50

# Database logs  
docker logs timescale_db --tail 20

# NATS logs
docker logs nats_server --tail 20
```

### Container Management
```bash
# Stop all services
docker stop monitor_app timescale_db nats_server

# Start specific service
docker start monitor_app

# Check status
docker ps
```

## Key File Locations

### Backend Code
- **Config:** `configs/config.yaml`
- **Main:** `cmd/monitor/main.go`
- **Consumer:** `internal/ingestion/consumer.go`
- **DB:** `internal/platform/database/postgres.go`

### Edge Agent Code
- **Main:** `edge/agent/main.go`
- **Buffer:** `edge/agent/internal/buffering/offline_buffer.go`
- **Config:** `edge/agent/config/config.go`

### Deployment
- **Pi Config:** `configs/edge-config.yaml`
- **Deploy Scripts:** `edge/scripts/`
- **Binaries:** `edge/agent/cnc-edge-agent*`

## Database Schema Notes

- **Primary timestamp field:** `time` (NOT `timestamp`)
- **Table:** `sensor_data` (TimescaleDB hypertable)
- **No deduplication:** Identical records will be inserted
- **Timezone:** All timestamps include timezone (`+02:00`)

## Testing Workflow

1. **Clean Start:** `./fresh_db_test.sh`
2. **Deploy Agent:** `./deploy_edge_agent.sh`
3. **Run Test:** `./run_agent.sh 0` (on Pi)
4. **Simulate Outage:** Stop/start NATS container
5. **Check Results:** SQL queries for duplicates/gaps
6. **Analyze:** `docker logs monitor_app` for message flow

## Common Issues

### Docker Compose Problems
- **Fix:** Use `./start_backend.sh` instead of direct docker-compose
- **Reason:** Handles network/container conflicts

### Database Connection
- **Error:** "database does not exist"
- **Fix:** `./fresh_db_test.sh` recreates schema
- **Check:** Verify `configs/config.yaml` dbname

### Edge Agent Not Connecting
- **Check:** Pi can reach `192.168.1.132:4222`
- **Fix:** Restart NATS: `docker restart nats_server`
- **Verify:** `docker logs nats_server`

### Sequence Number Issues
- **Problem:** NATS sequences don't start from 1
- **Fix:** `./fresh_db_test.sh` resets NATS stream
- **Note:** JetStream persistence is intentional

## Performance Monitoring

### Message Rate
Expected: ~10 msgs/sec (100ms intervals)
```sql
SELECT COUNT(*) / EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) as msgs_per_sec
FROM sensor_data;
```

### Duplication Rate
Target: 0%
```sql
SELECT ROUND(100.0 * (COUNT(*) - COUNT(DISTINCT time)) / COUNT(*), 2) as dup_pct
FROM sensor_data;
```

### Outage Detection
```sql
SELECT COUNT(*) as outages 
FROM (SELECT EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as gap 
      FROM sensor_data) gaps 
WHERE gap > 1;
```