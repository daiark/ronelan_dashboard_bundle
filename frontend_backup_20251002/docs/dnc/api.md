# DNC Feeder API (Pi Service)

Version: 0.1.0
Base path: /api/v1

Overview
- REST for commands and configuration
- WebSocket for real-time events (logs, progress, state)

Development mode (UI only)
- During frontend development, the DNC UI uses a mock service in the browser (no network I/O)
- When integrating later, disable mocks with `VITE_DNC_USE_MOCK=false` and expose gateway routes `/api/dnc/{deviceId}/v1/*` and `/api/dnc/{deviceId}/v1/ws`

Authentication: none at Pi layer (restricted to LAN); enforced at Gateway.

Endpoints
1) Health
GET /health -> 200 { status: "ok", version: "0.1.0" }

2) Serial Ports
GET /ports -> 200 [ { device, name?, description?, vid?, pid?, manufacturer?, product?, serial_number? } ]

3) Configuration
GET /config -> 200 DncConfig
PUT /config (DncConfig) -> 200 DncConfig

4) Connection
POST /connect -> 200 { connected: true }
POST /disconnect -> 200 { disconnected: true }

5) Mode
POST /mode { mode: "standard" | "bcc" | "bcc_listen" | "receive" } -> 200 { mode }

6) Upload
POST /upload multipart/form-data: file -> 200 { file_id, filename, size }

7) Send
POST /send { file_id } -> 202 { started: true }

8) Receive
POST /receive { output_dir? } -> 202 { started: true }

9) Pause/Resume/Stop
POST /pause -> 200 { paused: true }
POST /resume -> 200 { resumed: true }
POST /stop -> 200 { stopped: true }

10) Progress
GET /progress -> 200 { bytes_sent, total_bytes, rate_bps, elapsed_seconds, eta_seconds, percent }

11) State
GET /state -> 200 { state }

12) Sanitize
POST /sanitize { content, rules? } -> 200 { clean, issues: SanitizeResult }

13) WebSocket Events
GET /ws
- Message types:
  - { type: "log", ts, level: "info|warning|error|debug", msg }
  - { type: "progress", ts, bytes, total, rate_bps, percent }
  - { type: "state", ts, state }
  - { type: "error", ts, code, message }

Schemas
DncConfig
{
  serial: { port, baud, bytesize, parity: "N|E|O|M|S", stopbits, rtscts, xonxoff, timeout },
  mode: "standard|bcc|bcc_listen|receive",
  encoding: "ascii|latin-1|...",
  eol: "\r" | "\n" | "\r\n",
  standard: { nuls, delay, wait_dc1, handshake_timeout, complete_timeout },
  bcc: { retries, delay, dc1_after_bcc, program_name? },
  receive: { handshake_timeout, complete_timeout, dc1_to_start, output_dir? }
}

Notes
- Only one transfer allowed at a time.
- Uploads are stored in a spool directory; file_id references the stored file.
- Backpressure: WS drops oldest log messages if queue grows too large (keeps progress/state).

