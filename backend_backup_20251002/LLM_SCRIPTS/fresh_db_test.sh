#!/bin/bash

# Fresh Database Test Script
# Creates a clean database environment for testing offline buffer sync

set -e

BACKUP_DIR="db_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cnc_monitor_backup_${TIMESTAMP}.sql"

echo "🧹 Fresh Database Test Setup"
echo "================================"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database has data to backup
echo "📊 Checking current database state..."
RECORD_COUNT=$(docker exec timescale_db psql -U user -d cnc_monitor -t -c "SELECT COUNT(*) FROM sensor_data;" 2>/dev/null || echo "0")
RECORD_COUNT=$(echo $RECORD_COUNT | tr -d ' ')

if [ "$RECORD_COUNT" -gt 0 ]; then
    echo "💾 Found $RECORD_COUNT records - creating backup..."
    docker exec timescale_db pg_dump -U user -d cnc_monitor > "$BACKUP_FILE"
    echo "✅ Database backed up to: $BACKUP_FILE"
else
    echo "📭 Database is empty - no backup needed"
fi

# Stop backend to avoid connection issues
echo "🛑 Stopping backend service..."
docker stop monitor_app 2>/dev/null || true

# Reset database completely
echo "🔄 Resetting database..."
docker exec timescale_db psql -U user -d postgres -c "DROP DATABASE IF EXISTS cnc_monitor;" 2>/dev/null || true
docker exec timescale_db psql -U user -d postgres -c "CREATE DATABASE cnc_monitor;"

# Recreate schema
echo "🏗️  Creating fresh schema..."
docker exec timescale_db psql -U user -d cnc_monitor -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
docker exec timescale_db psql -U user -d cnc_monitor -c "CREATE TABLE sensor_data (
    time TIMESTAMPTZ NOT NULL,
    machine_id TEXT NOT NULL,
    temperature FLOAT8 NOT NULL,
    spindle_speed FLOAT8 NOT NULL,
    x_pos_mm FLOAT8,
    y_pos_mm FLOAT8,
    z_pos_mm FLOAT8,
    feed_rate_actual FLOAT8,
    spindle_load_percent FLOAT8,
    machine_state TEXT,
    active_program_line INTEGER,
    total_power_kw FLOAT8
);"
docker exec timescale_db psql -U user -d cnc_monitor -c "SELECT create_hypertable('sensor_data', 'time');"

# Reset NATS stream using docker-compose
echo "🔄 Resetting NATS stream..."
./LLM_SCRIPTS/start_backend.sh

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Verify setup
echo "🔍 Verifying fresh setup..."
FINAL_COUNT=$(docker exec timescale_db psql -U user -d cnc_monitor -t -c "SELECT COUNT(*) FROM sensor_data;" | tr -d ' ')
if [ "$FINAL_COUNT" -eq 0 ]; then
    echo "✅ Database is clean (0 records)"
else
    echo "❌ Database still has $FINAL_COUNT records"
    exit 1
fi

echo ""
echo "🎉 Fresh test environment ready!"
echo "   - Database: clean cnc_monitor"
echo "   - NATS: fresh stream (sequences will start from 1)"
echo "   - Backend: running and connected"
if [ "$RECORD_COUNT" -gt 0 ]; then
    echo "   - Backup: saved to $BACKUP_FILE"
fi
echo ""
echo "🧪 Ready for offline buffer testing!"
echo "   Run your edge agent and test network disconnection"