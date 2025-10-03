package buffering

import (
	"errors"
	"sync/atomic"
)

var (
	ErrFull          = errors.New("buffer is full")
	ErrNotPowerOfTwo = errors.New("capacity must be a power of two")
)

// HotBuffer is a lock-free, multiple-writer, single-reader circular byte buffer.
// It is designed for high-throughput, low-latency scenarios. Writers can append
// data concurrently, and a single reader consumes it. The buffer is zero-copy
// for reads, returning slices of the underlying buffer.
type HotBuffer struct {
	data     []byte
	capacity uint64
	mask     uint64
	// readPos is the position of the next byte to be read.
	// Only accessed by the single reader goroutine.
	readPos uint64
	// writePos is the position of the next byte to be written.
	// Accessed by multiple writers using atomic operations.
	writePos atomic.Uint64
	// committedPos is the high-water mark of successfully written data.
	// It ensures that readers only see fully committed writes.
	committedPos atomic.Uint64
}

// NewHotBuffer creates a new HotBuffer. Capacity must be a power of 2.
func NewHotBuffer(capacity uint64) (*HotBuffer, error) {
	if (capacity & (capacity - 1)) != 0 {
		return nil, ErrNotPowerOfTwo
	}
	return &HotBuffer{
		data:     make([]byte, capacity),
		capacity: capacity,
		mask:     capacity - 1,
	}, nil
}

// Write appends data to the buffer. It is safe for multiple goroutines to call this.
// This implementation uses a two-phase commit to ensure data integrity without locks.
// 1. Reserve space using atomic.Add.
// 2. Copy data.
// 3. Update the committed position.
func (h *HotBuffer) Write(data []byte) error {
	size := uint64(len(data))
	if size == 0 {
		return nil
	}

	// Phase 1: Reserve space in the buffer by incrementing writePos.
	pos := h.writePos.Add(size)

	// Check if we have enough space. We compare against the reader's known position.
	// This is the core of the SPMC queue logic.
	if (pos - h.readPos) > h.capacity {
		// Not enough space, roll back the reservation.
		h.writePos.Add(^uint64(size - 1)) // atomic decrement
		return ErrFull
	}

	// Phase 2: Copy the data into the reserved space.
	start := (pos - size) & h.mask
	n := copy(h.data[start:], data)
	if n < len(data) {
		copy(h.data, data[n:])
	}

	// Phase 3: Commit the write.
	// We must wait until our write is the next one to be committed.
	// This prevents a later, smaller write from being visible before our larger write.
	for !h.committedPos.CompareAndSwap(pos-size, pos) {
		// Spin-wait for the previous writer to commit.
		// In a real-world high-contention scenario, a runtime.Gosched() might be useful here.
	}

	return nil
}

// Read retrieves data from the buffer. It is designed for a single reader.
// It returns two slices of the buffer's underlying array to avoid a copy when
// the data wraps around the end of the buffer. The returned slices are only
// valid until the next Read call.
func (h *HotBuffer) Read() ([]byte, []byte) {
	committedPos := h.committedPos.Load()
	available := committedPos - h.readPos
	if available == 0 {
		return nil, nil
	}

	start := h.readPos & h.mask
	end := start + available

	if end <= h.capacity {
		// Data does not wrap around
		return h.data[start:end], nil
	}

	// Data wraps around, return two slices
	return h.data[start:], h.data[:end&h.mask]
}

// CommitRead advances the read pointer by the given size. This must be called
// after the data from Read() has been processed.
func (h *HotBuffer) CommitRead(size uint64) {
	h.readPos += size
}

// AvailableBytes returns the number of bytes available to read.
func (h *HotBuffer) AvailableBytes() uint64 {
	return h.committedPos.Load() - h.readPos
}

// Capacity returns the total capacity of the buffer.
func (h *HotBuffer) Capacity() uint64 {
	return h.capacity
}
