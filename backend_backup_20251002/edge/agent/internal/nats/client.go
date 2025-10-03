package nats

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"cnc-monitor/edge/config"
	"cnc-monitor/edge/internal/buffering"
	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"
)

// Client implements the buffering.Processor interface for NATS.
// It connects to a NATS server and publishes batches of data.
type Client struct {
	config config.NATSConfig
	conn   *nats.Conn
	js     nats.JetStreamContext
	
	// Connection stability tracking
	lastConnected    atomic.Value // time.Time
	disconnectCount  atomic.Uint64
	reconnectCount   atomic.Uint64
	messagesPublished atomic.Uint64
	publishErrors    atomic.Uint64
}

// NewClient creates a new NATS client.
func NewClient(config config.NATSConfig) (*Client, error) {
	client := &Client{config: config}
	client.lastConnected.Store(time.Time{})
	return client, nil
}

// Start establishes a connection to the NATS server and creates a JetStream context.
func (c *Client) Start() error {
	opts := []nats.Option{
		nats.Name("CNC Edge Agent"),
		nats.MaxReconnects(c.config.MaxReconnects),
		nats.ReconnectWait(c.config.ReconnectDelay),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			c.disconnectCount.Add(1)
			disconnects := c.disconnectCount.Load()
			lastConnected := c.lastConnected.Load().(time.Time)
			var uptime time.Duration
			if !lastConnected.IsZero() {
				uptime = time.Since(lastConnected)
			}
			log.Warn().
				Err(err).
				Uint64("disconnect_count", disconnects).
				Dur("uptime", uptime).
				Msg("NATS disconnected")
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			c.reconnectCount.Add(1)
			c.lastConnected.Store(time.Now())
			reconnects := c.reconnectCount.Load()
			
			log.Info().
				Str("url", nc.ConnectedUrl()).
				Uint64("reconnect_count", reconnects).
				Msg("NATS reconnected")
			
			// Recreate JetStream context after reconnection
			if js, err := nc.JetStream(nats.PublishAsyncMaxPending(256)); err != nil {
				log.Error().Err(err).Msg("Failed to recreate JetStream context after reconnection")
			} else {
				c.js = js
				log.Info().Msg("JetStream context recreated after NATS reconnection")
			}
		}),
		nats.ClosedHandler(func(nc *nats.Conn) {
			log.Info().Msg("NATS connection closed")
		}),
	}

	if c.config.Credentials != "" {
		opts = append(opts, nats.UserCredentials(c.config.Credentials))
	}

	if c.config.TLS.Enabled {
		opts = append(opts, nats.Secure(nil)) // Basic TLS, can be enhanced with custom TLS config
	}

	nc, err := nats.Connect(c.config.URL, opts...)
	if err != nil {
		return err
	}
	c.conn = nc
	c.lastConnected.Store(time.Now())

	js, err := nc.JetStream(nats.PublishAsyncMaxPending(256))
	if err != nil {
		return fmt.Errorf("failed to create JetStream context: %w", err)
	}
	c.js = js

	// Check if the stream already exists.
	streamInfo, err := js.StreamInfo(c.config.Stream)
	if err != nil {
		if err == nats.ErrStreamNotFound {
			log.Info().Str("stream", c.config.Stream).Msg("Stream not found, creating it...")
			// If it doesn't exist, create it.
			_, err = js.AddStream(&nats.StreamConfig{
				Name:      c.config.Stream,
				Subjects:  []string{c.config.SubjectPrefix + ".>"}, // Use wildcard for all sub-subjects
				Storage:   nats.FileStorage,
				Retention: nats.LimitsPolicy,
			})
			if err != nil {
				return fmt.Errorf("failed to create JetStream stream: %w", err)
			}
			log.Info().Str("stream", c.config.Stream).Msg("Stream created successfully.")
		} else {
			// For other errors, return them.
			return fmt.Errorf("failed to get stream info: %w", err)
		}
	} else {
		log.Info().Str("stream", streamInfo.Config.Name).Msg("JetStream stream already exists.")
	}

	log.Info().Str("url", c.config.URL).Msg("NATS client connected and stream ensured")
	return nil
}

// IsConnected returns true if the NATS connection is active
func (c *Client) IsConnected() bool {
	return c.conn != nil && c.conn.IsConnected() && c.js != nil
}

// Shutdown gracefully closes the NATS connection.
func (c *Client) Shutdown() {
	if c.conn != nil && !c.conn.IsClosed() {
		c.conn.Drain()
	}
	log.Info().Msg("NATS client shutdown complete")
}

// Process publishes a batch of data to NATS JetStream.
// It implements the buffering.Processor interface.
func (c *Client) Process(ctx context.Context, batch buffering.Batch) error {
	if c.js == nil {
		log.Error().Msg("JetStream context is nil in Process")
		return &NATSError{Message: "not connected to JetStream"}
	}

		subject := c.config.SubjectPrefix + ".data"

	for _, msgData := range batch {
		// For now, we publish messages one by one. NATS recommends this for JetStream
		// to get individual acknowledgements.
		ack, err := c.js.Publish(subject, msgData)
		if err != nil {
			c.publishErrors.Add(1)
			errors := c.publishErrors.Load()
			published := c.messagesPublished.Load()
			errorRate := float64(errors) / float64(published+errors) * 100
			
			log.Warn().
				Err(err).
				Uint64("publish_errors", errors).
				Float64("error_rate_pct", errorRate).
				Msg("Failed to publish message to NATS")
			return err // Returning on first error
		}
		
		c.messagesPublished.Add(1)
		log.Debug().Str("stream", ack.Stream).Uint64("seq", ack.Sequence).Msg("Published message")
	}

	log.Debug().Int("batch_size", len(batch)).Str("subject", subject).Msg("Batch published to NATS")
	return nil
}

// NATSError represents NATS-related errors
type NATSError struct {
	Message string
}

func (e *NATSError) Error() string {
	return e.Message
}

// GetConnectionStats returns connection stability metrics
func (c *Client) GetConnectionStats() map[string]interface{} {
	lastConnected := c.lastConnected.Load().(time.Time)
	var uptime time.Duration
	if !lastConnected.IsZero() {
		uptime = time.Since(lastConnected)
	}
	
	published := c.messagesPublished.Load()
	errors := c.publishErrors.Load()
	var errorRate float64
	if published+errors > 0 {
		errorRate = float64(errors) / float64(published+errors) * 100
	}
	
	return map[string]interface{}{
		"connected":          c.IsConnected(),
		"uptime_seconds":     uptime.Seconds(),
		"disconnect_count":   c.disconnectCount.Load(),
		"reconnect_count":    c.reconnectCount.Load(),
		"messages_published": published,
		"publish_errors":     errors,
		"error_rate_pct":     errorRate,
		"last_connected":     lastConnected,
	}
}
