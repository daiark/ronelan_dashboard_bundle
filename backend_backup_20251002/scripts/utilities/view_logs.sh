#!/bin/bash

LOG_FILE="/tmp/monitor_app.log"

# Start logging in the background
echo "Starting log capture for 20 seconds..."
docker logs monitor_app --tail 100 -f > "$LOG_FILE" 2>&1 &
LOG_PID=$!

# Wait for 20 seconds
sleep 20

# Stop the logging process
kill $LOG_PID

echo "Log capture complete."
echo "--- Backend Log Output ---"
cat "$LOG_FILE"
rm "$LOG_FILE"
