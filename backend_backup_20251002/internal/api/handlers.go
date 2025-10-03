package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"cnc-monitor/internal/ingestion"
	"github.com/google/uuid"
	"log"
	"strings"
)

type APIHandler struct {
	repo *ingestion.Repository
}

func NewAPIHandler(repo *ingestion.Repository) *APIHandler {
	return &APIHandler{repo: repo}
}

func (h *APIHandler) GetMachines(w http.ResponseWriter, r *http.Request) {
	machines, err := h.repo.GetAllMachines(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(machines)
}

func (h *APIHandler) CreateMachine(w http.ResponseWriter, r *http.Request) {
	var machine ingestion.Machine
	if err := json.NewDecoder(r.Body).Decode(&machine); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if machine.ID == "" {
		machine.ID = uuid.New().String()
	}

	if err := h.repo.CreateMachine(r.Context(), machine); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(machine)
}

func (h *APIHandler) GetMachineData(w http.ResponseWriter, r *http.Request) {
	// Extract machine ID from URL path (e.g., /api/v1/machines/CNC-001/data)
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 6 || pathParts[4] == "" {
		http.Error(w, "Machine ID not provided", http.StatusBadRequest)
		return
	}
	machineID := pathParts[4]

	// Parse time range from query parameters
	startTimeStr := r.URL.Query().Get("start_time")
	endTimeStr := r.URL.Query().Get("end_time")

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			http.Error(w, "Invalid start_time format. Use RFC3339 (e.g., 2006-01-02T15:04:05Z)", http.StatusBadRequest)
			return
		}
	} else {
		startTime = time.Time{}.AddDate(1, 0, 0) // A very old date to get all data from the beginning
	}

	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			http.Error(w, "Invalid end_time format. Use RFC3339 (e.g., 2006-01-02T15:04:05Z)", http.StatusBadRequest)
			return
		}
	} else {
		endTime = time.Now().Add(24 * time.Hour) // A future date to get all data up to now
	}

	data, err := h.repo.GetSensorDataForMachine(r.Context(), machineID, startTime, endTime)
	if err != nil {
	log.Printf("Error getting sensor data for machine %s: %v", machineID, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(data)
}

// GetDNCTransfers lists recent DNC transfers within an optional time range and optional limit
func (h *APIHandler) GetDNCTransfers(w http.ResponseWriter, r *http.Request) {
	startTimeStr := r.URL.Query().Get("start_time")
	endTimeStr := r.URL.Query().Get("end_time")
	limitStr := r.URL.Query().Get("limit")

	var startTime, endTime time.Time
	var err error
	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil { http.Error(w, "Invalid start_time", http.StatusBadRequest); return }
	} else {
		startTime = time.Now().Add(-24 * time.Hour)
	}
	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil { http.Error(w, "Invalid end_time", http.StatusBadRequest); return }
	} else {
		endTime = time.Now().Add(1 * time.Hour)
	}
	limit := 100
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil { limit = v }
	}
	trs, err := h.repo.GetDNCTransfers(r.Context(), startTime, endTime, limit)
	if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
	json.NewEncoder(w).Encode(trs)
}

// GetDNCTransferEvents returns events for a specific transfer
func (h *APIHandler) GetDNCTransferEvents(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 6 || pathParts[4] == "" {
		http.Error(w, "Transfer ID not provided", http.StatusBadRequest)
		return
	}
	transferID := pathParts[4]

	startTimeStr := r.URL.Query().Get("start_time")
	endTimeStr := r.URL.Query().Get("end_time")
	var startTime, endTime time.Time
	var err error
	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil { http.Error(w, "Invalid start_time", http.StatusBadRequest); return }
	} else {
		startTime = time.Now().Add(-24 * time.Hour)
	}
	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil { http.Error(w, "Invalid end_time", http.StatusBadRequest); return }
	} else {
		endTime = time.Now().Add(1 * time.Hour)
	}
	events, err := h.repo.GetDNCEventsByTransfer(r.Context(), transferID, startTime, endTime)
	if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
	json.NewEncoder(w).Encode(events)
}
