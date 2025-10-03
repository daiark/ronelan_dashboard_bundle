# Utility Scripts

This directory contains utility scripts for development, testing, and monitoring.

## 📁 Contents

### Development & Testing Scripts
- `run_agent_and_log.sh` - Runs the edge agent for 30 seconds and captures logs
- `view_logs.sh` - Captures backend Docker logs for 20 seconds and displays them

## 🚀 Usage

### Running the Edge Agent with Logging
```bash
# Run agent for 30 seconds and capture output
./scripts/utilities/run_agent_and_log.sh
```

This script:
1. Navigates to the edge agent directory
2. Starts the agent in the background
3. Waits for 30 seconds
4. Kills the agent process
5. Displays the captured logs

### Viewing Backend Logs
```bash
# Capture backend logs for 20 seconds
./scripts/utilities/view_logs.sh
```

This script:
1. Starts capturing Docker logs from `monitor_app` container
2. Captures logs for 20 seconds
3. Displays the captured logs
4. Cleans up temporary files

## ⚠️ Notes

- `run_agent_and_log.sh` has hardcoded paths that may need adjustment for your environment
- Both scripts create temporary log files in `/tmp/`
- Ensure Docker containers are running before using `view_logs.sh`
- The edge agent directory path in `run_agent_and_log.sh` may need updating

## 🔧 Configuration

You may need to update paths in `run_agent_and_log.sh`:
- `AGENT_DIR` - Path to your edge agent directory
- `LOG_FILE` - Where to store temporary logs

These scripts are designed for quick development testing and debugging.
