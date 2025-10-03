// internal/platform/messaging/nats.go
package messaging

import (
	"fmt"
	"log"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"cnc-monitor/internal/config"
)

func NewNATSConnection(natsConfig config.NATSConfig) (*nats.Conn, jetstream.JetStream, error) {
	nc, err := nats.Connect(natsConfig.URL)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, nil, fmt.Errorf("failed to create jetstream context: %w", err)
	}

	log.Println("Successfully connected to NATS JetStream.")
	return nc, js, nil
}
