package buffering

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"os"
	"sync"
	"time"
)

// ColdBuffer provides a simple, append-only log file for durable storage.
// It's the last line of defense for data that cannot be buffered in the
// hot or warm tiers.
type ColdBuffer struct {
	file     *os.File
	writer   *bufio.Writer
	filePath string
	maxSize  int64
	mu       sync.Mutex
}

// NewColdBuffer creates a new append-only log file for cold storage.
func NewColdBuffer(filePath string, maxSize int64) (*ColdBuffer, error) {
	file, err := os.OpenFile(filePath, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return nil, err
	}

	return &ColdBuffer{
		file:     file,
		writer:   bufio.NewWriter(file),
		filePath: filePath,
		maxSize:  maxSize,
	}, nil
}

// Write appends data to the cold storage log.
// It also handles file rotation when the max size is reached.
func (cb *ColdBuffer) Write(data []byte) error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	// Check for rotation before writing.
	if err := cb.rotate(); err != nil {
		return err
	}

	// Write data length, then data, for simple framing.
	lenBuf := make([]byte, 4)
	binary.BigEndian.PutUint32(lenBuf, uint32(len(data)))

	if _, err := cb.writer.Write(lenBuf); err != nil {
		return err
	}

	_, err := cb.writer.Write(data)
	return err
}

// Flush commits any buffered data to the disk.
func (cb *ColdBuffer) Flush() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.writer.Flush()
}

// Close flushes the buffer and closes the underlying file.
func (cb *ColdBuffer) Close() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err := cb.writer.Flush(); err != nil {
		return err
	}
	return cb.file.Close()
}

// rotate checks the file size and rotates the log if it exceeds the max size.
func (cb *ColdBuffer) rotate() error {
	stat, err := cb.file.Stat()
	if err != nil {
		return err
	}

	if stat.Size() < cb.maxSize {
		return nil // No rotation needed.
	}

	// Close the current file.
	if err := cb.Close(); err != nil {
		return err
	}

	// Rename the old file with a timestamp.
	backupPath := fmt.Sprintf("%s.%s", cb.filePath, time.Now().Format("20060102-150405"))
	if err := os.Rename(cb.filePath, backupPath); err != nil {
		return err
	}

	// Create a new file.
	newFile, err := os.OpenFile(cb.filePath, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return err
	}

	cb.file = newFile
	cb.writer = bufio.NewWriter(newFile)
	return nil
}
