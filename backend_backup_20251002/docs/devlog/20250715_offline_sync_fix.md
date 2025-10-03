# Devlog: Offline Sync and Backend Consumer Fixes

**Date:** 2025-07-15

## Summary

This devlog details the debugging and resolution of two critical bugs that were preventing the CNC monitoring system from functioning correctly. The primary issues were a deadlock in the edge agent's offline buffer and a fragile backend consumer that could not recover from a lost NATS connection.

## Bugs Fixed

### 1. Edge Agent: Offline Buffer Sync Deadlock

- **Symptom:** The edge agent would go offline and buffer data to a local file (`current.jsonl`), but when connectivity was restored, it would get stuck in a loop and fail to sync the offline data. The `sync/` directory remained empty, and the `current.jsonl` file was not processed.
- **Root Cause:** The offline sync process was initiated in a separate goroutine, which led to a deadlock. The `syncOfflineFiles` function was not being called synchronously, causing a race condition where the file rotation and replay process would hang.
- **Fix:**
    - The `setOnline` function was modified to call `syncOfflineFiles` synchronously, ensuring that the sync process blocks until completion.
    - The `syncOfflineFiles` function was refactored to be a single, robust, synchronous operation that first rotates the current log file and then processes all files in the `sync/` directory.

### 2. Backend Consumer: NATS Reconnection Failure

- **Symptom:** The backend `monitor_app` would lose its connection to the NATS server and fail to reconnect, causing it to stop processing messages from the edge agent. This resulted in no data being written to the TimescaleDB database.
- **Root Cause:** The backend consumer lacked a proper reconnection mechanism for the NATS client.
- **Fix:** The backend consumer was restarted, which temporarily resolved the issue. A more permanent fix will require implementing a robust NATS reconnection mechanism in the backend consumer.

## Current State

- The edge agent's offline buffer now correctly syncs data after a connection outage.
- The backend consumer is processing messages, but it is still vulnerable to NATS connection failures.
- The immediate next step is to implement a robust NATS reconnection mechanism in the backend consumer to ensure high availability.
