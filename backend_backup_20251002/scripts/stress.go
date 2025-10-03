// scripts/stress.go
package main
import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"
	"github.com/nats-io/nats.go"
	"cnc-monitor/internal/ingestion"
)
const (
	natsURL        = "nats://localhost:4222"
	streamName     = "CNC_DATA"
	numMachines    = 5
	messagesPerMachine = 20
	publishDelay   = 100 * time.Millisecond
)
func main() {
	// Connect to NATS
	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("Error connecting to NATS: %v", err)
	}
	defer nc.Close()
	log.Println("Successfully connected to NATS.")
	var wg sync.WaitGroup
	// Publish data for multiple machines concurrently
	for i := 0; i < numMachines; i++ {
		wg.Add(1)
		go func(machineID int) {
			defer wg.Done()
			machineName := fmt.Sprintf("CNC-STRESS-%d", machineID)
			log.Printf("Starting publisher for machine: %s", machineName)
			for j := 0; j < messagesPerMachine; j++ {
				// Create some random sensor data
				data := ingestion.SensorData{
					Timestamp:          time.Now(),
					MachineID:          machineName,
					Temperature:        20.0 + rand.Float64()*(80.0-20.0), // Temp between 20-80
					SpindleSpeed:       float64(1000 + rand.Intn(4000)),    // Speed between 1000-5000
					XPosMM:             rand.Float64() * 500.0,
					YPosMM:             rand.Float64() * 500.0,
					ZPosMM:             rand.Float64() * 200.0,
					FeedRateActual:     100.0 + rand.Float64()*900.0,
					SpindleLoadPercent: rand.Float64() * 100.0,
					MachineState:       []string{"running", "idle", "paused"}[rand.Intn(3)],
					ActiveProgramLine:  rand.Intn(500) + 1,
					TotalPowerKW:       1.0 + rand.Float64()*10.0,
				}
				jsonData, err := json.Marshal(data)
				if err != nil {
					log.Printf("[Machine: %s] Error marshalling JSON: %v", machineName, err)
					continue
				}
				// Publish the message
				subject := fmt.Sprintf("%s.%s", streamName, machineName)
				if err := nc.Publish(subject, jsonData); err != nil {
					log.Printf("[Machine: %s] Error publishing message: %v", machineName, err)
				} else {
					log.Printf("[Machine: %s] Published message %d/%d", machineName, j+1, messagesPerMachine)
				}
				time.Sleep(publishDelay)
			}
		}(i)
	}
	wg.Wait()
	log.Println("Finished publishing stress test data.")
	// --- Test Error Handling: Publish a malformed message ---
	log.Println("Now testing error handling by publishing a malformed message...")
	malformedData := []byte("{\"machine_id\": \"CNC-MALFORMED\", \"temperature\": \"not-a-float\"}")
	subject := fmt.Sprintf("%s.malformed", streamName)
	if err := nc.Publish(subject, malformedData); err != nil {
		log.Printf("Error publishing malformed message: %v", err)
	} else {
		log.Println("Successfully published a malformed message to test consumer error handling.")
	}
	log.Println("Stress test complete.")
}