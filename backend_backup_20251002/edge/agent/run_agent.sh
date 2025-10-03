#!/bin/bash

# CNC Edge Agent Runner Script
# Usage: ./run_agent.sh [0|1]
#   0 = Clean run (clear buffers and caches)
#   1 = Normal run (keep existing buffers)

EDGE_DIR="$HOME/edge_code"
CONFIG_FILE="$EDGE_DIR/edge-config.yaml"

# Find the latest agent binary
LATEST_BINARY=$(ls -t $EDGE_DIR/cnc-edge-agent_v* 2>/dev/null | head -n1)

if [ -z "$LATEST_BINARY" ]; then
    echo "❌ No edge agent binary found in $EDGE_DIR"
    echo "Please run the deployment script first."
    exit 1
fi

BINARY_NAME=$(basename "$LATEST_BINARY")
echo "🚀 Using binary: $BINARY_NAME"

# Check run mode
RUN_MODE=${1:-1}  # Default to mode 1 (normal run)

if [ "$RUN_MODE" == "0" ]; then
    echo "🧹 Clean run mode - clearing buffers and caches"
    
    # Stop any existing agent process
    echo "Stopping existing agent processes..."
    pkill -f cnc-edge-agent || true
    sleep 2
    
    # Clear buffers and caches
    echo "Clearing buffers..."
    echo "raspy" | sudo -S bash -c "
        mkdir -p /var/tmp/cnc-agent/offline
        chown pi:pi /var/tmp/cnc-agent/offline
        rm -f /var/tmp/cnc-agent/warm.buffer
        rm -f /var/tmp/cnc-agent/cold.log
    "
    rm -rf /var/tmp/cnc-agent/offline/*
    
    echo "✅ Buffers cleared"
    
elif [ "$RUN_MODE" == "1" ]; then
    echo "🔄 Normal run mode - keeping existing buffers"
    
    # Just stop existing processes
    echo "Stopping existing agent processes..."
    pkill -f cnc-edge-agent || true
    sleep 1
    
else
    echo "❌ Invalid run mode. Use:"
    echo "  ./run_agent.sh 0  # Clean run (clear buffers)"
    echo "  ./run_agent.sh 1  # Normal run (keep buffers)"
    exit 1
fi

# Ensure directories exist
echo "raspy" | sudo -S bash -c "
    mkdir -p /var/tmp/cnc-agent/offline
    chown pi:pi /var/tmp/cnc-agent/offline
"

# Change to edge_code directory and run
cd "$EDGE_DIR"

echo "🎯 Starting $BINARY_NAME..."
echo "📁 Working directory: $(pwd)"
echo "⚙️  Config file: $CONFIG_FILE"
echo "📊 Run mode: $RUN_MODE ($([ "$RUN_MODE" == "0" ] && echo "clean" || echo "normal"))"
echo ""
echo "Press Ctrl+C to stop the agent"
echo "----------------------------------------"

# Run the agent in the background
nohup ./"$BINARY_NAME" > agent.log 2>&1 & echo $! > agent.pid
