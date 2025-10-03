# Devlog: CNC Edge Agent & Backend Ingestion - Debug & Fixes (Part 1)

**Date:** 2025-07-15

## Summary

This session focused on diagnosing and resolving critical data ingestion issues within the CNC monitoring system, specifically concerning the edge agent's offline buffering and the backend consumer's message processing. We aimed to ensure complete data continuity even during network outages and to improve system robustness.

## Issues Identified & Fixes Implemented

### 1. Edge Agent: Offline Buffer Not Triggering Sync Immediately

*   **Symptom:** The edge agent successfully buffered data locally during NATS outages, but upon reconnection, it would log "Skipping sync - offline" and fail to replay the buffered data to NATS. The `current.jsonl` file was not being rotated to the `sync/` directory.
*   **Root Cause:** The logic to trigger offline file synchronization was tied only to a periodic timer (`syncLoop`) and did not initiate immediately when the agent transitioned from offline to online status.
*   **Fix:** Modified `edge/agent/internal/buffering/offline_buffer.go` (`setOnline` function) to explicitly call `syncOfflineFiles()` immediately after detecting a return to online connectivity.

### 2. Edge Agent: File Rotation Deadlock/Timeout

*   **Symptom:** During file rotation (e.g., when `current.jsonl` reached its size limit or during sync initiation), the agent would log "File rotation timed out after 5 seconds," indicating a hang, even though the rotation eventually completed.
*   **Root Cause:** A deadlock occurred within the `checkCurrentFileRotation` function. It acquired a `fileMutex` and then attempted to call `rotateFile` (which also tried to acquire the same mutex) in a separate goroutine with a timeout. The nested mutex acquisition caused the hang.
*   **Fix:** Refactored `edge/agent/internal/buffering/offline_buffer.go` (`checkCurrentFileRotation` and `rotateFileLocked` functions). The `rotateFileLocked` function now assumes the `fileMutex` is already held by its caller, eliminating the nested lock attempt and the problematic goroutine/timeout.

### 3. Backend Consumer: Incomplete Processing of Batched NATS Messages

*   **Symptom:** Despite the edge agent reporting successful replay of many buffered messages (e.g., 1901 lines), the database would only contain a fraction of those records (e.g., 211 records for the same period). The backend logs showed successful processing for some messages but not all.
*   **Root Cause:** The NATS consumer's `processMessage` function was designed to handle a single message payload. However, when the edge agent replayed its buffer, NATS efficiently batched multiple small, length-prefixed JSON messages into a single larger NATS message. The backend was only extracting and processing the *first* JSON payload from this larger message, then acknowledging the entire NATS message, effectively discarding all subsequent batched payloads.
*   **Fix:** Modified `internal/ingestion/consumer.go` (`processMessage` function) to iterate through the raw message data. It now correctly extracts and processes *all* length-prefixed JSON payloads contained within a single NATS message, ensuring no data is silently dropped.
