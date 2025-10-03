package buffering

import (
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"cnc-monitor/edge/config"
	"github.com/rs/zerolog/log"
)

// SensorData represents a complete CNC machine reading matching backend format
type SensorData struct {
	MachineID         string    `json:"machine_id"`
	SequenceNumber    uint64    `json:"sequence_number"`    // Monotonic sequence per machine
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

// Batch represents a collection of sensor data to be processed.
type Batch [][]byte

// Processor is an interface for components that handle batches of data.
type Processor interface {
	Process(ctx context.Context, batch Batch) error
}

// ConnectivityChecker extends Processor with connection status checking
type ConnectivityChecker interface {
	Processor
	IsConnected() bool
}

// Manager orchestrates the data flow from producers to a processor.
// It uses offline buffering for reliability with real-time transmission.
type Manager struct {
	config       config.BufferingConfig
	hotBuffer    *HotBuffer
	warmBuffer   *WarmBuffer
	coldBuffer   *ColdBuffer
	offlineBuffer *OfflineBuffer
	processor    Processor
	batchSize    int
	batchTimeout time.Duration
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	
	// Sequence number tracking
	seqMutex     sync.Mutex
	sequenceNum  uint64
}

// NewManager creates a new buffer manager with offline capabilities.
func NewManager(config config.BufferingConfig, processor Processor) (*Manager, error) {
	// Initialize offline buffer with configuration
	offlineConfig := OfflineConfig{
		DataDir:      "/var/tmp/cnc-agent/offline",
		MaxFileSize:  10 * 1024 * 1024, // 10MB per file
		MaxRetention: 7 * 24 * time.Hour, // Keep 7 days
		SyncInterval: 30 * time.Second,   // Try sync every 30s
	}

	offlineBuffer, err := NewOfflineBuffer(offlineConfig, processor)
	if err != nil {
			return nil, fmt.Errorf("failed to create offline buffer: %w", err)
	}

	// Keep existing buffers for compatibility (but use offline buffer as primary)
	hotBuffer, err := NewHotBuffer(config.HotBuffer.Capacity)
	if err != nil {
		return nil, err
	}

	warmBuffer, err := NewWarmBuffer(config.WarmBuffer.Path, config.WarmBuffer.Size)
	if err != nil {
		return nil, err
	}

	coldBuffer, err := NewColdBuffer(config.ColdBuffer.Path, config.ColdBuffer.MaxSize)
	if err != nil {
		return nil, err
	}

	manager := &Manager{
		config:        config,
		hotBuffer:     hotBuffer,
		warmBuffer:    warmBuffer,
		coldBuffer:    coldBuffer,
		offlineBuffer: offlineBuffer,
		processor:     processor,
		batchSize:     config.Batching.Size,
		batchTimeout:  config.Batching.Timeout,
	}
	
	// Load persisted sequence number
	if err := manager.loadSequenceNumber(); err != nil {
		log.Warn().Err(err).Msg("Failed to load sequence number, starting from 0")
	}
	
	return manager, nil
}

// Start launches the manager's processing loop.
func (m *Manager) Start() {
	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	// Only start warm buffer retry loop (direct sending bypasses batch accumulator)
	m.wg.Add(1)
	go m.warmBufferRetryLoop(ctx)

	log.Info().Msg("Buffer manager started (direct mode)")
}

// Shutdown gracefully stops the manager.
func (m *Manager) Shutdown() {
	log.Info().Msg("Shutting down buffer manager")
	
	// Save sequence number before shutdown
	if err := m.saveSequenceNumber(); err != nil {
		log.Error().Err(err).Msg("Failed to save sequence number")
	}
	
	if m.cancel != nil {
		m.cancel()
	}
	m.wg.Wait()
	
	// Shutdown offline buffer first (most important)
	if m.offlineBuffer != nil {
		m.offlineBuffer.Shutdown()
	}
	
	// Shutdown other buffers
	if m.warmBuffer != nil {
		m.warmBuffer.Close()
	}
	if m.coldBuffer != nil {
		m.coldBuffer.Close()
	}
	
	log.Info().Msg("Buffer manager stopped")
}

// Write accepts data and handles both offline persistence and real-time transmission.
func (m *Manager) Write(data SensorData) error {
	// Assign sequence number atomically
	m.seqMutex.Lock()
	m.sequenceNum++
	data.SequenceNumber = m.sequenceNum
	seq := m.sequenceNum
	m.seqMutex.Unlock()
	
	// Periodically save sequence number to disk (every 100 messages)
	if seq%100 == 0 {
		go func() {
			if err := m.saveSequenceNumber(); err != nil {
				log.Error().Err(err).Msg("Failed to save sequence number")
			}
		}()
	}
	
	// Use offline buffer for dual-path processing (file + NATS)
	return m.offlineBuffer.Write(data)
}

// GetStats returns comprehensive buffer statistics
func (m *Manager) GetStats() map[string]interface{} {
	stats := make(map[string]interface{})
	
	if m.offlineBuffer != nil {
		stats["offline"] = m.offlineBuffer.GetStats()
	}
	
	// Add other buffer stats if needed
	if m.hotBuffer != nil {
		stats["hot_buffer_available"] = m.hotBuffer.AvailableBytes()
		stats["hot_buffer_capacity"] = m.hotBuffer.Capacity()
	}
	
	return stats
}

func (m *Manager) batchAccumulator(ctx context.Context) {
	defer m.wg.Done()

	ticker := time.NewTicker(m.batchTimeout)
	defer ticker.Stop()

	batch := make(Batch, 0, m.batchSize)

	for {
		select {
		case <-ctx.Done():
			if len(batch) > 0 {
				m.sendBatch(ctx, batch)
			}
			return

		case <-ticker.C:
			if len(batch) > 0 {
				m.sendBatch(ctx, batch)
				batch = make(Batch, 0, m.batchSize) // Create a new empty batch
			}

		default:
			msgData, bytesRead := m.readFrame()

			if msgData == nil {
				time.Sleep(5 * time.Millisecond)
				continue
			}

			batch = append(batch, msgData)
			m.hotBuffer.CommitRead(bytesRead)

			if len(batch) >= m.batchSize {
				m.sendBatch(ctx, batch)
				batch = make(Batch, 0, m.batchSize) // Create a new empty batch
				ticker.Reset(m.batchTimeout)
			}
		}
	}
}

func (m *Manager) readFrame() ([]byte, uint64) {
	b1, b2 := m.hotBuffer.Read()
	available := len(b1) + len(b2)

	if available == 0 {
		return nil, 0
	}

	// Combine b1 and b2 into single buffer for processing
	var buffer []byte
	if b2 == nil || len(b2) == 0 {
		buffer = b1
	} else {
		buffer = make([]byte, len(b1)+len(b2))
		copy(buffer, b1)
		copy(buffer[len(b1):], b2)
	}

	// Find the first newline (message delimiter)
	var msgEnd int = -1
	for i, b := range buffer {
		if b == '\n' {
			msgEnd = i
			break
		}
	}

	if msgEnd == -1 {
		// No complete message found
		return nil, 0
	}

	// Extract the JSON message (without the newline)
	msgData := make([]byte, msgEnd)
	copy(msgData, buffer[:msgEnd])

	// Return message data and total bytes consumed (including newline)
	return msgData, uint64(msgEnd + 1)
}

func (m *Manager) sendBatch(ctx context.Context, batch Batch) {
	if err := m.processor.Process(ctx, batch); err != nil {
		log.Error().Err(err).Msg("Failed to process batch, writing to warm buffer")
		for _, msg := range batch { // msg here is the raw JSON payload
			// Re-add the length prefix before writing to warm buffer
			msgLen := len(msg)
			totalLen := 4 + msgLen
			buf := make([]byte, totalLen)
			binary.BigEndian.PutUint32(buf[:4], uint32(msgLen))
			copy(buf[4:], msg)

			if _, err := m.warmBuffer.Write(buf); err != nil { // Write the length-prefixed buffer
				log.Error().Err(err).Msg("Failed to write to warm buffer, writing to cold buffer")
				m.coldBuffer.Write(buf) // Also write length-prefixed to cold buffer
			}
		}
	}
}

func (m *Manager) warmBufferRetryLoop(ctx context.Context) {
	defer m.wg.Done()
	ticker := time.NewTicker(10 * time.Second) // Retry every 10 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			batch, err := m.warmBuffer.ReadBatch(m.batchSize)
			if err != nil {
				log.Error().Err(err).Msg("Failed to read from warm buffer")
				continue
			}

			if len(batch) > 0 {
				m.sendBatch(ctx, batch)
			}
		}
	}
}

// loadSequenceNumber loads the persisted sequence number from disk.
func (m *Manager) loadSequenceNumber() error {
	seqFile := "/var/tmp/cnc-agent/sequence.txt"
	
	data, err := os.ReadFile(seqFile)
	if err != nil {
		if os.IsNotExist(err) {
			m.sequenceNum = 0
			return nil // Starting fresh is OK
		}
		return fmt.Errorf("failed to read sequence file: %w", err)
	}
	
	seq, err := strconv.ParseUint(string(data), 10, 64)
	if err != nil {
		return fmt.Errorf("failed to parse sequence number: %w", err)
	}
	
	m.sequenceNum = seq
	log.Info().Uint64("sequence", seq).Msg("Loaded sequence number from disk")
	return nil
}

// saveSequenceNumber persists the current sequence number to disk.
func (m *Manager) saveSequenceNumber() error {
	seqFile := "/var/tmp/cnc-agent/sequence.txt"
	
	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(seqFile), 0755); err != nil {
		return fmt.Errorf("failed to create sequence directory: %w", err)
	}
	
	m.seqMutex.Lock()
	seq := m.sequenceNum
	m.seqMutex.Unlock()
	
	err := os.WriteFile(seqFile, []byte(strconv.FormatUint(seq, 10)), 0644)
	if err != nil {
		return fmt.Errorf("failed to write sequence file: %w", err)
	}
	
	log.Info().Uint64("sequence", seq).Msg("Saved sequence number to disk")
	return nil
}
