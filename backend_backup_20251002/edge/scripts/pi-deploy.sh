#!/bin/bash
# Pi Edge Agent Deployment Script
# Automatically configures and starts the edge agent

set -e

echo "🤖 CNC Edge Agent - Pi Deployment"
echo "=================================="

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p /tmp/cnc-agent
mkdir -p ~/cnc-config

# Auto-detect NATS server on network
echo "🔍 Auto-detecting NATS server..."
NATS_HOST=""
for ip in 192.168.1.{130..140}; do
    if nc -z $ip 4222 2>/dev/null; then
        NATS_HOST=$ip
        echo "✅ Found NATS server at $ip:4222"
        break
    fi
done

if [ -z "$NATS_HOST" ]; then
    echo "❌ No NATS server found on network"
    echo "💡 Defaulting to 192.168.1.132:4222"
    NATS_HOST="192.168.1.132"
fi

# Generate machine ID based on hostname and MAC
MACHINE_ID="CNC-$(hostname | tr '[:lower:]' '[:upper:]')-$(cat /sys/class/net/eth0/address | cut -d: -f4-6 | tr -d ':' | tr '[:lower:]' '[:upper:]')"
echo "🏭 Machine ID: $MACHINE_ID"

# Create config file
echo "📝 Creating configuration..."
cat > ~/cnc-config/edge-agent.yaml << EOF
machine:
  id: "$MACHINE_ID"
  location: "factory-floor"
  sampling_rate: 100

nats:
  url: "nats://$NATS_HOST:4222"
  stream: "CNC_DATA"
  subject_prefix: "CNC_DATA.edge"
  reconnect_delay: "1s"
  max_reconnects: 10

buffering:
  hot_buffer:
    capacity: 1048576
  warm_buffer:
    path: "/tmp/cnc-agent/warm.buffer"
    size: 10485760
  cold_buffer:
    path: "/tmp/cnc-agent/cold.log"
    max_size: 104857600
  batching:
    size: 10
    timeout: "200ms"

sensors:
  - name: "temperature"
    type: "temperature"
    unit: "celsius"
    simulate: true
  - name: "spindle_speed"
    type: "rpm"
    unit: "rpm"
    simulate: true

health:
  check_interval: "30s"
  metrics_retention: "1h"

logging:
  level: "info"
  format: "json"
EOF

echo "✅ Configuration created at ~/cnc-config/edge-agent.yaml"

# Set permissions
chmod 755 ~/cnc-edge-agent 2>/dev/null || echo "⚠️  cnc-edge-agent binary not found"

# Test NATS connectivity
echo "🔗 Testing NATS connectivity..."
if nc -z $NATS_HOST 4222; then
    echo "✅ NATS server is reachable"
else
    echo "❌ NATS server not reachable at $NATS_HOST:4222"
    exit 1
fi

echo ""
echo "🚀 Ready to start! Run:"
echo "   ./cnc-edge-agent --config ~/cnc-config/edge-agent.yaml"
echo ""
echo "Or use this one-liner:"
echo "   ./cnc-edge-agent --config ~/cnc-config/edge-agent.yaml"
echo ""
echo "📊 Data will be stored with machine ID: $MACHINE_ID"
echo "🎯 Publishing to: CNC_DATA.edge.data"
echo "📡 NATS server: $NATS_HOST:4222"