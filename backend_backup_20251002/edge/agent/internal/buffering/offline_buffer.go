package buffering

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"
)

// OfflineBuffer provides file-based persistence with real-time NATS fallback
type OfflineBuffer struct {
	// Configuration
	dataDir       string
	maxFileSize   int64
	maxRetention  time.Duration
	syncInterval  time.Duration

	// State
	online         atomic.Bool
	lastOnline     time.Time
	syncInProgress atomic.Bool
	
	// File handling
	currentFile   *os.File
	currentPath   string
	fileMutex     sync.Mutex
	
	// Network processor
	processor Processor
	
	// Connectivity checker (if processor supports it)
	connectivityChecker ConnectivityChecker
	
	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// OfflineConfig configures the offline buffer
type OfflineConfig struct {
	DataDir       string        `yaml:"data_dir"`
	MaxFileSize   int64         `yaml:"max_file_size"`   // Bytes before rotation
	MaxRetention  time.Duration `yaml:"max_retention"`   // How long to keep files
	SyncInterval  time.Duration `yaml:"sync_interval"`   // How often to try sync
}

// NewOfflineBuffer creates a new offline buffer with file persistence
func NewOfflineBuffer(config OfflineConfig, processor Processor) (*OfflineBuffer, error) {
	// Ensure data directory exists
	if err := os.MkdirAll(config.DataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}
	
	// Create sync subdirectory
	syncDir := filepath.Join(config.DataDir, "sync")
	if err := os.MkdirAll(syncDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create sync directory: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	
	buffer := &OfflineBuffer{
		dataDir:      config.DataDir,
		maxFileSize:  config.MaxFileSize,
		maxRetention: config.MaxRetention,
		syncInterval: config.SyncInterval,
		processor:    processor,
		ctx:          ctx,
		cancel:       cancel,
	}
	
	// Check if processor supports connectivity checking
	if checker, ok := processor.(ConnectivityChecker); ok {
		buffer.connectivityChecker = checker
		log.Info().Msg("Processor supports direct connectivity checking")
	} else {
		log.Info().Msg("Using fallback connectivity test messages")
	}

	// Initialize current file
	if err := buffer.initCurrentFile(); err != nil {
		return nil, fmt.Errorf("failed to initialize current file: %w", err)
	}

	// Start background sync loop
	buffer.wg.Add(1)
	go buffer.syncLoop()
	
	// Start file rotation monitor
	buffer.wg.Add(1)
	go buffer.rotationLoop()
	
	// Test initial connectivity
	go buffer.testConnectivity()

	log.Info().
		Str("data_dir", config.DataDir).
		Int64("max_file_size", config.MaxFileSize).
		Dur("sync_interval", config.SyncInterval).
		Msg("Offline buffer initialized")

	return buffer, nil
}

// Write stores data locally and attempts real-time transmission
func (b *OfflineBuffer) Write(data SensorData) error {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	// Attempt real-time transmission if online
	if b.online.Load() {
		if err := b.sendToNATS(jsonBytes); err != nil {
			log.Warn().Err(err).Msg("NATS transmission failed, writing to file buffer")
			// Only write to file if NATS fails
			if writeErr := b.writeToFile(jsonBytes); writeErr != nil {
				log.Error().Err(writeErr).Msg("Failed to write to local file")
				return writeErr
			}
			b.setOffline()
		}
		// If NATS succeeds, don't write to file (no duplication)
	} else {
		// If offline, write to file only
		if err := b.writeToFile(jsonBytes); err != nil {
			log.Error().Err(err).Msg("Failed to write to local file")
			return err
		}
	}

	return nil
}

// Process implements the Processor interface for compatibility
func (b *OfflineBuffer) Process(ctx context.Context, batch Batch) error {
	for _, data := range batch {
		// Extract JSON from length-prefixed format
		if len(data) < 4 {
			continue
		}
		jsonData := data[4:] // Skip 4-byte length prefix
		
		var sensorData SensorData
		if err := json.Unmarshal(jsonData, &sensorData); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal sensor data")
			continue
		}
		
		if err := b.Write(sensorData); err != nil {
			return err
		}
	}
	return nil
}

// writeToFile atomically writes data to the current file
func (b *OfflineBuffer) writeToFile(jsonBytes []byte) error {
	b.fileMutex.Lock()
	defer b.fileMutex.Unlock()

	if b.currentFile == nil {
		if err := b.initCurrentFile(); err != nil {
			return err
		}
	}

	// Write JSON + newline
	if _, err := b.currentFile.Write(jsonBytes); err != nil {
		return err
	}
	if _, err := b.currentFile.Write([]byte("\n")); err != nil {
		return err
	}

	// Force to disk
	if err := b.currentFile.Sync(); err != nil {
		return err
	}

	return nil
}

// sendToNATS attempts real-time transmission
func (b *OfflineBuffer) sendToNATS(jsonBytes []byte) error {
	// Add length prefix for NATS compatibility
	msgLen := len(jsonBytes)
	totalLen := 4 + msgLen
	buf := make([]byte, totalLen)
	
	// Use binary encoding for length prefix
	buf[0] = byte(msgLen >> 24)
	buf[1] = byte(msgLen >> 16)
	buf[2] = byte(msgLen >> 8)
	buf[3] = byte(msgLen)
	copy(buf[4:], jsonBytes)

	batch := Batch{buf}
	return b.processor.Process(b.ctx, batch)
}

// initCurrentFile creates or opens the current write file
func (b *OfflineBuffer) initCurrentFile() error {
	b.currentPath = filepath.Join(b.dataDir, "current.jsonl")
	
	file, err := os.OpenFile(b.currentPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	
	b.currentFile = file
	return nil
}

// rotateFile moves current file to sync directory with timestamp
func (b *OfflineBuffer) rotateFile() error {
	b.fileMutex.Lock()
	defer b.fileMutex.Unlock()

	if b.currentFile == nil {
		return nil
	}

	// Close current file
	if err := b.currentFile.Close(); err != nil {
		log.Error().Err(err).Msg("Error closing current file")
	}

	// Move to sync directory with timestamp
	timestamp := time.Now().Format("20060102_150405")
	syncPath := filepath.Join(b.dataDir, "sync", fmt.Sprintf("%s.jsonl", timestamp))
	
	if err := os.Rename(b.currentPath, syncPath); err != nil {
		log.Error().Err(err).Msg("Failed to rotate file")
		// Try to reopen current file
		b.initCurrentFile()
		return err
	}

	log.Info().Str("file", syncPath).Msg("File rotated for sync")

	// Create new current file
	return b.initCurrentFile()
}

// testConnectivity checks if NATS is available
func (b *OfflineBuffer) testConnectivity() {
	wasOnline := b.online.Load()
	
	// Use direct connection checking if available
	if b.connectivityChecker != nil {
		isConnected := b.connectivityChecker.IsConnected()
		if isConnected {
			b.setOnline()
		} else {
			b.setOffline()
		}
		
		// Log state changes only
		if !wasOnline && isConnected {
			log.Info().Msg("Connectivity restored - transitioning to online")
		} else if wasOnline && !isConnected {
			log.Info().Msg("Connectivity lost - transitioning to offline")
		}
		return
	}
	
	// Fallback to test message approach
	testData := []byte(`{"test":"connectivity"}`)
	if err := b.sendToNATS(testData); err != nil {
		b.setOffline()
	} else {
		b.setOnline()
	}
}

// setOnline marks the buffer as online
func (b *OfflineBuffer) setOnline() {
	if !b.online.Load() {
		b.online.Store(true)
		b.lastOnline = time.Now()
		log.Info().Msg("🟢 Buffer ONLINE - real-time transmission + local persistence enabled")

		// Immediately trigger sync when going online
		log.Info().Msg("🚀 Triggering immediate sync after going online")
		// Run synchronously to prevent race conditions
		b.syncOfflineFiles()
	}
}

// setOffline marks the buffer as offline
func (b *OfflineBuffer) setOffline() {
	if b.online.Load() {
		b.online.Store(false)
		offlineDuration := time.Since(b.lastOnline).Round(time.Second)
		log.Warn().
			Time("offline_since", time.Now()).
			Dur("was_online_for", offlineDuration).
			Msg("🔴 Buffer OFFLINE - local file persistence only")
	}
}

// syncLoop periodically attempts to sync offline files
func (b *OfflineBuffer) syncLoop() {
	defer b.wg.Done()
	
	ticker := time.NewTicker(b.syncInterval)
	defer ticker.Stop()
	
	// More frequent connectivity testing when offline
	connectivityTicker := time.NewTicker(5 * time.Second)
	defer connectivityTicker.Stop()

	for {
		select {
		case <-b.ctx.Done():
			return
		case <-connectivityTicker.C:
			// Test connectivity more frequently
			b.testConnectivity()
		case <-ticker.C:
			// Main sync interval - attempt file sync if online
			online := b.online.Load()
			syncInProgress := b.syncInProgress.Load()
			
			log.Info().
				Bool("online", online).
				Bool("sync_in_progress", syncInProgress).
				Dur("sync_interval", b.syncInterval).
				Msg("🔄 Sync interval tick")
			
			if online && !syncInProgress {
				log.Info().Msg("🚀 Starting periodic offline file sync")
				b.syncOfflineFiles()
			} else if !online {
				log.Info().Msg("⏸️ Skipping sync - offline")
			} else {
				log.Info().Msg("⏸️ Skipping sync - already in progress")
			}
		}
	}
}

// rotationLoop monitors file size and rotates when needed
func (b *OfflineBuffer) rotationLoop() {
	defer b.wg.Done()
	
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-b.ctx.Done():
			return
		case <-ticker.C:
			b.checkFileRotation()
			b.cleanupOldFiles()
		}
	}
}

// checkFileRotation rotates file if it exceeds max size
func (b *OfflineBuffer) checkFileRotation() {
	if b.currentFile == nil {
		return
	}

	stat, err := b.currentFile.Stat()
	if err != nil {
		return
	}

	if stat.Size() > b.maxFileSize {
		log.Info().Int64("size", stat.Size()).Msg("Rotating file due to size limit")
		if err := b.rotateFile(); err != nil {
			log.Error().Err(err).Msg("File rotation failed")
		}
	}
}

// checkCurrentFileRotation rotates current file if it has data and we're online
func (b *OfflineBuffer) checkCurrentFileRotation() error {
	b.fileMutex.Lock()
	defer b.fileMutex.Unlock()

	if b.currentFile == nil {
		log.Info().Msg("🔄 No current file to rotate")
		return nil
	}

	stat, err := b.currentFile.Stat()
	if err != nil {
		log.Error().Err(err).Msg("Failed to stat current file")
		return err
	}

	// If current file has data and we're online, rotate it for sync
	if stat.Size() > 0 && b.online.Load() {
		log.Info().Int64("size", stat.Size()).Msg("🔄 Rotating current file for sync")
		return b.rotateFileLocked()
	}

	log.Info().Int64("size", stat.Size()).Bool("online", b.online.Load()).Msg("🔄 No rotation needed")
	return nil
}

// rotateFileLocked moves current file to sync directory with timestamp.
// It assumes the fileMutex is already held.
func (b *OfflineBuffer) rotateFileLocked() error {
	if b.currentFile == nil {
		return nil // Should not happen if called correctly
	}

	// Close current file
	if err := b.currentFile.Close(); err != nil {
		log.Error().Err(err).Msg("Error closing current file for rotation")
		// Attempt to reopen a new file anyway
		b.currentFile = nil // Force re-initialization
		return b.initCurrentFile()
	}

	// Move to sync directory with timestamp
	timestamp := time.Now().Format("20060102_150405")
	syncPath := filepath.Join(b.dataDir, "sync", fmt.Sprintf("%s.jsonl", timestamp))

	if err := os.Rename(b.currentPath, syncPath); err != nil {
		log.Error().Err(err).Msg("Failed to rotate file")
		// Try to reopen current file
		return b.initCurrentFile()
	}

	log.Info().Str("file", syncPath).Msg("File rotated for sync")

	// Create new current file
	return b.initCurrentFile()
}

// syncOfflineFiles replays files from sync directory.
// This function is now synchronous and more robust.
func (b *OfflineBuffer) syncOfflineFiles() {
	if !b.syncInProgress.CompareAndSwap(false, true) {
		log.Info().Msg("📍 Sync already in progress, skipping")
		return
	}
	defer b.syncInProgress.Store(false)

	log.Info().Msg("🚀 Starting offline file sync")

	// 1. Rotate the current file if it has data. This is a critical step.
	if err := b.checkCurrentFileRotation(); err != nil {
		log.Error().Err(err).Msg("Failed to rotate current file before sync. Sync may not proceed correctly.")
		// Depending on the error, we might want to return here.
		// For now, we'll attempt to sync any existing files.
	}

	// 2. Sync files from the sync directory
	syncDir := filepath.Join(b.dataDir, "sync")
	files, err := os.ReadDir(syncDir)
	if err != nil {
		log.Error().Err(err).Str("sync_dir", syncDir).Msg("Failed to read sync directory")
		return
	}

	if len(files) == 0 {
		log.Info().Msg("📭 No files in sync directory to replay.")
		return
	}

	// Sort files by name (timestamp order) to ensure chronological replay
	sort.Slice(files, func(i, j int) bool {
		return files[i].Name() < files[j].Name()
	})

	log.Info().Int("file_count", len(files)).Msg("Found files to sync, starting replay...")

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".jsonl") {
			continue
		}

		filePath := filepath.Join(syncDir, file.Name())
		log.Info().Str("file", filePath).Msg("Replaying file")
		if err := b.replayFile(filePath); err != nil {
			log.Error().Err(err).Str("file", filePath).Msg("Failed to replay file, stopping sync.")
			b.setOffline() // Go offline if we can't replay
			return
		}

		// Remove successfully synced file
		if err := os.Remove(filePath); err != nil {
			log.Error().Err(err).Str("file", filePath).Msg("Failed to remove synced file")
		} else {
			log.Info().Str("file", file.Name()).Msg("✅ File synced and removed")
		}
	}

	log.Info().Msg("✅ Offline file sync completed successfully")
}

// replayFile sends all records from a file to NATS
func (b *OfflineBuffer) replayFile(filePath string) error {
	log.Info().Str("file", filePath).Msg("🔄 Starting file replay")
	
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineCount := 0
	errorCount := 0
	
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		// Validate JSON
		if !json.Valid(line) {
			log.Warn().Str("line", string(line)).Msg("Skipping invalid JSON")
			errorCount++
			if errorCount > 10 {
				return fmt.Errorf("too many invalid JSON lines, aborting")
			}
			continue
		}

		// Send to NATS with timeout
		if err := b.sendToNATS(line); err != nil {
			log.Error().Err(err).Int("line", lineCount).Msg("Failed to send line to NATS")
			return fmt.Errorf("failed to send line %d: %w", lineCount, err)
		}

		lineCount++

		// Progress logging and rate limiting
		if lineCount%100 == 0 {
			log.Info().Int("lines_sent", lineCount).Msg("📊 Replay progress")
			time.Sleep(100 * time.Millisecond) // Increased delay
		}
		
		// Safety check - don't replay forever
		if lineCount > 10000 {
			log.Warn().Int("lines", lineCount).Msg("Replay limit reached, stopping")
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("error reading file: %w", err)
	}

	log.Info().Int("lines", lineCount).Int("errors", errorCount).Str("file", filepath.Base(filePath)).Msg("✅ File replay completed")
	return nil
}

// cleanupOldFiles removes files older than retention period
func (b *OfflineBuffer) cleanupOldFiles() {
	syncDir := filepath.Join(b.dataDir, "sync")
	files, err := os.ReadDir(syncDir)
	if err != nil {
		return
	}

	cutoff := time.Now().Add(-b.maxRetention)

	for _, file := range files {
		if !strings.HasSuffix(file.Name(), ".jsonl") {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		if info.ModTime().Before(cutoff) {
			filePath := filepath.Join(syncDir, file.Name())
			if err := os.Remove(filePath); err != nil {
				log.Error().Err(err).Str("file", filePath).Msg("Failed to cleanup old file")
			} else {
				log.Info().Str("file", file.Name()).Msg("Cleaned up old file")
			}
		}
	}
}

// Shutdown gracefully stops the offline buffer
func (b *OfflineBuffer) Shutdown() {
	log.Info().Msg("Shutting down offline buffer")
	
	b.cancel()
	b.wg.Wait()

	b.fileMutex.Lock()
	defer b.fileMutex.Unlock()
	
	if b.currentFile != nil {
		b.currentFile.Close()
	}

	log.Info().Msg("Offline buffer shutdown complete")
}

// GetStats returns buffer statistics
func (b *OfflineBuffer) GetStats() map[string]interface{} {
	b.fileMutex.Lock()
	defer b.fileMutex.Unlock()

	stats := map[string]interface{}{
		"online":          b.online.Load(),
		"sync_in_progress": b.syncInProgress.Load(),
		"last_online":     b.lastOnline,
	}

	// Count pending files
	syncDir := filepath.Join(b.dataDir, "sync")
	if files, err := os.ReadDir(syncDir); err == nil {
		pendingFiles := 0
		for _, file := range files {
			if strings.HasSuffix(file.Name(), ".jsonl") {
				pendingFiles++
			}
		}
		stats["pending_files"] = pendingFiles
	}

	// Current file size
	if b.currentFile != nil {
		if stat, err := b.currentFile.Stat(); err == nil {
			stats["current_file_size"] = stat.Size()
		}
	}

	return stats
}