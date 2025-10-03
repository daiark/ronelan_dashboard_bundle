#!/bin/bash

# Load environment variables with defaults
CNC_PI_IPS_STR=${CNC_PI_IPS:-"192.168.1.131 192.168.1.133"}
# Remove quotes and create array
PI_IPS=(${CNC_PI_IPS_STR//\"/})
PI_USER=${CNC_PI_USER:-"pi"}
CNC_SSH_KEY_PATH=${CNC_SSH_KEY:-"~/.ssh/id_rsa_pi"}
BACKEND_IP=${CNC_BACKEND_IP:-"192.168.1.132"}
API_PORT=${CNC_API_PORT:-"8081"}
NATS_PORT=${CNC_NATS_PORT:-"4222"}

echo "🔍 System Status Check"
echo "====================="
echo ""

# Check backend status
echo "📊 Backend Status:"
echo "   Docker containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAME|timescale_db|nats_server|monitor_app)"

echo ""
echo "   API Status:"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_PORT/api/v1/machines")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "   ✅ API is responding (HTTP $HEALTH_CHECK)"
else
    echo "   ❌ API issue (HTTP $HEALTH_CHECK)"
fi

echo ""
echo "🤖 Edge Agents Status:"
for i in "${!PI_IPS[@]}"; do
    PI_IP="${PI_IPS[$i]}"
    PI_NUM=$((i + 1))
    
    echo "   Pi #$PI_NUM ($PI_IP):"
    
    # Check if Pi is reachable
    if ping -c 1 -W 1 "$PI_IP" > /dev/null 2>&1; then
        echo "   📡 Network: ✅ Reachable"
        
        # Check if agent is running
        AGENT_STATUS=$(ssh -i ~/.ssh/id_rsa_pi "$PI_USER@$PI_IP" "pgrep -f cnc-edge-agent > /dev/null && echo 'running' || echo 'stopped'" 2>/dev/null)
        
        if [ "$AGENT_STATUS" = "running" ]; then
            echo "   🚀 Agent: ✅ Running"
        else
            echo "   🚀 Agent: ❌ Stopped"
        fi
        
        # Check screen session
        SCREEN_STATUS=$(ssh -i ~/.ssh/id_rsa_pi "$PI_USER@$PI_IP" "screen -list | grep edge_agent > /dev/null && echo 'active' || echo 'none'" 2>/dev/null)
        if [ "$SCREEN_STATUS" = "active" ]; then
            echo "   📺 Screen: ✅ Active session"
        else
            echo "   📺 Screen: ❌ No session"
        fi
    else
        echo "   📡 Network: ❌ Unreachable"
        echo "   🚀 Agent: ❓ Unknown"
        echo "   📺 Screen: ❓ Unknown"
    fi
    echo ""
done

echo "🌐 Network Info:"
echo "   Your IP: $(hostname -I | awk '{print $1}')"
echo "   NATS URL configured for agents: nats://$BACKEND_IP:$NATS_PORT"
echo ""

echo "📋 Quick Commands:"
echo "   Start all agents:  ./LLM_SCRIPTS/start_all_agents.sh"
echo "   Stop all agents:   ./LLM_SCRIPTS/stop_all_agents.sh"
echo "   Redeploy agents:   ./LLM_SCRIPTS/deploy_edge_agent.sh"
echo "   Restart backend:   ./LLM_SCRIPTS/restart_backend.sh"
