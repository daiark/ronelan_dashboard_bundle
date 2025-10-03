package agent

import (
	"context"
	"sync"
	"time"

	"cnc-monitor/edge/internal/buffering"
	"cnc-monitor/edge/internal/sensors"
	"cnc-monitor/edge/internal/state"
	"github.com/rs/zerolog/log"
)

// EdgeAgent is the main coordinator for the edge agent.
// It manages sensor sampling and the data pipeline.
type EdgeAgent struct {
	config Config

	// Core components
	bufferManager *buffering.Manager
	sensorManager *sensors.Manager
	stateMachine  *state.Machine

	// Runtime state
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// Config contains the configuration for the EdgeAgent.
type Config struct {
	MachineID     string
	Location      string
	SamplingRate  time.Duration
	BufferManager *buffering.Manager
	SensorManager *sensors.Manager
	StateMachine  *state.Machine
}

// NewEdgeAgent creates a new EdgeAgent instance.
func NewEdgeAgent(config *Config) *EdgeAgent {
	return &EdgeAgent{
		config:        *config,
		bufferManager: config.BufferManager,
		sensorManager: config.SensorManager,
		stateMachine:  config.StateMachine,
	}
}

// Run starts the edge agent and all its components.
func (ea *EdgeAgent) Run(ctx context.Context) error {
	ctx, ea.cancel = context.WithCancel(ctx)

	log.Info().
		Str("machine_id", ea.config.MachineID).
		Dur("sampling_rate", ea.config.SamplingRate).
		Msg("Starting edge agent")

	// Start the buffer manager's processing loop.
	ea.bufferManager.Start()

	// Start the sensor manager.
	if err := ea.sensorManager.Start(ctx); err != nil {
		return err
	}

	// Start the main sensor sampling loop.
	ea.wg.Add(1)
	go ea.sensorSamplingLoop(ctx)

	log.Info().Msg("Edge agent started successfully")
	return nil
}

// Stop gracefully stops the edge agent.
func (ea *EdgeAgent) Stop() {
	if ea.cancel != nil {
		ea.cancel()
	}
}

// Shutdown gracefully stops the edge agent.
func (ea *EdgeAgent) Shutdown(ctx context.Context) error {
	ea.Stop()

	log.Info().Msg("Shutting down edge agent")

	// Shutdown the buffer manager and its processor (NATS client).
	ea.bufferManager.Shutdown()

	// Shutdown the sensor manager.
	if err := ea.sensorManager.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Error shutting down sensor manager")
	}

	ea.wg.Wait()
	log.Info().Msg("Edge agent shutdown complete")
	return nil
}

// sensorSamplingLoop handles regular sensor sampling with computer-precision timing.
func (ea *EdgeAgent) sensorSamplingLoop(ctx context.Context) {
	defer ea.wg.Done()
	
	// Computer-precision timing system - NEVER break the timeline
	samplingInterval := ea.config.SamplingRate
	startTime := time.Now()
	nextSampleTime := startTime
	missedSamples := int64(0)
	
	log.Info().
		Dur("sampling_interval", samplingInterval).
		Time("start_time", startTime).
		Msg("Starting computer-precision sampling loop")

	for {
		select {
		case <-ctx.Done():
			return
		default:
			now := time.Now()
			
			// Calculate when the next sample should occur
			nextSampleTime = startTime.Add(time.Duration(missedSamples+1) * samplingInterval)
			
			// If we're not at the next sample time yet, wait
			if now.Before(nextSampleTime) {
				waitTime := nextSampleTime.Sub(now)
				if waitTime > 0 {
					time.Sleep(waitTime)
				}
			}
			
			// Check if we've missed any samples due to processing delays
			actualTime := time.Now()
			expectedSample := missedSamples + 1
			actualSample := int64(actualTime.Sub(startTime) / samplingInterval)
			
			if actualSample > expectedSample {
				skippedSamples := actualSample - expectedSample
				log.Warn().
					Int64("skipped_samples", skippedSamples).
					Dur("time_behind", time.Duration(skippedSamples) * samplingInterval).
					Msg("Computer precision: detected missed samples")
				
				// Generate missed samples with precise timestamps
				for i := int64(0); i < skippedSamples; i++ {
					missedSampleTime := startTime.Add(time.Duration(expectedSample+i) * samplingInterval)
					ea.sampleSensorsAtTime(ctx, missedSampleTime, true)
				}
				
				missedSamples = actualSample
			} else {
				missedSamples++
			}
			
			// Sample with precise timestamp
			sampleTime := startTime.Add(time.Duration(missedSamples) * samplingInterval)
			ea.sampleSensorsAtTime(ctx, sampleTime, false)
			
			// Monitor precision
			drift := actualTime.Sub(sampleTime)
			if drift.Abs() > time.Millisecond {
				log.Debug().
					Dur("drift", drift).
					Int64("sample_number", missedSamples).
					Msg("Computer precision: timing drift detected")
			}
		}
	}
}

// sampleSensors reads data from all configured sensors and writes it to the buffer.
func (ea *EdgeAgent) sampleSensors(ctx context.Context) {
	ea.sampleSensorsAtTime(ctx, time.Now(), false)
}

// sampleSensorsAtTime reads sensors with a specific timestamp for computer precision.
func (ea *EdgeAgent) sampleSensorsAtTime(ctx context.Context, timestamp time.Time, isMissed bool) {
	// Read data from the actual sensor manager
	data, err := ea.sensorManager.ReadAll(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Error reading sensor data")
		return
	}

	// Write all sensor readings to buffer with precise timestamp
	for _, sensorData := range data {
		// Override the timestamp with our computer-precision time
		sensorData.Timestamp = timestamp
		
		if isMissed {
			log.Debug().
				Time("missed_time", timestamp).
				Msg("Computer precision: generating missed sample")
		}
		
		if err := ea.bufferManager.Write(sensorData); err != nil {
			log.Error().Err(err).Msg("Error writing sensor data to buffer")
		}
	}
}
