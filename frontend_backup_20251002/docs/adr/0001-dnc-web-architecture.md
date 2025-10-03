# ADR 0001: DNC Feeder Web Integration Architecture

## Status
**Accepted** - 2025-09-06

## Context

The existing Ronelan industrial monitoring web application needs to integrate the DNC feeder software functionality. Currently, the feeder is a standalone PySide6 Python GUI application that handles serial communication with CNC machines via Raspberry Pi devices.

### Current State
- **Web App**: React + TypeScript + Zustand + Tailwind CSS, monitoring dashboard
- **Feeder**: Python PySide6 GUI with serial communication (RS-232/RS-485)
- **Target**: Unified web interface for both monitoring and CNC program feeding

### Requirements
1. Integrate feeder UI into existing web application
2. Maintain all existing feeder functionality (standard, BCC, BCC listen, receive modes)
3. Support multiple Raspberry Pi devices
4. Real-time logging and progress tracking
5. Preserve existing dark theme and UX patterns

## Decision

### Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │◄──►│   Gateway API   │◄──►│  Raspberry Pi   │
│   React App     │    │  (Go Backend)   │    │  FastAPI Service│
│   /dnc route    │    │  Proxy/Auth     │    │  Serial Control │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Decisions

#### 1. **Backend Architecture**
- **Raspberry Pi**: FastAPI + Uvicorn service per device
- **Gateway**: Extend existing Go backend with proxy endpoints
- **Protocol**: REST for commands, WebSocket for real-time events

#### 2. **Communication Flow**
- Browser ↔ Gateway (existing auth/CORS)
- Gateway ↔ Pi Services (server-to-server, no browser CORS issues)
- Real-time: WebSocket termination at gateway, fan-out to Pi services

#### 3. **API Design**
- **Pi Service**: `/api/v1/*` endpoints (health, config, control, upload, etc.)
- **Gateway**: `/api/dnc/{deviceId}/*` proxy endpoints
- **Events**: Structured JSON over WebSocket

#### 4. **UI Integration**
- New route: `/dnc` in existing React app
- Reuse existing theme tokens and components
- Single-page layout with panels: Config, Controls, Editor, Console, Progress

#### 5. **State Management**
- Local DNC state store (Zustand slice)
- Typed API client with AbortController
- Real-time updates via WebSocket integration

## Implementation Plan

### Phase 1: Core Backend (Steps 2-4)
1. Extract feeder core logic from PySide6 into pure Python library
2. Implement FastAPI service around core logic
3. Define and implement REST + WebSocket API

### Phase 2: Gateway Integration (Steps 8)
1. Add proxy endpoints to existing Go backend
2. Device registry and health aggregation
3. Authentication and authorization integration

### Phase 3: Frontend Integration (Steps 9-15)
1. Create DNC page and components
2. Implement API client and state management
3. Build panels: Config, Controls, Editor, Console, Progress

### Phase 4: Production Ready (Steps 16-21)
1. Testing, security, observability
2. Deployment automation
3. Documentation and rollout

## Consequences

### Positive
- ✅ Unified web interface reduces cognitive load
- ✅ Centralized authentication and audit
- ✅ Existing infrastructure reuse
- ✅ Scalable to multiple Pi devices
- ✅ Modern web UX patterns

### Negative
- ❌ Additional complexity (3-tier vs 2-tier)
- ❌ Network dependency for Pi communication
- ❌ Migration effort from existing PySide6 UI

### Mitigations
- Keep existing PySide6 GUI as fallback during transition
- Implement comprehensive testing with serial simulation
- Gradual rollout starting with pilot device

## Implementation Notes

### Technology Stack
- **Frontend (dev)**: React/TypeScript UI with built-in DNC mock (no network I/O)
- **Pi Service (later)**: FastAPI 0.111.0, Uvicorn, pyserial 3.5, Pydantic 2.7.1
- **Frontend (prod)**: Monaco Editor (syntax highlighting), existing React/TypeScript stack
- **Gateway (later)**: Extend current Go backend (http proxy, WebSocket bridging)

### Development Commands

Frontend-only (mock mode, no device communication):
```bash
cd ronelan-frontend
# optional, defaults to true
set VITE_DNC_USE_MOCK=true
npm run dev
# open /dnc (device selector shows "demo"); mock emits logs/progress
```

Backend service (reference for later integration; not required during frontend dev):
```bash
cd backend/feeder_service
python3.11 -m venv .venv && source .venv/bin/activate
pip install fastapi==0.111.0 uvicorn[standard]==0.30.0 pyserial==3.5 pydantic==2.7.1
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

Gateway integration (to be implemented later):
- Proxy REST: `/api/dnc/{deviceId}/v1/*` → `http://{pi-ip}:8081/api/v1/*`
- Proxy WS: `/api/dnc/{deviceId}/v1/ws` → `ws://{pi-ip}:8081/api/v1/ws`

### Security Considerations
- Pi services bind to LAN only (no external exposure)
- All authentication/authorization at gateway level
- Audit logging for control actions
- Role-based access: dnc_viewer, dnc_operator, dnc_admin

## References
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [WebSocket Patterns](https://websockets.readthedocs.io/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [pyserial Documentation](https://pyserial.readthedocs.io/)

## Approval
- **Author**: AI Assistant (CKH methodology)
- **Date**: 2025-09-06
- **Status**: Ready for implementation
