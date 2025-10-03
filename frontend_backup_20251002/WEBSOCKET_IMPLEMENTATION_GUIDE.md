# WebSocket Implementation Guide for Go Backend

This guide provides detailed instructions for implementing WebSocket endpoints in the Ronelan Go backend to support real-time data streaming to the React frontend.

## Overview

The frontend expects WebSocket connections for real-time machine monitoring with automatic reconnection and error handling capabilities.

## Required WebSocket Endpoints

### 1. All Machines WebSocket: `/ws/machines`
Streams data for all registered machines.

### 2. Individual Machine WebSocket: `/ws/machines/{id}`
Streams data for a specific machine by ID.

## Go Implementation

### Step 1: Install WebSocket Library

Add the Gorilla WebSocket library to your project:

```bash
go get github.com/gorilla/websocket
```

### Step 2: Create WebSocket Handler

Create `internal/websocket/hub.go`:

```go
package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"cnc-monitor/internal/ingestion"
)

// Message types that frontend expects
type MessageType string

const (
	MessageTypeSensorData   MessageType = "sensor_data"
	MessageTypeMachineStatus MessageType = "machine_status"
	MessageTypeError        MessageType = "error"
)

// WebSocket message structure
type WebSocketMessage struct {
	Type      MessageType `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

// Client represents a WebSocket connection
type Client struct {
	Hub        *Hub
	Conn       *websocket.Conn
	Send       chan []byte
	MachineID  string // Empty for all-machines connection
}

// Hub manages WebSocket connections
type Hub struct {
	// Registered clients by machine ID
	clients map[string]map[*Client]bool
	
	// All clients (for broadcasting to everyone)
	allClients map[*Client]bool
	
	// Register requests from clients
	register chan *Client
	
	// Unregister requests from clients
	unregister chan *Client
	
	// Inbound messages from clients
	broadcast chan []byte
	
	// Mutex for thread-safe operations
	mutex sync.RWMutex
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		allClients: make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			
			// Add to all clients
			h.allClients[client] = true
			
			// Add to machine-specific clients if applicable
			if client.MachineID != "" {
				if h.clients[client.MachineID] == nil {
					h.clients[client.MachineID] = make(map[*Client]bool)
				}
				h.clients[client.MachineID][client] = true
			}
			
			h.mutex.Unlock()
			log.Printf("Client registered for machine: %s", client.MachineID)

		case client := <-h.unregister:
			h.mutex.Lock()
			
			// Remove from all clients
			if _, ok := h.allClients[client]; ok {
				delete(h.allClients, client)
				close(client.Send)
			}
			
			// Remove from machine-specific clients
			if client.MachineID != "" {
				if clients, ok := h.clients[client.MachineID]; ok {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.clients, client.MachineID)
					}
				}
			}
			
			h.mutex.Unlock()
			log.Printf("Client unregistered for machine: %s", client.MachineID)

		case message := <-h.broadcast:
			h.mutex.RLock()
			
			// Broadcast to all clients
			for client := range h.allClients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.allClients, client)
				}
			}
			
			h.mutex.RUnlock()
		}
	}
}

// BroadcastToMachine sends data to clients listening to a specific machine
func (h *Hub) BroadcastToMachine(machineID string, message WebSocketMessage) {
	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling WebSocket message: %v", err)
		return
	}

	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Send to machine-specific clients
	if clients, ok := h.clients[machineID]; ok {
		for client := range clients {
			select {
			case client.Send <- messageBytes:
			default:
				close(client.Send)
				delete(clients, client)
			}
		}
	}

	// Also send to all-machines clients
	for client := range h.allClients {
		if client.MachineID == "" { // Only to clients listening to all machines
			select {
			case client.Send <- messageBytes:
			default:
				close(client.Send)
				delete(h.allClients, client)
			}
		}
	}
}

// BroadcastToAll sends data to all connected clients
func (h *Hub) BroadcastToAll(message WebSocketMessage) {
	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling WebSocket message: %v", err)
		return
	}

	h.broadcast <- messageBytes
}

// WebSocket upgrader with CORS support
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin in development
		// In production, restrict this to your frontend domain
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// HandleWebSocket handles WebSocket connections
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:       h,
		Conn:      conn,
		Send:      make(chan []byte, 256),
		MachineID: "", // All machines
	}

	client.Hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// HandleMachineWebSocket handles WebSocket connections for specific machines
func (h *Hub) HandleMachineWebSocket(w http.ResponseWriter, r *http.Request, machineID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:       h,
		Conn:      conn,
		Send:      make(chan []byte, 256),
		MachineID: machineID,
	}

	client.Hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}
```

### Step 3: Create Client Methods

Add to `internal/websocket/client.go`:

```go
package websocket

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		// Handle incoming messages if needed
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current WebSocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
```

### Step 4: Update API Routes

Update `internal/api/routes.go`:

```go
package api

import (
	"net/http"
	"strings"
	
	"cnc-monitor/internal/websocket"
)

func NewRouter(handler *APIHandler, wsHub *websocket.Hub) *http.ServeMux {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("GET /api/v1/machines", handler.GetMachines)
	mux.HandleFunc("POST /api/v1/machines", handler.CreateMachine)
	mux.HandleFunc("GET /api/v1/machines/{id}/data", handler.GetMachineData)

	// WebSocket routes
	mux.HandleFunc("/ws/machines", func(w http.ResponseWriter, r *http.Request) {
		// Handle all machines WebSocket
		wsHub.HandleWebSocket(w, r)
	})
	
	mux.HandleFunc("/ws/machines/", func(w http.ResponseWriter, r *http.Request) {
		// Extract machine ID from URL
		path := strings.TrimPrefix(r.URL.Path, "/ws/machines/")
		machineID := strings.Split(path, "/")[0]
		
		if machineID == "" {
			http.Error(w, "Machine ID required", http.StatusBadRequest)
			return
		}
		
		// Handle specific machine WebSocket
		wsHub.HandleMachineWebSocket(w, r, machineID)
	})

	// Serve static frontend files
	fs := http.FileServer(http.Dir("./frontend"))
	mux.Handle("/", http.StripPrefix("/", fs))

	return mux
}
```

### Step 5: Update Main Application

Update your main application file to initialize the WebSocket hub:

```go
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"cnc-monitor/internal/api"
	"cnc-monitor/internal/ingestion"
	"cnc-monitor/internal/websocket"
)

func main() {
	// Initialize your existing components
	repo := initializeRepository() // Your existing function
	
	// Initialize WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Initialize API handler
	apiHandler := api.NewAPIHandler(repo)

	// Create router with WebSocket support
	router := api.NewRouter(apiHandler, wsHub)

	// Start data streaming (example)
	go streamSensorData(wsHub, repo)

	// Start server
	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

// Example function to stream sensor data to WebSocket clients
func streamSensorData(wsHub *websocket.Hub, repo *ingestion.Repository) {
	ticker := time.NewTicker(5 * time.Second) // Send data every 5 seconds
	defer ticker.Stop()

	for range ticker.C {
		// Get latest sensor data for all machines
		machines, err := repo.GetAllMachines(context.Background())
		if err != nil {
			log.Printf("Error getting machines: %v", err)
			continue
		}

		for _, machine := range machines {
			// Get latest data for this machine
			endTime := time.Now()
			startTime := endTime.Add(-1 * time.Minute)
			
			data, err := repo.GetSensorDataForMachine(
				context.Background(), 
				machine.ID, 
				startTime, 
				endTime,
			)
			
			if err != nil {
				log.Printf("Error getting sensor data for machine %s: %v", machine.ID, err)
				continue
			}

			if len(data) > 0 {
				// Send the latest data point
				latestData := data[len(data)-1]
				message := websocket.WebSocketMessage{
					Type:      websocket.MessageTypeSensorData,
					Data:      latestData,
					Timestamp: time.Now(),
				}

				wsHub.BroadcastToMachine(machine.ID, message)
			}
		}
	}
}
```

## Message Format

The frontend expects messages in this exact format:

```json
{
  "type": "sensor_data",
  "data": {
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
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Testing WebSocket Implementation

### Using wscat (command line tool):

```bash
# Install wscat
npm install -g wscat

# Test all machines endpoint
wscat -c ws://localhost:8080/ws/machines

# Test specific machine endpoint  
wscat -c ws://localhost:8080/ws/machines/CNC-001
```

### Using Browser Developer Tools:

```javascript
// Open browser console and test WebSocket connection
const ws = new WebSocket('ws://localhost:8080/ws/machines');
ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));
ws.onerror = (error) => console.log('Error:', error);
```

## Production Considerations

1. **Origin Validation**: Restrict `CheckOrigin` in the upgrader to your frontend domain
2. **Rate Limiting**: Implement rate limiting for WebSocket connections
3. **Authentication**: Add authentication middleware for WebSocket endpoints
4. **Monitoring**: Log WebSocket connections and disconnections
5. **Error Handling**: Implement proper error reporting through WebSocket messages

## Frontend Integration

The frontend is already configured to:
- Connect to both WebSocket endpoints
- Handle automatic reconnection with exponential backoff
- Parse and display real-time sensor data
- Show connection status in the UI
- Handle connection errors gracefully

Once you implement these WebSocket endpoints, the frontend will automatically connect and start receiving real-time data updates!
