// internal/sensors/manager.go
package sensors

import (
	"context"
	"fmt"
	"sync"

	"cnc-monitor/edge/config"
	"cnc-monitor/edge/internal/buffering"
	"github.com/rs/zerolog/log"
)

// SensorInterface defines the interface that all sensors must implement
type SensorInterface interface {
	Read(ctx context.Context) (buffering.SensorData, error)
	Configure(config map[string]interface{}) error
	GetMetadata() config.SensorMetadata
	Health() SensorHealth
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

// SensorHealth represents the health status of a sensor
type SensorHealth struct {
	Status      string    `json:"status"`       // "ok", "degraded", "failed"
	LastRead    int64     `json:"last_read"`    // Unix timestamp
	ErrorCount  int64     `json:"error_count"`
	ErrorRate   float64   `json:"error_rate"`
	Message     string    `json:"message"`
}

// Manager coordinates multiple sensors
type Manager struct {
	sensors map[string]SensorInterface
	configs []config.SensorConfig
	mu      sync.RWMutex
}

// NewManager creates a new sensor manager
func NewManager(configs []config.SensorConfig) (*Manager, error) {
	manager := &Manager{
		sensors: make(map[string]SensorInterface),
		configs: configs,
	}
	
	// Initialize sensors based on configuration
	for _, cfg := range configs {
		if !cfg.Enabled {
			continue
		}
		
		sensor, err := createSensor(cfg)
		if err != nil {
			log.Error().Err(err).Str("sensor", cfg.Name).Msg("Failed to create sensor")
			continue
		}
		
		manager.sensors[cfg.Name] = sensor
		log.Info().Str("sensor", cfg.Name).Str("type", cfg.Type).Msg("Sensor created")
	}
	
	return manager, nil
}

// Start initializes all sensors
func (m *Manager) Start(ctx context.Context) error {
	log.Info().Int("sensor_count", len(m.sensors)).Msg("Starting sensor manager")
	
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	for name, sensor := range m.sensors {
		if err := sensor.Start(ctx); err != nil {
			log.Error().Err(err).Str("sensor", name).Msg("Failed to start sensor")
		}
	}
	
	log.Info().Msg("Sensor manager started")
	return nil
}

// Shutdown stops all sensors
func (m *Manager) Shutdown(ctx context.Context) error {
	log.Info().Msg("Shutting down sensor manager")
	
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	for name, sensor := range m.sensors {
		if err := sensor.Stop(ctx); err != nil {
			log.Error().Err(err).Str("sensor", name).Msg("Failed to stop sensor")
		}
	}
	
	log.Info().Msg("Sensor manager stopped")
	return nil
}

// ReadAll reads from all enabled sensors
func (m *Manager) ReadAll(ctx context.Context) ([]buffering.SensorData, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	var results []buffering.SensorData
	
	for name, sensor := range m.sensors {
		data, err := sensor.Read(ctx)
		if err != nil {
			log.Error().Err(err).Str("sensor", name).Msg("Failed to read sensor")
			continue
		}
		
		// Data already contains complete CNC machine reading
		results = append(results, data)
	}
	
	return results, nil
}

// GetHealth returns health status for all sensors
func (m *Manager) GetHealth() map[string]SensorHealth {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	health := make(map[string]SensorHealth)
	
	for name, sensor := range m.sensors {
		health[name] = sensor.Health()
	}
	
	return health
}

// getSensorType returns the sensor type for a given sensor name
func (m *Manager) getSensorType(name string) string {
	for _, cfg := range m.configs {
		if cfg.Name == name {
			return cfg.Type
		}
	}
	return "unknown"
}

// createSensor creates a sensor instance based on configuration
func createSensor(cfg config.SensorConfig) (SensorInterface, error) {
	switch cfg.Type {
	case "gpio":
		return NewGPIOSensor(cfg)
	case "i2c":
		return NewI2CSensor(cfg)
	case "modbus":
		return NewModbusSensor(cfg)
	case "simulator":
		return NewSimulatorSensor(cfg)
	default:
		return nil, fmt.Errorf("unknown sensor type: %s", cfg.Type)
	}
}

// Sensor type implementations (stubs for now)

// NewGPIOSensor creates a GPIO sensor
func NewGPIOSensor(cfg config.SensorConfig) (SensorInterface, error) {
	return &SimulatorSensor{config: cfg}, nil // TODO: Implement GPIO sensor
}

// NewI2CSensor creates an I2C sensor
func NewI2CSensor(cfg config.SensorConfig) (SensorInterface, error) {
	return &SimulatorSensor{config: cfg}, nil // TODO: Implement I2C sensor
}

// NewModbusSensor creates a Modbus sensor
func NewModbusSensor(cfg config.SensorConfig) (SensorInterface, error) {
	return &SimulatorSensor{config: cfg}, nil // TODO: Implement Modbus sensor
}