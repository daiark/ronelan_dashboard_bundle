#!/bin/bash

# Load environment variables with defaults
CNC_PI_IPS_STR=${CNC_PI_IPS:-"192.168.1.131 192.168.1.133"}
# Remove quotes and create array
PI_IPS=(${CNC_PI_IPS_STR//\"/})
PI_USER=${CNC_PI_USER:-"pi"}
CNC_SSH_KEY_PATH=${CNC_SSH_KEY:-"~/.ssh/id_rsa_pi"}

# Check for run mode argument
RUN_MODE=${1:-1}  # Default to normal run (mode 1)

if [ "$RUN_MODE" -ne 0 ] && [ "$RUN_MODE" -ne 1 ]; then
    echo "❌ Invalid run mode. Use:"
    echo "  ./start_all_agents.sh 0  # Clean run (clear buffers)"
    echo "  ./start_all_agents.sh 1  # Normal run (keep buffers)"
    exit 1
fi

echo "🚀 Starting edge agents on all Pi devices..."
echo "Run mode: $([ "$RUN_MODE" == "0" ] && echo "clean" || echo "normal")"
echo ""

# Start agents on each Pi in background
for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    
    echo "=== Starting Agent on Pi #$PI_NUM ($PI_IP) ==="
    
    # Start the agent on the Pi (run_agent.sh handles backgrounding)
    ssh -i ~/.ssh/id_rsa_pi "$PI_USER@$PI_IP" "cd ~/edge_code && ./run_agent.sh $RUN_MODE"
    
    # Give it a moment to start
    sleep 2
    
    # Verify the agent is actually running
    AGENT_STATUS=$(ssh -i ~/.ssh/id_rsa_pi "$PI_USER@$PI_IP" "pgrep -f cnc-edge-agent > /dev/null && echo 'running' || echo 'stopped'" 2>/dev/null)
    
    if [ "$AGENT_STATUS" = "running" ]; then
        echo "✅ Agent started successfully on Pi #$PI_NUM"
    else
        echo "❌ Failed to start agent on Pi #$PI_NUM"
        echo "   💡 Check logs: ssh -i ~/.ssh/id_rsa_pi $PI_USER@$PI_IP 'tail ~/edge_code/agent.log'"
    fi
    echo ""
done

echo "🎯 All agents started!"
echo ""
echo "📊 To monitor the agents:"
for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    echo "  Pi #$PI_NUM: ssh -i ~/.ssh/id_rsa_pi $PI_USER@$PI_IP 'tail -f ~/edge_code/agent.log'"
done

echo ""
echo "🛑 To stop all agents:"
echo "  ./LLM_SCRIPTS/stop_all_agents.sh"
