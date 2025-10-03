// config/config.go
package config

import (
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
)

// Config represents the complete edge agent configuration
type Config struct {
	Agent     AgentConfig     `mapstructure:"agent"`
	Sensors   []SensorConfig  `mapstructure:"sensors"`
	Buffering BufferingConfig `mapstructure:"buffering"`
	NATS      NATSConfig      `mapstructure:"nats"`
	Health    HealthConfig    `mapstructure:"health"`
}

// AgentConfig contains core agent settings
type AgentConfig struct {
	MachineID    string        `mapstructure:"machine_id"`
	Location     string        `mapstructure:"location"`
	SamplingRate time.Duration `mapstructure:"sampling_rate"`
	LogLevel     string        `mapstructure:"log_level"`
}

// SensorConfig defines individual sensor configurations
type SensorConfig struct {
	Name     string                 `mapstructure:"name"`
	Type     string                 `mapstructure:"type"`
	Address  string                 `mapstructure:"address"`
	Enabled  bool                   `mapstructure:"enabled"`
	Config   map[string]interface{} `mapstructure:"config"`
	Metadata SensorMetadata         `mapstructure:"metadata"`
}

// SensorMetadata contains sensor description and configuration
type SensorMetadata struct {
	Description string             `mapstructure:"description"`
	Units       string             `mapstructure:"units"`
	Range       SensorRange        `mapstructure:"range"`
	Precision   int                `mapstructure:"precision"`
	Tags        map[string]string  `mapstructure:"tags"`
}

// SensorRange defines the valid range for sensor readings
type SensorRange struct {
	Min float64 `mapstructure:"min"`
	Max float64 `mapstructure:"max"`
}

// BufferingConfig controls the data buffering and batching strategy.
type BufferingConfig struct {
	HotBuffer  HotBufferConfig `mapstructure:"hot_buffer"`
	WarmBuffer WarmBufferConfig `mapstructure:"warm_buffer"`
	ColdBuffer ColdBufferConfig `mapstructure:"cold_buffer"`
	Batching   BatchingConfig  `mapstructure:"batching"`
}

// HotBufferConfig for the in-memory ring buffer.
type HotBufferConfig struct {
	Capacity uint64 `mapstructure:"capacity"` // Capacity of the ring buffer in bytes. Must be a power of two.
}

// WarmBufferConfig for the memory-mapped file buffer.
type WarmBufferConfig struct {
	Path string `mapstructure:"path"` // Path to the memory-mapped file.
	Size int64  `mapstructure:"size"` // Size of the memory-mapped file in bytes.
}

// ColdBufferConfig for the append-only log file.
type ColdBufferConfig struct {
	Path    string `mapstructure:"path"`     // Path to the cold storage log file.
	MaxSize int64  `mapstructure:"max_size"` // Max size in bytes before rotation.
}

// BatchingConfig defines how data is collected into batches before processing.
type BatchingConfig struct {
	Size    int           `mapstructure:"size"`    // The number of messages to accumulate in a batch.
	Timeout time.Duration `mapstructure:"timeout"` // The maximum time to wait before sending a partial batch.
}

// NATSConfig for NATS JetStream connection
type NATSConfig struct {
	URL               string        `mapstructure:"url"`
	Stream            string        `mapstructure:"stream"`
	SubjectPrefix     string        `mapstructure:"subject_prefix"`
	ReconnectDelay    time.Duration `mapstructure:"reconnect_delay"`
	MaxReconnects     int           `mapstructure:"max_reconnects"`
	BufferSize        int           `mapstructure:"buffer_size"`
	CompressionMinKB  int           `mapstructure:"compression_min_kb"`
	Credentials       string        `mapstructure:"credentials"`
	TLS               TLSConfig     `mapstructure:"tls"`
}

// TLSConfig for secure NATS connections
type TLSConfig struct {
	Enabled  bool   `mapstructure:"enabled"`
	CertFile string `mapstructure:"cert_file"`
	KeyFile  string `mapstructure:"key_file"`
	CAFile   string `mapstructure:"ca_file"`
}

// HealthConfig for monitoring and alerting
type HealthConfig struct {
	CheckInterval    time.Duration         `mapstructure:"check_interval"`
	MetricsRetention time.Duration         `mapstructure:"metrics_retention"`
	Thresholds       HealthThresholds      `mapstructure:"thresholds"`
	Alerts           []AlertConfig         `mapstructure:"alerts"`
}

// HealthThresholds define when to trigger alerts
type HealthThresholds struct {
	CPUPercent     float64 `mapstructure:"cpu_percent"`
	MemoryPercent  float64 `mapstructure:"memory_percent"`
	DiskPercent    float64 `mapstructure:"disk_percent"`
	TemperatureC   float64 `mapstructure:"temperature_c"`
	BufferPercent  float64 `mapstructure:"buffer_percent"`
	ErrorRate      float64 `mapstructure:"error_rate"`
	NetworkLatency int64   `mapstructure:"network_latency_ms"`
}

// AlertConfig defines alerting mechanisms
type AlertConfig struct {
	Type    string                 `mapstructure:"type"`    // "log", "nats", "webhook"
	Level   string                 `mapstructure:"level"`   // "warning", "error", "critical"
	Config  map[string]interface{} `mapstructure:"config"`
}

// LoadConfig loads configuration from file and environment variables
func LoadConfig() (*Config, error) {
	// Set defaults
	setDefaults()

	// Configure viper
	viper.SetConfigName("edge-config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("/etc/cnc-edge/")
	viper.AddConfigPath("$HOME/.cnc-edge/")
	viper.AddConfigPath("./configs/")
	viper.AddConfigPath(".")

	// Enable environment variable overrides
	viper.AutomaticEnv()
	viper.SetEnvPrefix("CNC_EDGE")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Read configuration file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Warn().Msg("No config file found, using defaults and environment variables")
		} else {
			return nil, err
		}
	} else {
		log.Info().Str("config_file", viper.ConfigFileUsed()).Msg("Configuration file loaded")
	}

	// Unmarshal into struct
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// Validate configuration
	if err := validateConfig(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// setDefaults sets reasonable default values
func setDefaults() {
	// Agent defaults
	viper.SetDefault("agent.machine_id", "CNC-UNKNOWN")
	viper.SetDefault("agent.location", "Factory-Unknown")
	viper.SetDefault("agent.sampling_rate", "100ms")
	viper.SetDefault("agent.log_level", "info")

	// Hot buffer defaults (in-memory)
	viper.SetDefault("buffering.hot_buffer.capacity", 1024*1024) // 1MB

	// Warm buffer defaults (memory-mapped file)
	viper.SetDefault("buffering.warm_buffer.path", "/var/tmp/cnc-agent/warm.buffer")
	viper.SetDefault("buffering.warm_buffer.size", 10*1024*1024) // 10MB

	// Cold buffer defaults (append-only log)
	viper.SetDefault("buffering.cold_buffer.path", "/var/tmp/cnc-agent/cold.log")
	viper.SetDefault("buffering.cold_buffer.max_size", 100*1024*1024) // 100MB

	// Batching defaults
	viper.SetDefault("buffering.batching.size", 100)
	viper.SetDefault("buffering.batching.timeout", "200ms")

	// NATS defaults
	viper.SetDefault("nats.url", "nats://localhost:4222")
	viper.SetDefault("nats.stream", "CNC_DATA")
	viper.SetDefault("nats.subject_prefix", "CNC.EDGE")
	viper.SetDefault("nats.reconnect_delay", "1s")
	viper.SetDefault("nats.max_reconnects", 10)
	viper.SetDefault("nats.buffer_size", 1000)
	viper.SetDefault("nats.compression_min_kb", 10)

	// Health monitoring defaults
	viper.SetDefault("health.check_interval", "30s")
	viper.SetDefault("health.metrics_retention", "1h")
	viper.SetDefault("health.thresholds.cpu_percent", 75.0)
	viper.SetDefault("health.thresholds.memory_percent", 80.0)
	viper.SetDefault("health.thresholds.disk_percent", 85.0)
	viper.SetDefault("health.thresholds.temperature_c", 75.0)
	viper.SetDefault("health.thresholds.buffer_percent", 90.0)
	viper.SetDefault("health.thresholds.error_rate", 0.05)
	viper.SetDefault("health.thresholds.network_latency_ms", 1000)
}

// validateConfig performs basic validation of the configuration
func validateConfig(cfg *Config) error {
	// Basic validation - can be extended
	if cfg.Agent.MachineID == "" {
		log.Warn().Msg("Machine ID not specified, using default")
		cfg.Agent.MachineID = "CNC-UNKNOWN"
	}

	if cfg.Agent.SamplingRate < time.Millisecond {
		log.Warn().Dur("sampling_rate", cfg.Agent.SamplingRate).Msg("Sampling rate too low, setting to 1ms")
		cfg.Agent.SamplingRate = time.Millisecond
	}

	if cfg.Buffering.HotBuffer.Capacity < 1024 {
		log.Warn().Uint64("capacity", cfg.Buffering.HotBuffer.Capacity).Msg("Hot buffer capacity too small, setting to 1KB")
		cfg.Buffering.HotBuffer.Capacity = 1024
	}

	// Check if capacity is a power of two
	if (cfg.Buffering.HotBuffer.Capacity & (cfg.Buffering.HotBuffer.Capacity - 1)) != 0 {
		log.Warn().Uint64("capacity", cfg.Buffering.HotBuffer.Capacity).Msg("Hot buffer capacity is not a power of two. This can lead to performance issues. Rounding up to the next power of two.")
		// Round up to the next power of two
		cfg.Buffering.HotBuffer.Capacity--
		cfg.Buffering.HotBuffer.Capacity |= cfg.Buffering.HotBuffer.Capacity >> 1
		cfg.Buffering.HotBuffer.Capacity |= cfg.Buffering.HotBuffer.Capacity >> 2
		cfg.Buffering.HotBuffer.Capacity |= cfg.Buffering.HotBuffer.Capacity >> 4
		cfg.Buffering.HotBuffer.Capacity |= cfg.Buffering.HotBuffer.Capacity >> 8
		cfg.Buffering.HotBuffer.Capacity |= cfg.Buffering.HotBuffer.Capacity >> 16
		cfg.Buffering.HotBuffer.Capacity |= cfg.Buffering.HotBuffer.Capacity >> 32
		cfg.Buffering.HotBuffer.Capacity++
	}

	return nil
}