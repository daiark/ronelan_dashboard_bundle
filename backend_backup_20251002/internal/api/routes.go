package api

import (
	"net/http"
)

func NewRouter(handler *APIHandler) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/machines", handler.GetMachines)
	mux.HandleFunc("POST /api/v1/machines", handler.CreateMachine)
	mux.HandleFunc("GET /api/v1/machines/{id}/data", handler.GetMachineData)

	// DNC history
	mux.HandleFunc("GET /api/v1/dnc/transfers", handler.GetDNCTransfers)
	mux.HandleFunc("GET /api/v1/dnc/transfers/{id}/events", handler.GetDNCTransferEvents)

	return mux
}
