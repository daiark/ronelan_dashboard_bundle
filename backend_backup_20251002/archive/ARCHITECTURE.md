# ARCHITECTURE.md: CNC Machine Monitoring System - Detailed Overview

## 1. Introduction

The `cnc-monitor` project is a robust, high-performance system designed for real-time monitoring of CNC machines. It provides a scalable backend for ingesting, storing, and exposing time-series sensor data. This document details the system's architecture, core components, data flow, key design principles, and the successful verification steps undertaken during its development.

## 2. Overall Architecture

The system is built around a microservices-like architecture, orchestrated using Docker Compose. Its primary components are:

*   **Go Backend (`monitor` service)**: The core application responsible for data ingestion, processing, and API exposure.
*   **NATS JetStream**: A high-performance, distributed messaging system used for reliable data transport between sensors and the `monitor` service.
*   **TimescaleDB (PostgreSQL)**: A time-series optimized relational database for efficient storage and querying of sensor data.
*   **Docker & Docker Compose**: Used for containerization and orchestration of all services, ensuring consistent deployment and environment setup.

```
+-----------------+     +-----------------+     +-----------------+     +-----------------+
| Sensor/Publisher| --> | NATS JetStream  | --> | Go Monitor App  | --> | TimescaleDB     |
| (e.g., scripts) |     | (Message Queue) |     | (Ingestion & API)|     | (Time-Series DB)|
+-----------------+     +-----------------+     +-----------------+     +-----------------+
                                                              ^
                                                              |
                                                              +-----------------+
                                                              | API Consumers   |
                                                              | (e.g., curl)    |
                                                              +-----------------+
```

## 3. Component Breakdown

### 3.1. Go Backend (`monitor` service)

The `monitor` service is a single Go application (`cmd/monitor/main.go`) that encapsulates both the data ingestion logic and the RESTful API.

*   **`cmd/monitor/main.go`**: The application's entry point. It initializes:
    *   **Configuration**: Loaded via `internal/config/config.go` using `viper`.
    *   **Database Connection**: Establishes a connection pool to TimescaleDB using `pgxpool` (`internal/platform/database/postgres.go`).
    *   **NATS Connection**: Connects to NATS JetStream (`internal/platform/messaging/nats.go`).
    *   **Ingestion Service**: Starts a consumer that listens to NATS for sensor data (`internal/ingestion/consumer.go`).
    *   **API Server**: Initializes HTTP handlers and routes to expose data (`internal/api/handlers.go`, `internal/api/routes.go`).
    It also manages graceful shutdown on termination signals.

*   **`internal/ingestion` package**:
    *   `consumer.go`: Contains the `Service` struct and its `Run` method, which continuously fetches messages from a NATS JetStream consumer. It handles message unmarshalling, error logging, and proper NATS acknowledgment (`Ack`, `NakWithDelay`, `Term`).
    *   `repository.go`: Provides an abstraction layer for database operations, including `InsertSensorData`, `GetSensorDataForMachine`, and machine metadata management (`GetAllMachines`, `CreateMachine`).
    *   `models.go`: Defines the `SensorData` and `Machine` data structures.

*   **`internal/api` package**:
    *   `handlers.go`: Implements the HTTP request handlers for various API endpoints (e.g., `GetMachines`, `CreateMachine`, `GetMachineData`). These handlers interact with the `ingestion.Repository` to fetch and store data.
    *   `routes.go`: Defines the API routes using Go's standard `net/http` multiplexer, mapping URL paths to the corresponding handlers.

### 3.2. NATS JetStream

NATS JetStream acts as the central nervous system for data transport. Sensors publish data to a stream (`CNC_DATA`), and the `monitor` service's ingestion component consumes from a durable pull-based consumer on this stream. This ensures message persistence and reliable delivery, even if the `monitor` service is temporarily down.

### 3.3. TimescaleDB (PostgreSQL)

TimescaleDB is chosen for its robust time-series capabilities, built as an extension on PostgreSQL. It provides efficient storage, indexing, and querying of time-stamped sensor data, which is crucial for monitoring applications. The `postgres_data` Docker volume ensures data persistence across container restarts.

### 3.4. Docker and Docker Compose

The entire application stack is containerized.
*   `Dockerfile`: Defines how the Go `monitor` application is built into a lightweight Docker image. It uses a multi-stage build for efficiency.
*   `docker-compose.yml`: Orchestrates the three services (`monitor`, `postgres`, `nats`), defining their images, ports, volumes, environment variables, and inter-service dependencies.

## 4. Key Design Principles and Features

*   **Concurrency**: The Go `monitor` service leverages goroutines for concurrent handling of API requests and NATS message consumption, ensuring high throughput.
*   **Graceful Shutdown**: The `main.go` includes logic to gracefully shut down HTTP servers and NATS connections upon receiving termination signals, preventing data loss or abrupt service interruptions.
*   **Resilience**:
    *   **NATS JetStream**: Provides built-in message persistence and redelivery mechanisms.
    *   **Message Acknowledgment**: The ingestion service explicitly acknowledges messages upon successful processing, negatively acknowledges (NAK) messages for retriable errors (e.g., database issues), and terminates malformed messages to prevent infinite redelivery loops.
*   **Robust API Parameter Handling**: The API uses `r.PathValue("id")` for extracting path parameters, making it resilient to URL structure changes and more idiomatic for Go's `net/http` router.
*   **Separation of Concerns**: Clear division between API, ingestion, configuration, and platform (database/messaging) layers.

## 5. Testing and Verification

The project's functionality and robustness have been thoroughly verified through a series of tests, including both basic and advanced scenarios.

### 5.1. Test Environment Setup

The entire system is brought up using Docker Compose:
```bash
docker compose up --build
```
This command builds the `monitor` Go application, and starts the `monitor_app`, `timescale_db`, and `nats_server` containers. A `healthcheck` on the `postgres` service ensures the database is fully ready before the `monitor_app` attempts to connect, preventing race conditions during startup.

### 5.2. Test Cases and Outcomes

#### 5.2.1. Test Case A: Basic Ingestion (scripts/publish_test_data.go)

*   **Purpose**: Verify fundamental data flow for a single, valid sensor message.
*   **Action**: `go run scripts/publish_test_data.go`
*   **Expected Outcome**:
    *   **`monitor_app` logs**: Show `Successfully processed and stored data for machine: CNC-001`.
    *   **API Query (`curl "http://localhost:8081/api/v1/machines/CNC-001/data"`)**: Returns a JSON array containing exactly one sensor data object.
*   **Verification**: **Passed.** Confirmed successful end-to-end data flow.

#### 5.2.2. Test Case B: Concurrent Load and Error Handling (scripts/stress.go)

*   **Purpose**: Validate system performance under concurrent load and test its resilience to malformed data. This script sends data for 5 machines concurrently (20 messages each) and one intentionally malformed message.
*   **Action**: `go run scripts/stress.go`
*   **Expected Outcome**:
    *   **`monitor_app` logs (Success)**: Show numerous `Successfully processed...` messages for machines `CNC-STRESS-0` through `CNC-STRESS-4`.
    *   **`monitor_app` logs (Malformed Message Handling)**: Show `Error unmarshalling message data... Message will be terminated.`. **Crucially, no `nats: message was already acknowledged` errors are observed.**
    *   **API Query (Success - e.g., `curl "http://localhost:8081/api/v1/machines/CNC-STRESS-2/data"`)**: Returns a JSON array containing exactly 20 sensor data objects.
    *   **API Query (Failure - `curl "http://localhost:8081/api/v1/machines/CNC-MALFORMED/data"`)**: Returns an empty JSON array `[]`.
*   **Verification**: **Passed.** Confirmed robust handling of concurrent data streams and correct rejection/termination of malformed messages without system errors.

## 6. Key Fixes Implemented During Development

During the development and testing process, several critical issues were identified and resolved, enhancing the project's stability and correctness:

*   **Docker Compose Versioning**: Transitioned from the deprecated `docker-compose` (V1, hyphenated) to the modern `docker compose` (V2, spaced) command. This resolved Python dependency conflicts and `Not supported URL scheme http+docker` errors.
*   **Orphaned Containers**: Addressed `Conflict. The container name "/nats_server" is already in use` errors by ensuring proper `docker compose down` usage and, when necessary, manual `docker stop` and `docker rm` of stubborn containers.
*   **Port Conflict**: Resolved `address already in use` errors on port `5432` by identifying and stopping a locally running PostgreSQL service (`sudo systemctl stop postgresql`).
*   **Missing `monitor` Service**: The main Go application was initially not part of the `docker-compose.yml`. It was added as a dedicated service, ensuring it runs automatically within the Docker environment.
*   **Go Version Mismatch**: The `Dockerfile` was updated from `golang:1.21-alpine` to `golang:1.22-alpine` to match the `go.mod` requirement, fixing build failures related to Go version compatibility.
*   **Race Condition on Startup**: Implemented a `healthcheck` for the `postgres` service in `docker-compose.yml` and updated the `monitor` service's `depends_on` condition to `service_healthy`. This ensures the `monitor_app` only starts attempting database connections after TimescaleDB is fully initialized and ready.
*   **Malformed Message Handling (NATS Acknowledgment Logic)**: Corrected a subtle bug in `internal/ingestion/consumer.go`. Previously, a malformed message would be `Term()`inated, but the calling code would still attempt an `Ack()`, leading to `nats: message was already acknowledged` errors. This was fixed by introducing a sentinel error (`errMessageTerminated`) to explicitly signal to the caller that the message was handled and no further acknowledgment was needed.
*   **API URL Parsing Robustness**: Improved the `GetMachineData` handler in `internal/api/handlers.go` by replacing brittle `strings.Split` logic with the robust `r.PathValue("id")` method. This ensures correct extraction of the machine ID from the URL regardless of minor path variations.

## 7. Conclusion

The `cnc-monitor` project provides a solid foundation for CNC machine monitoring. Its architecture is designed for scalability and resilience, leveraging modern Go practices, NATS JetStream, and TimescaleDB. Through rigorous testing and iterative refinement, the system has demonstrated its ability to reliably ingest, store, and expose sensor data, even under challenging conditions like concurrent load and malformed inputs. The implemented fixes have significantly enhanced its stability and correctness, making it a robust solution for its intended purpose.
