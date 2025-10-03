# Ronelan Frontend - Backend Integration Guide

## Overview
This guide provides instructions for integrating the React frontend with the existing Go backend (`ronelan-master`).

## Frontend Build Output
The React application builds to the `dist/` directory containing:
- `index.html` - Main HTML file
- `assets/` - CSS and JavaScript bundles
- `vite.svg` - Favicon

## Backend Integration Steps

### 1. Copy Build Files
After running `npm run build` in the frontend directory, copy the entire `dist/` folder to your Go project:

```bash
# From the ronelan-frontend directory
cp -r dist/ ../ronelan-master/backend/frontend/
```

### 2. Update Go Routes
Modify `internal/api/routes.go` to serve the static files:

```go
package api

import (
	"net/http"
	"path/filepath"
)

func NewRouter(handler *APIHandler) *http.ServeMux {
	mux := http.NewServeMux()

	// Machine Management API routes
	mux.HandleFunc("GET /api/v1/machines", handler.GetMachines)
	mux.HandleFunc("POST /api/v1/machines", handler.CreateMachine)
	mux.HandleFunc("PUT /api/v1/machines/{id}", handler.UpdateMachine)
	mux.HandleFunc("DELETE /api/v1/machines/{id}", handler.DeleteMachine)
	mux.HandleFunc("GET /api/v1/machines/{id}/data", handler.GetMachineData)

	// DNC Device API routes
	mux.HandleFunc("GET /api/dnc/devices", handler.GetDncDevices)

	// DNC Proxy routes (proxy to Pi devices)
	mux.HandleFunc("/api/dnc/{deviceId}/", handler.ProxyToDncDevice)

	// WebSocket endpoint (if implemented)
	// mux.HandleFunc("/ws/machines", handler.HandleWebSocket)
	// mux.HandleFunc("/ws/machines/{id}", handler.HandleMachineWebSocket)

	// Serve static frontend files
	fs := http.FileServer(http.Dir("./frontend"))
	mux.Handle("/", http.StripPrefix("/", fs))

	return mux
}
```

### 3. Environment Configuration
The frontend expects these API endpoints to be available:

**Development:** `http://localhost:8080`
**Production:** `http://192.168.1.100:8080` (configurable in `.env.production`)

### 4. Required API Endpoints

#### Machine Management Endpoints

#### GET /api/v1/machines
Returns array of machines:
```json
[
  {
    "id": "CNC-001",
    "name": "CNC Machine 1",
    "location": "Factory Floor A",
    "controller_type": "Fanuc",
    "max_spindle_speed_rpm": 12000,
    "axis_count": 3,
    "raspberry_pi_device_id": "rpi-001",
    "created_at": "2024-01-01T00:00:00Z",
    "last_updated": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/v1/machines
Create a new machine:
```json
{
  "name": "CNC Machine 2",
  "location": "Factory Floor B",
  "controller_type": "Heidenhain",
  "max_spindle_speed_rpm": 15000,
  "axis_count": 5,
  "raspberry_pi_device_id": "rpi-002"
}
```

#### PUT /api/v1/machines/{id}
Update an existing machine:
```json
{
  "name": "Updated Machine Name",
  "location": "New Location",
  "raspberry_pi_device_id": "rpi-003"
}
```

#### DELETE /api/v1/machines/{id}
Delete a machine (returns 204 on success)

#### DNC Device Discovery Endpoints

#### GET /api/dnc/devices
Returns available Raspberry Pi DNC devices:
```json
[
  {
    "id": "rpi-001",
    "name": "Pi Station A (Floor 1)",
    "base": "http://192.168.1.10:8081",
    "status": "connected",
    "last_seen": "2024-01-01T12:00:00Z"
  },
  {
    "id": "rpi-002",
    "name": "Pi Station B (Floor 1)",
    "base": "http://192.168.1.11:8081",
    "status": "disconnected",
    "last_seen": "2024-01-01T11:30:00Z"
  }
]
```

#### DNC Proxy Endpoints
The gateway should proxy DNC commands to specific Pi devices:

- `GET /api/dnc/{deviceId}/v1/health` → `http://{pi-ip}:8081/api/v1/health`
- `GET /api/dnc/{deviceId}/v1/ports` → `http://{pi-ip}:8081/api/v1/ports`
- `POST /api/dnc/{deviceId}/v1/upload` → `http://{pi-ip}:8081/api/v1/upload`
- `POST /api/dnc/{deviceId}/v1/send` → `http://{pi-ip}:8081/api/v1/send`
- `WebSocket /api/dnc/{deviceId}/v1/ws` → `ws://{pi-ip}:8081/api/v1/ws`

#### GET /api/v1/machines/{id}/data
Returns sensor data for a machine:
```json
[
  {
    "machine_id": "CNC-001",
    "temperature": 25.5,
    "spindle_speed": 8500,
    "timestamp": "2024-01-01T12:00:00Z",
    "x_pos_mm": 100.5,
    "y_pos_mm": 200.3,
    "z_pos_mm": 50.1,
    "feed_rate_actual": 1200,
    "spindle_load_percent": 75,
    "machine_state": "running",
    "active_program_line": 125,
    "total_power_kw": 15.2
  }
]
```

### 5. WebSocket Integration (Optional)
The frontend expects WebSocket connections at:
- `/ws/machines` - All machine updates
- `/ws/machines/{id}` - Specific machine updates

WebSocket message format:
```json
{
  "type": "sensor_data",
  "data": {
    "machine_id": "CNC-001",
    "temperature": 25.5,
    // ... other sensor data fields
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 6. CORS Configuration
Ensure CORS is configured for development:

```go
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		
		if r.Method == "OPTIONS" {
			return
		}
		
		next.ServeHTTP(w, r)
	})
}
```

## Deployment Process

### Development
1. Start Go backend: `go run cmd/monitor/main.go`
2. In frontend directory: `npm run dev`
3. Frontend dev server runs on http://localhost:5173

### Production
1. Build frontend: `npm run build`
2. Copy `dist/` to backend `frontend/` directory
3. Start Go backend - it will serve both API and frontend

## Frontend Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration Files
- `.env.development` - Development API URL
- `.env.production` - Production API URL  
- `tailwind.config.js` - Tailwind CSS configuration
- `vite.config.ts` - Build configuration

## Troubleshooting
1. **Build fails:** Clean install with `npm ci`
2. **API not found:** Check VITE_API_BASE_URL in env files
3. **CORS errors:** Ensure backend CORS middleware is properly configured
4. **WebSocket fails:** Verify WebSocket endpoints are implemented in Go backend
