## Edge Agent Debug Summary

**Problem:** Agent connects to NATS but fails to publish, logging `nats: no response from stream`.

**Root Cause Analysis:**

1.  **Initial State:** Multiple Go module and compilation errors masked the core issue. These were resolved by:
    *   Treating `edge/agent` as a separate Go module.
    *   Fixing inconsistent import paths and compilation errors.

2.  **NATS Connection:** The agent successfully connects to the NATS server and confirms the `CNC_DATA` stream exists.

3.  **Publish Failure:** The `nats: no response from stream` error occurs during the `Publish` call, not connection. This indicates a subject-stream mismatch.

4.  **Subject Mismatch:**
    *   The JetStream stream was configured for subjects `CNC.EDGE.*`.
    *   The NATS client was attempting to publish to the subject `CNC.EDGE`.
    *   The NATS `*` wildcard requires a token to match; `CNC.EDGE` does not match `CNC.EDGE.*`.

**Solution:**

- Modified `edge/agent/internal/nats/client.go` to publish to a more specific subject, `CNC.EDGE.data`, which matches the stream's `CNC.EDGE.*` wildcard subscription.

This resolves the runtime publish timeout.
