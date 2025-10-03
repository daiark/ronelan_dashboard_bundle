#!/bin/bash

set -e

echo "🔄 Restarting backend with improved error handling..."

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker compose down --remove-orphans --volumes

# Remove any dangling volumes
echo "🧹 Removing dangling volumes..."
docker volume prune -f

# Start with fresh volumes
echo "🚀 Starting fresh backend services..."
docker compose up -d --force-recreate

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check container status
echo "📊 Checking container status..."
docker compose ps

# Check if TimescaleDB is healthy
echo "🏥 Checking TimescaleDB health..."
timeout 60 bash -c 'until docker exec timescale_db pg_isready -U user -d cnc_monitor; do echo "Waiting for TimescaleDB..."; sleep 2; done'

# Check if NATS is ready
echo "📡 Checking NATS connectivity..."
timeout 30 bash -c 'until nc -z localhost 4222; do echo "Waiting for NATS..."; sleep 2; done'

# Show logs for debugging
echo "📋 Service logs:"
echo "--- TimescaleDB logs ---"
docker logs timescale_db --tail 20
echo "--- NATS logs ---"
docker logs nats_server --tail 10
echo "--- Monitor app logs ---"
docker logs monitor_app --tail 20

echo "✅ Backend restart complete!"
echo "🌐 Services available at:"
echo "  - TimescaleDB: localhost:5433"
echo "  - NATS: localhost:4222"
echo "  - API: localhost:8081"