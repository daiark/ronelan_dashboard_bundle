#!/bin/bash

# Load environment variables with defaults
CNC_PI_IPS_STR=${CNC_PI_IPS:-"192.168.1.131 192.168.1.133"}
# Remove quotes and create array
PI_IPS=(${CNC_PI_IPS_STR//\"/})
PI_USER=${CNC_PI_USER:-"pi"}
CNC_SSH_KEY_PATH=${CNC_SSH_KEY:-"~/.ssh/id_rsa_pi"}
BACKEND_IP=${CNC_BACKEND_IP:-"192.168.1.132"}

# Fixed paths and names
AGENT_DIR="$(dirname "$0")/../edge/agent"
BASE_BINARY_NAME="cnc-edge-agent"
PI_PASSWORD="raspy"  # Keep for fallback, but SSH keys are preferred
GO_PATH="/usr/local/go/bin/go"

# Create versioned binary name with timestamp
VERSION=$(date +"%Y%m%d_%H%M%S")
AGENT_BINARY_NAME="${BASE_BINARY_NAME}_v${VERSION}"

echo "--- Building Edge Agent for Raspberry Pi ---"

# Navigate to the agent directory
cd "$AGENT_DIR" || { echo "Error: Agent directory not found."; exit 1; }

# Clean build cache and tidy modules
echo "Cleaning build cache and running go mod tidy..."
"$GO_PATH" clean -cache
"$GO_PATH" mod tidy || { echo "Error: go mod tidy failed."; exit 1; }

# Cross-compile for Raspberry Pi (Linux ARMv6) - Build entire package, not just main.go
echo "Cross-compiling for Linux ARMv6 (building entire package)..."
echo "Building: $AGENT_BINARY_NAME"
GOOS=linux GOARCH=arm GOARM=6 "$GO_PATH" build -a -o "$AGENT_BINARY_NAME" . || { echo "Error: Build failed."; exit 1; }

echo "Build successful: $AGENT_DIR/$AGENT_BINARY_NAME"

echo "--- Transferring Edge Agent to Raspberry Pi Devices ---"

# Deploy to each Pi
for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    MACHINE_ID="CNC-PI-00$PI_NUM"
    
    echo ""
    echo "=== Deploying to Pi #$PI_NUM ($PI_IP) ==="
    
    # Create edge_code directory on Pi and copy binary
    echo "Creating edge_code directory and copying $AGENT_BINARY_NAME..."
    ssh -i ~/.ssh/id_rsa_pi "$PI_USER@$PI_IP" "mkdir -p ~/edge_code" || { echo "Error: Failed to create edge_code directory on $PI_IP"; continue; }
    scp -i ~/.ssh/id_rsa_pi "$AGENT_BINARY_NAME" "$PI_USER@$PI_IP":~/edge_code/ || { echo "Error: SCP failed for $PI_IP"; continue; }
    
    echo "Transfer complete for $PI_IP."
    
    # Create and copy simplified config file with unique machine ID
    echo "Creating config file for $MACHINE_ID..."
    cat > "pi-config-$PI_NUM.yaml" << EOF
agent:
  machine_id: "$MACHINE_ID"
  location: "Raspberry-Pi-Edge-$PI_NUM"
  sampling_rate: "100ms"
  log_level: "info"

sensors:
  - name: "cnc_simulator"
    type: "simulator"
    enabled: true
    config:
      pattern: "sine"
      frequency: 0.1
      amplitude: 100.0
      offset: 50.0

buffering:
  hot_buffer:
    capacity: 1048576  # 1MB
  warm_buffer:
    path: "/var/tmp/cnc-agent/warm.buffer"
    size: 10485760    # 10MB
  cold_buffer:
    path: "/var/tmp/cnc-agent/cold.log"
    max_size: 104857600  # 100MB
  batching:
    size: 100
    timeout: "200ms"

nats:
  url: "nats://$BACKEND_IP:4222"
  stream: "CNC_DATA"
  subject_prefix: "CNC_DATA.edge"
  max_reconnects: -1  # -1 = infinite reconnection attempts
  reconnect_delay: "2s"
EOF
    
    echo "Copying config file for $MACHINE_ID..."
    scp -i ~/.ssh/id_rsa_pi "pi-config-$PI_NUM.yaml" "$PI_USER@$PI_IP":~/edge_code/edge-config.yaml || { echo "Warning: Config transfer failed for $PI_IP, agent will use defaults"; }
    
done

# Create run script (same for all Pis)
echo ""
echo "=== Creating run script ==="
cat > "run_agent.sh" << 'EOF'
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
EOF

# Copy run script to all Pis
chmod +x "run_agent.sh"
for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    echo "Copying run script to Pi #$PI_NUM ($PI_IP)..."
    scp -i ~/.ssh/id_rsa_pi "run_agent.sh" "$PI_USER@$PI_IP":~/edge_code/ || { echo "Warning: Run script transfer failed for $PI_IP"; }
done

echo ""
echo "=== Instructions to Run on Raspberry Pi Devices ==="
for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    MACHINE_ID="CNC-PI-00$PI_NUM"
    echo ""
    echo "--- Pi #$PI_NUM ($PI_IP) - Machine ID: $MACHINE_ID ---"
    echo "1. SSH into your Raspberry Pi:"
    echo "   ssh $PI_USER@$PI_IP"
    echo ""
    echo "2. Navigate to edge_code directory:"
    echo "   cd ~/edge_code"
    echo ""
    echo "3. Run the agent:"
    echo "   # Clean run (clears all buffers and caches):"
    echo "   ./run_agent.sh 0"
    echo ""
    echo "   # Normal run (keeps existing buffers):"
    echo "   ./run_agent.sh 1"
done

echo ""
echo "4. Each Pi will automatically:"
echo "   - Find and run the latest binary: $AGENT_BINARY_NAME"
echo "   - Use its unique config with machine ID"
echo "   - Stop any existing agent processes"
echo "   - Set up required directories"

echo ""
echo "--- Deployment Script Finished ---"
