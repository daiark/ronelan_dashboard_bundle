# Test Plan for CNC Monitoring System

**Objective**: This document provides a step-by-step guide for testing the functionality, concurrency, and error-handling capabilities of the CNC Monitoring System.

---

### Prerequisites

-   Docker Engine
-   Docker Compose (V2, command: `docker compose`)
-   Go programming language environment
-   `curl` command-line tool

---

### Step 1: Start the Test Environment

Execute the following command from the project root directory:

```bash
docker compose up --build
```

**Expected Outcome**: All three services (`monitor_app`, `timescale_db`, `nats_server`) will build and start. The `monitor_app` log will show successful connection messages to both the database and NATS, and then wait for incoming messages.

---

### Step 2: Execute Test Cases

Perform these tests in a new, separate terminal.

#### Test Case A: Single Message Ingestion

1.  **Action**: Execute the basic publisher script.
    ```bash
    go run scripts/publish_test_data.go
    ```

2.  **Verification**:
    -   **Log Check**: In the `docker compose` terminal, observe the `monitor_app` logs for the following exact output:
        ```log
        Successfully processed and stored data for machine: CNC-001
        ```
    -   **API Check**: Execute the following `curl` command:
        ```bash
        curl "http://localhost:8081/api/v1/machines/CNC-001/data"
        ```
    -   **Expected Result**: The API must return a JSON array containing exactly one object.

#### Test Case B: Concurrent Load and Error Handling

1.  **Action**: Execute the stress test script.
    ```bash
    go run scripts/stress.go
    ```

2.  **Verification**:
    -   **Log Check (Success)**: The `monitor_app` logs must show multiple `Successfully processed...` messages for machines named `CNC-STRESS-0` through `CNC-STRESS-4`.
    -   **Log Check (Failure)**: The `monitor_app` logs must contain a log entry indicating that the intentionally malformed message was terminated. The log must contain the phrase:
        ```log
        Error unmarshalling message data... Message will be terminated.
        ```
    -   **API Check (Success)**: Query the data for one of the concurrently processed machines.
        ```bash
        curl "http://localhost:8081/api/v1/machines/CNC-STRESS-2/data"
        ```
    -   **Expected Result (Success)**: The API must return a JSON array containing exactly 20 objects.
    -   **API Check (Failure)**: Verify that the data from the malformed message was not stored.
        ```bash
        curl "http://localhost:8081/api/v1/machines/CNC-MALFORMED/data"
        ```
    -   **Expected Result (Failure)**: The API must return an empty JSON array `[]`.

---

### Step 3: Environment Teardown

After completing all tests, shut down the environment.

1.  **Action**: Execute the following command:
    ```bash
    docker compose down
    ```

2.  **Expected Outcome**: All containers and networks associated with the project will be stopped and removed.how
