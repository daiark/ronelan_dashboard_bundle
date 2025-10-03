// scripts/perf_test.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"cnc-monitor/internal/ingestion"
)

const (
	natsURL        = "nats://localhost:4222"
	streamName     = "CNC_DATA"
	numGoroutines  = 10
	messagesPerGoroutine = 1000
	testDuration   = 10 * time.Second
)

var (
	messagesSent int64
	messagesProcessed int64
)

func main() {
	// Connect to NATS
	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("Error connecting to NATS: %v", err)
	}
	defer nc.Close()

	js, err := jetstream.New(nc)
	if err != nil {
		log.Fatalf("Error creating JetStream context: %v", err)
	}

	log.Printf("Starting performance test: %d goroutines × %d messages each", numGoroutines, messagesPerGoroutine)
	
	startTime := time.Now()
	var wg sync.WaitGroup

	// Start publisher goroutines
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()
			
			for j := 0; j < messagesPerGoroutine; j++ {
				// Create sensor data
				data := ingestion.SensorData{
					Timestamp:          time.Now(),
					MachineID:          fmt.Sprintf("PERF-TEST-%d", goroutineID),
					Temperature:        20.0 + rand.Float64()*60.0,
					SpindleSpeed:       float64(1000 + rand.Intn(4000)),
					XPosMM:             rand.Float64() * 500.0,
					YPosMM:             rand.Float64() * 500.0,
					ZPosMM:             rand.Float64() * 200.0,
					FeedRateActual:     100.0 + rand.Float64()*900.0,
					SpindleLoadPercent: rand.Float64() * 100.0,
					MachineState:       "running",
					ActiveProgramLine:  rand.Intn(500) + 1,
					TotalPowerKW:       1.0 + rand.Float64()*10.0,
				}

				jsonData, err := json.Marshal(data)
				if err != nil {
					log.Printf("Error marshalling JSON: %v", err)
					continue
				}

				// Publish without artificial delay
				subject := fmt.Sprintf("%s.perf", streamName)
				if _, err := js.Publish(context.Background(), subject, jsonData); err != nil {
					log.Printf("Error publishing: %v", err)
					continue
				}

				atomic.AddInt64(&messagesSent, 1)
			}
		}(i)
	}

	// Monitor processing rate
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		
		lastProcessed := int64(0)
		for range ticker.C {
			current := atomic.LoadInt64(&messagesSent)
			rate := current - lastProcessed
			log.Printf("Sent: %d messages (+%d/s), Total: %d", current, rate, current)
			lastProcessed = current
		}
	}()

	wg.Wait()
	endTime := time.Now()
	
	totalMessages := atomic.LoadInt64(&messagesSent)
	duration := endTime.Sub(startTime)
	
	log.Printf("Performance test complete!")
	log.Printf("Messages sent: %d", totalMessages)
	log.Printf("Duration: %v", duration)
	log.Printf("Throughput: %.2f messages/second", float64(totalMessages)/duration.Seconds())
	
	// Wait a bit for processing to complete
	log.Println("Waiting 5 seconds for message processing to complete...")
	time.Sleep(5 * time.Second)
}