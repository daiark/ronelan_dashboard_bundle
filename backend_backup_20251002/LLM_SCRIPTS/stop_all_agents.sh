#!/bin/bash

# Load environment variables with defaults
CNC_PI_IPS_STR=${CNC_PI_IPS:-"192.168.1.131 192.168.1.133"}
# Remove quotes and create array
PI_IPS=(${CNC_PI_IPS_STR//\"/})
PI_USER=${CNC_PI_USER:-"pi"}
CNC_SSH_KEY_PATH=${CNC_SSH_KEY:-"~/.ssh/id_rsa_pi"}

echo "🛑 Stopping all edge agents..."
echo ""

for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    
    echo "=== Stopping Agent on Pi #$PI_NUM ($PI_IP) ==="
    
    # Kill the agent using PID file and fallback to pkill
    ssh -i ~/.ssh/id_rsa_pi "$PI_USER@$PI_IP" "
        cd ~/edge_code || exit 1
        if [ -f agent.pid ]; then
            PID=\$(cat agent.pid)
            kill \$PID 2>/dev/null || true
            rm -f agent.pid
        fi
        pkill -f cnc-edge-agent || true
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ Agent stopped on Pi #$PI_NUM"
    else
        echo "❌ Failed to stop agent on Pi #$PI_NUM"
    fi
    echo ""
done

echo "🏁 All agents stopped!"
