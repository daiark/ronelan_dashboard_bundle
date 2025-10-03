package buffering

import (
	"encoding/binary"
	"io"
	"os"
	"sync"

	"golang.org/x/exp/mmap"
	"github.com/rs/zerolog/log"
)

// WarmBuffer provides a persistent, file-backed buffer using memory-mapping.
// It's designed as a second line of defense for data that fails to be processed
// from the hot buffer.
type WarmBuffer struct {
	file     *os.File
	mmap     *mmap.ReaderAt
	writePos int64
	readPos  int64
	mu       sync.Mutex
}

// NewWarmBuffer creates or opens a memory-mapped file for buffering.
func NewWarmBuffer(filePath string, size int64) (*WarmBuffer, error) {
	file, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return nil, err
	}

	fileInfo, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, err
	}

	writePos := fileInfo.Size()

	// If the file is smaller than the desired size, extend it.
	// If it's larger, we'll just use the existing size and let new writes append.
	if writePos < size {
		if err := file.Truncate(size); err != nil {
			file.Close()
			return nil, err
		}
	}

	mmap, err := mmap.Open(filePath)
	if err != nil {
		file.Close()
		return nil, err
	}

	return &WarmBuffer{
		file:     file,
		mmap:     mmap,
		writePos: writePos,
		readPos:  0, // Always start reading from the beginning of the file
	}, nil
}

// Write appends data to the memory-mapped file.
func (wb *WarmBuffer) Write(data []byte) (int, error) {
	wb.mu.Lock()
	defer wb.mu.Unlock()

	n, err := wb.file.WriteAt(data, wb.writePos)
	if err != nil {
		return 0, err
	}
	wb.writePos += int64(n)
	return n, nil
}

// ReadBatch reads a batch of length-prefixed messages from the warm buffer.
func (wb *WarmBuffer) ReadBatch(maxSize int) (Batch, error) {
	wb.mu.Lock()
	defer wb.mu.Unlock()

	batch := make(Batch, 0, maxSize)
	var bytesRead int64

	for len(batch) < maxSize {
		currentOffset := wb.readPos + bytesRead

		// If we've read all available data, break.
		if currentOffset >= wb.writePos {
			break
		}

		// Read length prefix
		lenBuf := make([]byte, 4)
		n, err := wb.mmap.ReadAt(lenBuf, currentOffset)
		if err != nil {
			if err == io.EOF {
				break // End of file, stop reading
			}
			return nil, err
		}
		if n < 4 {
			log.Warn().Msgf("WarmBuffer: Not enough data for a full length prefix at offset %d. Available: %d bytes.", currentOffset, n)
			break // Not enough data for a full length prefix
		}

		msgLen := binary.BigEndian.Uint32(lenBuf)

		// If message length is 0, skip it and continue.
		if msgLen == 0 {
			log.Debug().Msgf("WarmBuffer: Skipping 0-length message at offset %d.", currentOffset)
			bytesRead += 4 // Skip the 4-byte length prefix
			continue
		}

		// Safety check: prevent excessive memory allocation or reading beyond file bounds
		if msgLen > 1024*1024 { // 1MB max message size
			log.Error().Msgf("WarmBuffer: Message too large: %d bytes (max 1MB) at offset %d. Skipping.", msgLen, currentOffset)
			// Attempt to skip this malformed message by advancing read position past its declared length
			bytesRead += int64(4 + msgLen)
			continue
		}

		// Calculate the end of the current message within the mmap'd region
		messageEndOffset := currentOffset + 4 + int64(msgLen)

		// Ensure we don't read past the actual written data (wb.writePos)
		if messageEndOffset > wb.writePos {
			log.Warn().Msgf("WarmBuffer: Incomplete message at offset %d. Declared length %d, but only %d bytes available until writePos. Breaking.", currentOffset, msgLen, wb.writePos - (currentOffset + 4))
			break // Not enough data for the full message
		}

		// Read message data (JSON payload)
		msgBuf := make([]byte, msgLen)
		n, err = wb.mmap.ReadAt(msgBuf, currentOffset+4)
		if err != nil {
			return nil, err
		}
		if n < int(msgLen) {
			log.Warn().Msgf("WarmBuffer: ReadAt returned less data than expected for message at offset %d. Expected %d, got %d. Breaking.", currentOffset, msgLen, n)
			break // Not enough data for the full message
		}

		// Reconstruct the length-prefixed message for the batch
		fullMessage := make([]byte, 4+msgLen)
		binary.BigEndian.PutUint32(fullMessage[:4], msgLen)
		copy(fullMessage[4:], msgBuf)

		batch = append(batch, fullMessage)
		bytesRead += int64(4 + msgLen)
	}

	wb.readPos += bytesRead
	return batch, nil
}

// Close closes the memory-mapped file and the underlying file.
func (wb *WarmBuffer) Close() error {
	wb.mu.Lock()
	defer wb.mu.Unlock()

	if err := wb.mmap.Close(); err != nil {
		return err
	}
	if err := wb.file.Close(); err != nil {
		return err
	}
	return nil
}