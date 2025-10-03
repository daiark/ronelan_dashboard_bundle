// internal/sensors/simulator.go
package sensors

import (
	"context"
	"math"
	"math/rand"
	"time"

	"cnc-monitor/edge/config"
	"cnc-monitor/edge/internal/buffering"
)

// SimulatorSensor implements a simulated sensor for testing
type SimulatorSensor struct {
	config    config.SensorConfig
	metadata  config.SensorMetadata
	running   bool
	startTime time.Time
	
	// Simulation parameters
	pattern   string  // "sine", "random", "constant"
	frequency float64 // Hz
	amplitude float64
	offset    float64
	
	// Health tracking
	errorCount int64
	lastRead   time.Time
}

// NewSimulatorSensor creates a new simulator sensor
func NewSimulatorSensor(cfg config.SensorConfig) (*SimulatorSensor, error) {
	s := &SimulatorSensor{
		config:   cfg,
		metadata: cfg.Metadata,
	}
	
	// Parse simulation config
	if pattern, ok := cfg.Config["pattern"].(string); ok {
		s.pattern = pattern
	} else {
		s.pattern = "sine"
	}
	
	if freq, ok := cfg.Config["frequency"].(float64); ok {
		s.frequency = freq
	} else {
		s.frequency = 0.1 // 0.1 Hz default
	}
	
	if amp, ok := cfg.Config["amplitude"].(float64); ok {
		s.amplitude = amp
	} else {
		s.amplitude = 100.0
	}
	
	if offset, ok := cfg.Config["offset"].(float64); ok {
		s.offset = offset
	} else {
		s.offset = 0.0
	}
	
	return s, nil
}

// Start initializes the simulator sensor
func (s *SimulatorSensor) Start(ctx context.Context) error {
	s.running = true
	s.startTime = time.Now()
	return nil
}

// Stop shuts down the simulator sensor
func (s *SimulatorSensor) Stop(ctx context.Context) error {
	s.running = false
	return nil
}

// Read generates complete CNC machine data
func (s *SimulatorSensor) Read(ctx context.Context) (buffering.SensorData, error) {
	if !s.running {
		return buffering.SensorData{}, &SensorError{Message: "sensor not running"}
	}
	
	s.lastRead = time.Now()
	// Use absolute time instead of relative to startTime for continuous patterns
	elapsed := float64(s.lastRead.Unix())
	
	// Generate realistic CNC machine data with faster cycles for testing
	baseTemp := 25.0
	tempVariation := 15.0 * math.Sin(2*math.Pi*0.01*elapsed) // 0.01 Hz = 100 second cycle
	temperature := baseTemp + tempVariation + (rand.Float64()-0.5)*2.0
	
	baseSpindleSpeed := 2500.0
	spindleVariation := 500.0 * math.Sin(2*math.Pi*0.005*elapsed) // 0.005 Hz = 200 second cycle
	spindleSpeed := baseSpindleSpeed + spindleVariation + (rand.Float64()-0.5)*100.0
	
	// Generate position data (simulated tool path)
	xPos := 100.0 + 50.0*math.Sin(2*math.Pi*0.001*elapsed) // 1000 second cycle
	yPos := 100.0 + 50.0*math.Cos(2*math.Pi*0.001*elapsed) // 1000 second cycle  
	zPos := 10.0 + 5.0*math.Sin(2*math.Pi*0.002*elapsed)    // 500 second cycle
	
	// Generate operational data
	feedRate := 800.0 + (rand.Float64()-0.5)*200.0
	spindleLoad := 45.0 + 20.0*math.Sin(2*math.Pi*0.003*elapsed) + (rand.Float64()-0.5)*10.0  // 333 second cycle
	totalPower := 5.5 + 2.0*math.Sin(2*math.Pi*0.004*elapsed) + (rand.Float64()-0.5)*0.5      // 250 second cycle
	
	// Machine state simulation
	states := []string{"running", "idle", "alarm", "hold"}
	stateIndex := int(elapsed/120) % len(states) // Change state every 2 minutes
	
	programLine := int(elapsed/5) % 1000 // Increment program line every 5 seconds
	
	return buffering.SensorData{
		MachineID:         "CNC-PI-001", // Default machine ID
		Temperature:       temperature,
		SpindleSpeed:      spindleSpeed,
		Timestamp:         s.lastRead,
		XPosMM:            xPos,
		YPosMM:            yPos,
		ZPosMM:            zPos,
		FeedRateActual:    feedRate,
		SpindleLoadPercent: spindleLoad,
		MachineState:      states[stateIndex],
		ActiveProgramLine: programLine,
		TotalPowerKW:      totalPower,
	}, nil
}

// Configure updates sensor configuration
func (s *SimulatorSensor) Configure(config map[string]interface{}) error {
	// Update simulation parameters
	if pattern, ok := config["pattern"].(string); ok {
		s.pattern = pattern
	}
	
	if freq, ok := config["frequency"].(float64); ok {
		s.frequency = freq
	}
	
	if amp, ok := config["amplitude"].(float64); ok {
		s.amplitude = amp
	}
	
	if offset, ok := config["offset"].(float64); ok {
		s.offset = offset
	}
	
	return nil
}

// GetMetadata returns sensor metadata
func (s *SimulatorSensor) GetMetadata() config.SensorMetadata {
	return s.metadata
}

// Health returns the sensor health status
func (s *SimulatorSensor) Health() SensorHealth {
	status := "ok"
	if !s.running {
		status = "stopped"
	}
	
	var errorRate float64
	if s.lastRead.IsZero() {
		errorRate = 0.0
	} else {
		// Simulate very low error rate for simulator
		errorRate = 0.001
	}
	
	return SensorHealth{
		Status:     status,
		LastRead:   s.lastRead.Unix(),
		ErrorCount: s.errorCount,
		ErrorRate:  errorRate,
		Message:    "Simulator sensor operating normally",
	}
}

// SensorError represents sensor-related errors
type SensorError struct {
	Message string
}

func (e *SensorError) Error() string {
	return e.Message
}