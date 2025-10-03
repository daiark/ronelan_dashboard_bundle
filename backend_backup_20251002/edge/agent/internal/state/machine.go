// internal/state/machine.go
package state

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// State represents the current state of the edge agent
type State int

const (
	StateBootstrap State = iota
	StateConnecting
	StateOnline
	StateBuffering
	StateDegraded
	StateRecovering
	StateShutdown
)

// String returns the string representation of the state
func (s State) String() string {
	switch s {
	case StateBootstrap:
		return "bootstrap"
	case StateConnecting:
		return "connecting"
	case StateOnline:
		return "online"
	case StateBuffering:
		return "buffering"
	case StateDegraded:
		return "degraded"
	case StateRecovering:
		return "recovering"
	case StateShutdown:
		return "shutdown"
	default:
		return "unknown"
	}
}

// Machine implements a state machine for the edge agent
type Machine struct {
	currentState State
	previousState State
	stateStartTime time.Time
	transitions   map[State][]State
	handlers      map[State]StateHandler
	mu            sync.RWMutex
	
	// State change notifications
	listeners []StateChangeListener
}

// StateHandler defines functions to execute when entering a state
type StateHandler func(ctx context.Context) error

// StateChangeListener is called when state changes
type StateChangeListener func(from, to State, duration time.Duration)

// NewMachine creates a new state machine
func NewMachine() *Machine {
	sm := &Machine{
		currentState: StateBootstrap,
		stateStartTime: time.Now(),
		transitions: make(map[State][]State),
		handlers: make(map[State]StateHandler),
	}
	
	// Define valid state transitions
	sm.transitions[StateBootstrap] = []State{StateConnecting, StateShutdown}
	sm.transitions[StateConnecting] = []State{StateOnline, StateBuffering, StateShutdown}
	sm.transitions[StateOnline] = []State{StateBuffering, StateDegraded, StateShutdown}
	sm.transitions[StateBuffering] = []State{StateOnline, StateRecovering, StateDegraded, StateShutdown}
	sm.transitions[StateDegraded] = []State{StateRecovering, StateOnline, StateShutdown}
	sm.transitions[StateRecovering] = []State{StateOnline, StateBuffering, StateDegraded, StateShutdown}
	sm.transitions[StateShutdown] = []State{} // Terminal state
	
	// Set default handlers
	sm.setDefaultHandlers()
	
	return sm
}

// Start initializes the state machine
func (sm *Machine) Start(ctx context.Context) error {
	log.Info().Str("initial_state", sm.currentState.String()).Msg("Starting state machine")
	
	// Execute initial state handler
	if handler, exists := sm.handlers[sm.currentState]; exists {
		if err := handler(ctx); err != nil {
			log.Error().Err(err).Msg("Error executing initial state handler")
		}
	}
	
	return nil
}

// Shutdown stops the state machine
func (sm *Machine) Shutdown(ctx context.Context) error {
	log.Info().Msg("Shutting down state machine")
	
	return sm.TransitionTo(ctx, StateShutdown)
}

// GetCurrentState returns the current state
func (sm *Machine) GetCurrentState() State {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.currentState
}

// GetStateDuration returns how long we've been in the current state
func (sm *Machine) GetStateDuration() time.Duration {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return time.Since(sm.stateStartTime)
}

// TransitionTo attempts to transition to a new state
func (sm *Machine) TransitionTo(ctx context.Context, newState State) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	// Check if transition is valid
	if !sm.isValidTransition(sm.currentState, newState) {
		return &StateError{
			Message: "invalid transition from " + sm.currentState.String() + " to " + newState.String(),
		}
	}
	
	// Calculate time in previous state
	duration := time.Since(sm.stateStartTime)
	previousState := sm.currentState
	
	// Update state
	sm.previousState = sm.currentState
	sm.currentState = newState
	sm.stateStartTime = time.Now()
	
	log.Info().
		Str("from", previousState.String()).
		Str("to", newState.String()).
		Dur("duration", duration).
		Msg("State transition")
	
	// Execute state handler
	if handler, exists := sm.handlers[newState]; exists {
		if err := handler(ctx); err != nil {
			log.Error().Err(err).Str("state", newState.String()).Msg("Error executing state handler")
		}
	}
	
	// Notify listeners
	for _, listener := range sm.listeners {
		go listener(previousState, newState, duration)
	}
	
	return nil
}

// AddStateChangeListener adds a listener for state changes
func (sm *Machine) AddStateChangeListener(listener StateChangeListener) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.listeners = append(sm.listeners, listener)
}

// SetStateHandler sets a custom handler for a state
func (sm *Machine) SetStateHandler(state State, handler StateHandler) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.handlers[state] = handler
}

// isValidTransition checks if a state transition is allowed
func (sm *Machine) isValidTransition(from, to State) bool {
	validTransitions, exists := sm.transitions[from]
	if !exists {
		return false
	}
	
	for _, validState := range validTransitions {
		if validState == to {
			return true
		}
	}
	
	return false
}

// setDefaultHandlers sets up default state handlers
func (sm *Machine) setDefaultHandlers() {
	sm.handlers[StateBootstrap] = func(ctx context.Context) error {
		log.Info().Msg("Bootstrapping edge agent")
		// TODO: Initialize hardware, validate configuration
		return nil
	}
	
	sm.handlers[StateConnecting] = func(ctx context.Context) error {
		log.Info().Msg("Attempting to connect to backend")
		// TODO: Establish NATS connection, test connectivity
		return nil
	}
	
	sm.handlers[StateOnline] = func(ctx context.Context) error {
		log.Info().Msg("Edge agent online - normal operation")
		// TODO: Enable all features, start sensor sampling
		return nil
	}
	
	sm.handlers[StateBuffering] = func(ctx context.Context) error {
		log.Warn().Msg("Network issues detected - buffering mode")
		// TODO: Store data locally, reduce network attempts
		return nil
	}
	
	sm.handlers[StateDegraded] = func(ctx context.Context) error {
		log.Warn().Msg("Resource constraints - degraded operation")
		// TODO: Reduce sampling rate, disable non-essential features
		return nil
	}
	
	sm.handlers[StateRecovering] = func(ctx context.Context) error {
		log.Info().Msg("Recovering to normal operation")
		// TODO: Restore normal sampling, flush buffers
		return nil
	}
	
	sm.handlers[StateShutdown] = func(ctx context.Context) error {
		log.Info().Msg("Graceful shutdown initiated")
		// TODO: Stop sensors, flush buffers, close connections
		return nil
	}
}

// GetStateInfo returns detailed information about the current state
func (sm *Machine) GetStateInfo() StateInfo {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	return StateInfo{
		Current:      sm.currentState,
		Previous:     sm.previousState,
		Duration:     time.Since(sm.stateStartTime),
		StartTime:    sm.stateStartTime,
		Description:  sm.getStateDescription(sm.currentState),
	}
}

// getStateDescription returns a human-readable description of the state
func (sm *Machine) getStateDescription(state State) string {
	switch state {
	case StateBootstrap:
		return "System initialization and hardware setup"
	case StateConnecting:
		return "Establishing connection to backend services"
	case StateOnline:
		return "Normal operation with full connectivity"
	case StateBuffering:
		return "Network issues detected, buffering data locally"
	case StateDegraded:
		return "Resource constraints, operating with reduced functionality"
	case StateRecovering:
		return "Transitioning back to normal operation"
	case StateShutdown:
		return "Graceful shutdown in progress"
	default:
		return "Unknown state"
	}
}

// StateInfo contains detailed information about the current state
type StateInfo struct {
	Current     State         `json:"current"`
	Previous    State         `json:"previous"`
	Duration    time.Duration `json:"duration"`
	StartTime   time.Time     `json:"start_time"`
	Description string        `json:"description"`
}

// StateError represents state machine errors
type StateError struct {
	Message string
}

func (e *StateError) Error() string {
	return e.Message
}