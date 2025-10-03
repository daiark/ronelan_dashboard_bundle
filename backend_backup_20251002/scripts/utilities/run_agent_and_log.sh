#!/bin/bash

LOG_FILE="/tmp/agent.log"
AGENT_DIR="/media/ed/FSSD/DATA/daiark/RoneLan/CODE/cnc-monitor/edge/agent"

# Navigate to the agent directory
cd "$AGENT_DIR" || exit

# Start the agent in the background, redirecting output to a log file
/usr/local/go/bin/go run main.go > "$LOG_FILE" 2>&1 &
AGENT_PID=$!

echo "Agent started with PID: $AGENT_PID. Waiting for 30 seconds..."

# Wait for 30 seconds
sleep 30

# Kill the agent process
kill $AGENT_PID
echo "Agent process (PID: $AGENT_PID) killed."

# Print the log file
echo "--- Agent Log Output ---"
cat "$LOG_FILE"
