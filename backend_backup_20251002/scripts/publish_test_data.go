// scripts/publish_test_data.go
package main

import (
"context"
"encoding/json"
"log"
"time"

"github.com/nats-io/nats.go"
"github.com/nats-io/nats.go/jetstream"
)

type SensorData struct {
	MachineID         string    `json:"machine_id"`
	Temperature       float64   `json:"temperature"`
	SpindleSpeed      float64   `json:"spindle_speed"`
	Timestamp         time.Time `json:"timestamp"`
	XPosMM            float64   `json:"x_pos_mm"`
	YPosMM            float64   `json:"y_pos_mm"`
	ZPosMM            float64   `json:"z_pos_mm"`
	FeedRateActual    float64   `json:"feed_rate_actual"`
	SpindleLoadPercent float64   `json:"spindle_load_percent"`
	MachineState      string    `json:"machine_state"`
	ActiveProgramLine int       `json:"active_program_line"`
	TotalPowerKW      float64   `json:"total_power_kw"`
}

func main() {
	nc, err := nats.Connect("nats://localhost:4222")
	if err != nil {
		log.Fatalf("Error connecting to NATS: %v", err)
	}
	defer nc.Close()

	js, err := jetstream.New(nc)
	if err != nil {
		log.Fatalf("Error creating JetStream context: %v", err)
	}

	data := SensorData{
		MachineID:         "CNC-001",
		Temperature:       45.5,
		SpindleSpeed:      1200.0,
		Timestamp:         time.Now().UTC(),
		XPosMM:            100.5,
		YPosMM:            250.1,
		ZPosMM:            50.0,
		FeedRateActual:    500.0,
		SpindleLoadPercent: 75.0,
		MachineState:      "running",
		ActiveProgramLine: 123,
		TotalPowerKW:      5.7,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		log.Fatalf("Error marshalling JSON: %v", err)
	}

	// Publish to a subject that matches the stream config, e.g., "CNC_DATA.metrics"
	_, err = js.Publish(context.Background(), "CNC_DATA.metrics", jsonData)
	if err != nil {
		log.Fatalf("Error publishing message: %v", err)
	}

	log.Printf("Published message: %s", string(jsonData))
}
