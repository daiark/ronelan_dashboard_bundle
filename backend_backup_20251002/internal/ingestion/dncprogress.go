// internal/ingestion/dncprogress.go
package ingestion

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/nats-io/nats.go/jetstream"
)

// wireDNCEvent reflects the JSON produced by the Python DNC service
// and will be mapped to the repository DNCEvent model.
type wireDNCEvent struct {
	TS          string                 `json:"ts"`
	TransferID  string                 `json:"transfer_id"`
	MachineID   string                 `json:"machine_id"`
	ProgramName string                 `json:"program_name"`
	Mode        string                 `json:"mode"`
	State       string                 `json:"state"`
	Line        int                    `json:"line"`
	LinesTotal  int                    `json:"lines_total"`
	BytesSent   int64                  `json:"bytes_sent"`
	RateLPS     float64                `json:"rate_lps"`
	ETASec      float64                `json:"eta_sec"`
	Event       string                 `json:"event"`
	Error       *string                `json:"error"`
	Extra       map[string]interface{} `json:"extra"`
}

type DNCProgressService struct {
	js   jetstream.JetStream
	repo *Repository
}

func NewDNCProgressService(js jetstream.JetStream, repo *Repository) *DNCProgressService {
	return &DNCProgressService{js: js, repo: repo}
}

func (s *DNCProgressService) Run(ctx context.Context) {
	const streamName = "DNC_PROGRESS"
	// Ensure stream exists
	stream, err := s.js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     streamName,
		Subjects: []string{streamName + ".>"},
	})
	if err != nil {
		log.Printf("DNC: could not create stream, trying to use existing: %v", err)
		stream, err = s.js.Stream(ctx, streamName)
		if err != nil {
			log.Printf("DNC: failed to get stream: %v", err)
			return
		}
	}

	consumer, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:   "DNC_PROCESSOR",
		AckPolicy: jetstream.AckExplicitPolicy,
	})
	if err != nil {
		log.Printf("DNC: failed to create consumer: %v", err)
		return
	}

	log.Println("DNC progress consumer started")
	for {
		select {
		case <-ctx.Done():
			return
		default:
			msgs, err := consumer.Fetch(50, jetstream.FetchMaxWait(5*time.Second))
			if err != nil {
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					continue
				}
				log.Printf("DNC: fetch error: %v", err)
				time.Sleep(time.Second)
				continue
			}
			for msg := range msgs.Messages() {
				var wire wireDNCEvent
				if err := json.Unmarshal(msg.Data(), &wire); err != nil {
					log.Printf("DNC: bad JSON, terminating msg: %v", err)
					_ = msg.Term()
					continue
				}
				// Parse timestamp
				t, err := time.Parse(time.RFC3339, wire.TS)
				if err != nil { t = time.Now().UTC() }
				// Map to repository model
				ev := DNCEvent{
					Time:       t,
					TransferID: wire.TransferID,
					MachineID:  wire.MachineID,
					State:      wire.State,
					Line:       wire.Line,
					LinesTotal: wire.LinesTotal,
					BytesSent:  wire.BytesSent,
					RateLPS:    wire.RateLPS,
					ETASec:     wire.ETASec,
					Event:      wire.Event,
					Error:      wire.Error,
					Extra:      wire.Extra,
				}
				if err := s.repo.UpsertDNCTransfer(ctx, ev); err != nil {
					log.Printf("DNC: upsert transfer failed: %v", err)
					_ = msg.NakWithDelay(5 * time.Second)
					continue
				}
				if err := s.repo.InsertDNCEvent(ctx, ev); err != nil {
					log.Printf("DNC: insert event failed: %v", err)
					_ = msg.NakWithDelay(5 * time.Second)
					continue
				}
				_ = msg.Ack()
			}
		}
	}
}

