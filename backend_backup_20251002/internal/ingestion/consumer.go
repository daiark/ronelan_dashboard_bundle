// internal/ingestion/consumer.go
package ingestion

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"log"
	"os"
	"time"

	"github.com/nats-io/nats.go/jetstream"
	"cnc-monitor/internal/config"
)

// errMessageTerminated is a sentinel error used to indicate that a message
// has been terminated (not NAK'd or ACK'd by the caller).
var errMessageTerminated = errors.New("message terminated due to unmarshalling error")

type Service struct {
	js   jetstream.JetStream
	repo *Repository
	cfg  config.NATSConfig
}

func NewService(js jetstream.JetStream, repo *Repository, cfg config.NATSConfig) *Service {
	return &Service{
		js:   js,
		repo: repo,
		cfg:  cfg,
	}
}

// Run starts the ingestion service consumer.
func (s *Service) Run(ctx context.Context) {
	// Create the stream if it doesn't exist.
	stream, err := s.js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     s.cfg.StreamName,
		Subjects: []string{s.cfg.StreamName + ".>"}, // e.g., "CNC_DATA.>"
	})
	if err != nil {
		log.Printf("could not create stream, will try to use existing: %v", err)
		// Try to get existing stream
		stream, err = s.js.Stream(ctx, s.cfg.StreamName)
		if err != nil {
			log.Fatalf("failed to get stream: %v", err)
		}
	}

	// Create a durable, pull-based consumer.
	consumer, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:   s.cfg.ConsumerName,
		AckPolicy: jetstream.AckExplicitPolicy,
	})
	if err != nil {
		log.Fatalf("failed to create consumer: %v", err)
	}

	log.Println("Ingestion service started, waiting for messages...")

	for {
		select {
		case <-ctx.Done():
			log.Println("Ingestion service stopping.")
			return
		default:
			// Fetch messages in batches.
			msgs, err := consumer.Fetch(10, jetstream.FetchMaxWait(5*time.Second))
			if err != nil {
				// Don't log context cancellation errors on shutdown
				if err == context.Canceled || err == context.DeadlineExceeded {
					continue
				}
				log.Printf("Error fetching messages: %v", err)
				time.Sleep(1 * time.Second) // Backoff on error
				continue
			}

			for msg := range msgs.Messages() {
				processErr := s.processMessage(ctx, msg)
				if processErr != nil {
					// If the message was terminated due to unmarshalling error, do nothing.
					if errors.Is(processErr, errMessageTerminated) {
						// Message already handled (terminated), no further action needed.
						continue
					}

					// Otherwise, it's a retriable error (e.g., DB issue).
					metadata, _ := msg.Metadata()
					if metadata != nil {
						log.Printf("Failed to process message (seq: %d): %v", metadata.Sequence.Stream, processErr)
					} else {
						log.Printf("Failed to process message: %v", processErr)
					}
					// Negative-acknowledgement to have it redelivered after a delay.
					if nakErr := msg.NakWithDelay(5 * time.Second); nakErr != nil {
						log.Printf("Failed to NAK message: %v", nakErr)
					}
				} else {
					// Acknowledge the message only on successful processing.
					if ackErr := msg.Ack(); ackErr != nil {
						log.Printf("Failed to ack message: %v", ackErr)
					}
				}
			}
		}
	}
}

// processMessage unmarshals and persists a single message.
// It returns a non-nil error only for retriable issues (e.g., database connection).
// Malformed messages are terminated and errMessageTerminated is returned.
func (s *Service) processMessage(ctx context.Context, msg jetstream.Msg) error {
	// Debug (guarded): Log the raw message data
	rawData := msg.Data()
	if os.Getenv("CNC_DEBUG") != "" {
		log.Printf("DEBUG: Received message length=%d, data=%q", len(rawData), string(rawData))
	}

	offset := 0
	for offset < len(rawData) {
		// Check if there are at least 4 bytes for the length prefix
		if len(rawData)-offset < 4 {
			log.Printf("Error: Remaining message data too short (%d bytes) to contain length prefix. Message will be terminated.", len(rawData)-offset)
			if termErr := msg.Term(); termErr != nil {
				log.Printf("Failed to terminate message: %v", termErr)
			}
			return errMessageTerminated
		}

		// Extract the 4-byte length prefix
		jsonLen := binary.BigEndian.Uint32(rawData[offset : offset+4])
		offset += 4

		// Ensure the rawData contains the full JSON payload as indicated by jsonLen
		if uint32(len(rawData)-offset) < jsonLen {
			log.Printf("Error: Received message length mismatch. Expected %d bytes, got %d bytes after prefix. Message will be terminated.", jsonLen, len(rawData)-offset)
			if termErr := msg.Term(); termErr != nil {
				log.Printf("Failed to terminate message: %v", termErr)
			}
			return errMessageTerminated
		}

		// Extract the actual JSON payload
		jsonPayload := rawData[offset : offset+int(jsonLen)]
		offset += int(jsonLen)

		var data SensorData
		if err := json.Unmarshal(jsonPayload, &data); err != nil {
			log.Printf("Error unmarshalling message data: %v. Message will be terminated.", err)
			if os.Getenv("CNC_DEBUG") != "" {
				log.Printf("DEBUG: Failed JSON data: %q", string(jsonPayload))
			}
			// Terminate the message if it's malformed to prevent redelivery loops.
			if termErr := msg.Term(); termErr != nil {
				log.Printf("Failed to terminate message: %v", termErr)
			}
			return errMessageTerminated // Return sentinel error
		}

		// DEBUG: Log the unmarshaled data to verify sequence number is populated
		if os.Getenv("CNC_DEBUG") != "" {
			log.Printf("DEBUG: Unmarshaled data - MachineID: %s, SequenceNumber: %d, Timestamp: %s", 
				data.MachineID, data.SequenceNumber, data.Timestamp)
		}

		// Validate sequence number is not zero
		if data.SequenceNumber == 0 {
			log.Printf("ERROR: Sequence number is zero after unmarshaling. JSON: %q", string(jsonPayload))
			// Terminate the message as this indicates a data integrity issue
			if termErr := msg.Term(); termErr != nil {
				log.Printf("Failed to terminate message: %v", termErr)
			}
			return errMessageTerminated
		}

		// Persist the data using the repository.
		if err := s.repo.InsertSensorData(ctx, data); err != nil {
			// This is a potentially transient error (e.g., DB down), so we return it
			// to the caller, which will NAK the message for redelivery.
			return err
		}

		log.Printf("Successfully processed and stored data for machine: %s", data.MachineID)
	}

	return nil
}
