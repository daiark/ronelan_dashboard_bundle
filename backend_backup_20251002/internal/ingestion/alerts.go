// internal/ingestion/alerts.go
package ingestion

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// AlertType represents different types of data quality alerts
type AlertType string

const (
	AlertDataLoss      AlertType = "DATA_LOSS"
	AlertSequenceGap   AlertType = "SEQUENCE_GAP"
	AlertDuplicates    AlertType = "DUPLICATES"
	AlertTimingDrift   AlertType = "TIMING_DRIFT"
	AlertConnectionLoss AlertType = "CONNECTION_LOSS"
)

// AlertSeverity represents the severity of an alert
type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "INFO"
	SeverityWarning  AlertSeverity = "WARNING"
	SeverityCritical AlertSeverity = "CRITICAL"
)

// Alert represents a data quality alert
type Alert struct {
	Type        AlertType                `json:"type"`
	Severity    AlertSeverity            `json:"severity"`
	MachineID   string                   `json:"machine_id"`
	Message     string                   `json:"message"`
	Timestamp   time.Time                `json:"timestamp"`
	Metadata    map[string]interface{}   `json:"metadata"`
	Resolved    bool                     `json:"resolved"`
	ResolvedAt  *time.Time               `json:"resolved_at,omitempty"`
}

// AlertManager manages real-time data quality alerts
type AlertManager struct {
	repo            *Repository
	integrityChecker *DataIntegrityChecker
	alerts          map[string]*Alert  // keyed by alert ID
	alertMutex      sync.RWMutex
	subscribers     []chan Alert
	subMutex        sync.RWMutex
	
	// Alert thresholds
	dataLossThreshold    float64 // percentage
	timingDriftThreshold float64 // percentage
	jitterThreshold      float64 // milliseconds
	
	// Monitoring state
	lastSequenceNumbers map[string]uint64
	lastDataTime        map[string]time.Time
	seqMutex           sync.RWMutex
}

// NewAlertManager creates a new alert manager
func NewAlertManager(repo *Repository, integrityChecker *DataIntegrityChecker) *AlertManager {
	return &AlertManager{
		repo:                 repo,
		integrityChecker:     integrityChecker,
		alerts:               make(map[string]*Alert),
		subscribers:          []chan Alert{},
		dataLossThreshold:    5.0,  // 5% data loss threshold
		timingDriftThreshold: 10.0, // 10% timing drift threshold
		jitterThreshold:      200.0, // 200ms jitter threshold
		lastSequenceNumbers:  make(map[string]uint64),
		lastDataTime:         make(map[string]time.Time),
	}
}

// StartMonitoring begins real-time monitoring for data quality issues
func (am *AlertManager) StartMonitoring(ctx context.Context) {
	go am.continuousMonitoring(ctx)
	log.Info().Msg("Real-time data quality monitoring started")
}

// Subscribe adds a subscriber to receive alerts
func (am *AlertManager) Subscribe() chan Alert {
	am.subMutex.Lock()
	defer am.subMutex.Unlock()
	
	ch := make(chan Alert, 100) // Buffered channel
	am.subscribers = append(am.subscribers, ch)
	return ch
}

// Unsubscribe removes a subscriber
func (am *AlertManager) Unsubscribe(ch chan Alert) {
	am.subMutex.Lock()
	defer am.subMutex.Unlock()
	
	for i, subscriber := range am.subscribers {
		if subscriber == ch {
			close(ch)
			am.subscribers = append(am.subscribers[:i], am.subscribers[i+1:]...)
			break
		}
	}
}

// continuousMonitoring performs continuous data quality monitoring
func (am *AlertManager) continuousMonitoring(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second) // Monitor every 30 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			am.checkDataQuality(ctx)
		}
	}
}

// checkDataQuality performs real-time data quality checks
func (am *AlertManager) checkDataQuality(ctx context.Context) {
	// Get all active machines (hardcoded for now, should be from config)
	machines := []string{"CNC-PI-001"} // TODO: Get from machine registry
	
	for _, machineID := range machines {
		am.checkMachineDataQuality(ctx, machineID)
	}
}

// checkMachineDataQuality checks data quality for a specific machine
func (am *AlertManager) checkMachineDataQuality(ctx context.Context, machineID string) {
	// 1. Check for data loss (no recent data)
	am.checkDataLoss(ctx, machineID)
	
	// 2. Check for sequence gaps
	am.checkSequenceGaps(ctx, machineID)
	
	// 3. Check timing quality
	am.checkTimingQuality(ctx, machineID)
	
	// 4. Check for duplicates
	am.checkDuplicates(ctx, machineID)
}

// checkDataLoss detects if data is missing for extended periods
func (am *AlertManager) checkDataLoss(ctx context.Context, machineID string) {
	lastSeq, err := am.repo.GetLastSequenceNumber(ctx, machineID)
	if err != nil {
		log.Error().Err(err).Str("machine_id", machineID).Msg("Failed to get last sequence number")
		return
	}

	am.seqMutex.Lock()
	previousSeq, exists := am.lastSequenceNumbers[machineID]
	am.lastSequenceNumbers[machineID] = lastSeq
	now := time.Now()
	lastTime, timeExists := am.lastDataTime[machineID]
	am.lastDataTime[machineID] = now
	am.seqMutex.Unlock()

	if !exists || !timeExists {
		return // First check, no baseline
	}

	// Calculate expected messages based on time elapsed
	timeSinceLastCheck := now.Sub(lastTime)
	expectedMessages := int(timeSinceLastCheck.Seconds() * 10) // 10 Hz sampling
	actualMessages := int(lastSeq - previousSeq)

	if expectedMessages > 0 {
		dataLossPercent := float64(expectedMessages-actualMessages) / float64(expectedMessages) * 100
		
		if dataLossPercent > am.dataLossThreshold {
			severity := SeverityWarning
			if dataLossPercent > 25 {
				severity = SeverityCritical
			}
			
			am.raiseAlert(Alert{
				Type:      AlertDataLoss,
				Severity:  severity,
				MachineID: machineID,
				Message:   fmt.Sprintf("Data loss detected: %.1f%% (%d of %d expected messages)", dataLossPercent, actualMessages, expectedMessages),
				Timestamp: now,
				Metadata: map[string]interface{}{
					"data_loss_percent": dataLossPercent,
					"expected_messages": expectedMessages,
					"actual_messages":   actualMessages,
					"time_window":       timeSinceLastCheck.String(),
				},
			})
		}
	}

	// Check for complete data loss (no new messages for extended period)
	if actualMessages == 0 && timeSinceLastCheck > 60*time.Second {
		am.raiseAlert(Alert{
			Type:      AlertConnectionLoss,
			Severity:  SeverityCritical,
			MachineID: machineID,
			Message:   fmt.Sprintf("Complete data loss: No new messages for %v", timeSinceLastCheck),
			Timestamp: now,
			Metadata: map[string]interface{}{
				"silence_duration": timeSinceLastCheck.String(),
			},
		})
	}
}

// checkSequenceGaps detects missing sequence numbers
func (am *AlertManager) checkSequenceGaps(ctx context.Context, machineID string) {
	gaps, err := am.repo.DetectSequenceGaps(ctx, machineID)
	if err != nil {
		log.Error().Err(err).Str("machine_id", machineID).Msg("Failed to detect sequence gaps")
		return
	}

	if len(gaps) > 0 {
		severity := SeverityWarning
		if len(gaps) > 100 {
			severity = SeverityCritical
		}

		am.raiseAlert(Alert{
			Type:      AlertSequenceGap,
			Severity:  severity,
			MachineID: machineID,
			Message:   fmt.Sprintf("Sequence gaps detected: %d missing sequence numbers", len(gaps)),
			Timestamp: time.Now(),
			Metadata: map[string]interface{}{
				"gap_count": len(gaps),
				"gaps":      gaps[:min(len(gaps), 10)], // Show first 10 gaps
			},
		})
	}
}

// checkTimingQuality analyzes timing precision
func (am *AlertManager) checkTimingQuality(ctx context.Context, machineID string) {
	// Get recent data for timing analysis
	endTime := time.Now()
	_ = endTime.Add(-2 * time.Minute)

	metrics, err := am.integrityChecker.GetRealtimeQualityMetrics(ctx, machineID)
	if err != nil {
		log.Error().Err(err).Str("machine_id", machineID).Msg("Failed to get quality metrics")
		return
	}

	if timingDrift, ok := metrics["timing_drift"].(float64); ok {
		if timingDrift > am.timingDriftThreshold {
			severity := SeverityWarning
			if timingDrift > 25 {
				severity = SeverityCritical
			}

			am.raiseAlert(Alert{
				Type:      AlertTimingDrift,
				Severity:  severity,
				MachineID: machineID,
				Message:   fmt.Sprintf("Timing drift detected: %.2f%% deviation from expected 100ms intervals", timingDrift),
				Timestamp: time.Now(),
				Metadata: map[string]interface{}{
					"timing_drift_percent": timingDrift,
					"max_jitter_ms":       metrics["max_jitter_ms"],
				},
			})
		}
	}
}

// checkDuplicates detects duplicate messages
func (am *AlertManager) checkDuplicates(ctx context.Context, machineID string) {
	endTime := time.Now()
	startTime := endTime.Add(-5 * time.Minute)

	duplicates, err := am.integrityChecker.countDuplicates(ctx, machineID, startTime, endTime)
	if err != nil {
		log.Error().Err(err).Str("machine_id", machineID).Msg("Failed to count duplicates")
		return
	}

	if duplicates > 0 {
		severity := SeverityWarning
		if duplicates > 50 {
			severity = SeverityCritical
		}

		am.raiseAlert(Alert{
			Type:      AlertDuplicates,
			Severity:  severity,
			MachineID: machineID,
			Message:   fmt.Sprintf("Duplicate messages detected: %d duplicates in last 5 minutes", duplicates),
			Timestamp: time.Now(),
			Metadata: map[string]interface{}{
				"duplicate_count": duplicates,
				"time_window":     "5 minutes",
			},
		})
	}
}

// raiseAlert creates and broadcasts an alert
func (am *AlertManager) raiseAlert(alert Alert) {
	alertID := fmt.Sprintf("%s_%s_%d", alert.Type, alert.MachineID, alert.Timestamp.Unix())
	
	am.alertMutex.Lock()
	am.alerts[alertID] = &alert
	am.alertMutex.Unlock()

	// Log the alert
	log.Warn().
		Str("type", string(alert.Type)).
		Str("severity", string(alert.Severity)).
		Str("machine_id", alert.MachineID).
		Str("message", alert.Message).
		Msg("Data quality alert raised")

	// Broadcast to subscribers
	am.broadcastAlert(alert)
}

// broadcastAlert sends alert to all subscribers
func (am *AlertManager) broadcastAlert(alert Alert) {
	am.subMutex.RLock()
	defer am.subMutex.RUnlock()

	for _, subscriber := range am.subscribers {
		select {
		case subscriber <- alert:
		default:
			// Non-blocking send, skip if channel is full
			log.Warn().Msg("Alert subscriber channel full, skipping")
		}
	}
}

// GetActiveAlerts returns all active (unresolved) alerts
func (am *AlertManager) GetActiveAlerts() []Alert {
	am.alertMutex.RLock()
	defer am.alertMutex.RUnlock()

	var activeAlerts []Alert
	for _, alert := range am.alerts {
		if !alert.Resolved {
			activeAlerts = append(activeAlerts, *alert)
		}
	}
	return activeAlerts
}

// ResolveAlert marks an alert as resolved
func (am *AlertManager) ResolveAlert(alertID string) {
	am.alertMutex.Lock()
	defer am.alertMutex.Unlock()

	if alert, exists := am.alerts[alertID]; exists {
		alert.Resolved = true
		now := time.Now()
		alert.ResolvedAt = &now
		log.Info().Str("alert_id", alertID).Msg("Alert resolved")
	}
}

// GetAlertStats returns alert statistics
func (am *AlertManager) GetAlertStats() map[string]interface{} {
	am.alertMutex.RLock()
	defer am.alertMutex.RUnlock()

	stats := map[string]interface{}{
		"total_alerts":    len(am.alerts),
		"active_alerts":   0,
		"resolved_alerts": 0,
		"by_severity":     make(map[string]int),
		"by_type":         make(map[string]int),
	}

	for _, alert := range am.alerts {
		if alert.Resolved {
			stats["resolved_alerts"] = stats["resolved_alerts"].(int) + 1
		} else {
			stats["active_alerts"] = stats["active_alerts"].(int) + 1
		}
		
		stats["by_severity"].(map[string]int)[string(alert.Severity)]++
		stats["by_type"].(map[string]int)[string(alert.Type)]++
	}

	return stats
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}