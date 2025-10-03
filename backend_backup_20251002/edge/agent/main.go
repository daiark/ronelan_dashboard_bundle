package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"cnc-monitor/edge/config"
	"cnc-monitor/edge/internal/agent"
	"cnc-monitor/edge/internal/buffering"
	"cnc-monitor/edge/internal/nats"
	"cnc-monitor/edge/internal/sensors"
	"cnc-monitor/edge/internal/state"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting CNC Edge Agent")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// 1. Create the NATS client, which will process our data batches.
	natsClient, err := nats.NewClient(cfg.NATS)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create NATS client")
	}
	if err := natsClient.Start(); err != nil {
		log.Fatal().Err(err).Msg("Failed to start NATS client")
	}

	// 2. Create the buffer manager, using the NATS client as the processor.
	bufferManager, err := buffering.NewManager(cfg.Buffering, natsClient)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create buffer manager")
	}

	// 3. Create the sensor manager (currently simulated).
	sensorManager, err := sensors.NewManager(cfg.Sensors)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create sensor manager")
	}

	// 4. Create the main agent.
	edgeAgent := agent.NewEdgeAgent(&agent.Config{
		MachineID:     cfg.Agent.MachineID,
		Location:      cfg.Agent.Location,
		SamplingRate:  cfg.Agent.SamplingRate,
		BufferManager: bufferManager,
		SensorManager: sensorManager,
		StateMachine:  state.NewMachine(), // State machine is currently basic.
	})

	// Run the agent in the background.
	ctx, cancel := context.WithCancel(context.Background())

	if err := edgeAgent.Run(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to run edge agent")
	}

	// Wait for shutdown signal.
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info().Msg("Shutdown signal received, stopping agent...")
	cancel() // Cancel the context to stop the agent's loops

	// Graceful shutdown.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := edgeAgent.Shutdown(shutdownCtx); err != nil {
		log.Warn().Err(err).Msg("Error during agent shutdown")
	}

	log.Info().Msg("CNC Edge Agent stopped")
}
