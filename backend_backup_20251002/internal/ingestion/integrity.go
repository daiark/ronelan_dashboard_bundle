// internal/ingestion/integrity.go
package ingestion

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
)

// DataIntegrityChecker provides comprehensive data integrity validation
type DataIntegrityChecker struct {
	repo *Repository
}

// NewDataIntegrityChecker creates a new integrity checker
func NewDataIntegrityChecker(repo *Repository) *DataIntegrityChecker {
	return &DataIntegrityChecker{repo: repo}
}

// IntegrityReport represents a comprehensive data integrity assessment
type IntegrityReport struct {
	MachineID        string                 `json:"machine_id"`
	TimeRange        TimeRange              `json:"time_range"`
	ExpectedRecords  int                    `json:"expected_records"`
	ActualRecords    int                    `json:"actual_records"`
	MissingRecords   int                    `json:"missing_records"`
	DataLossPercent  float64                `json:"data_loss_percent"`
	SequenceGaps     []uint64               `json:"sequence_gaps"`
	DuplicateCount   int                    `json:"duplicate_count"`
	TimingDrift      TimingAnalysis         `json:"timing_drift"`
	QualityScore     float64                `json:"quality_score"`
	Issues           []string               `json:"issues"`
	Recommendations  []string               `json:"recommendations"`
}

// TimeRange represents a time period
type TimeRange struct {
	Start    time.Time `json:"start"`
	End      time.Time `json:"end"`
	Duration float64   `json:"duration_seconds"`
}

// TimingAnalysis provides timing precision analysis
type TimingAnalysis struct {
	ExpectedInterval  float64 `json:"expected_interval_ms"`
	ActualInterval    float64 `json:"actual_interval_ms"`
	StandardDeviation float64 `json:"std_deviation_ms"`
	MaxJitter         float64 `json:"max_jitter_ms"`
	DriftRate         float64 `json:"drift_rate_pct"`
}

// PerformIntegrityCheck conducts comprehensive data integrity analysis
func (dic *DataIntegrityChecker) PerformIntegrityCheck(ctx context.Context, machineID string, startTime, endTime time.Time) (*IntegrityReport, error) {
	log.Info().
		Str("machine_id", machineID).
		Time("start", startTime).
		Time("end", endTime).
		Msg("Starting comprehensive data integrity check")

	report := &IntegrityReport{
		MachineID: machineID,
		TimeRange: TimeRange{
			Start:    startTime,
			End:      endTime,
			Duration: endTime.Sub(startTime).Seconds(),
		},
		Issues:          []string{},
		Recommendations: []string{},
	}

	// 1. Get all sensor data for the time range
	sensorData, err := dic.repo.GetSensorDataForMachine(ctx, machineID, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get sensor data: %w", err)
	}

	report.ActualRecords = len(sensorData)

	// 2. Calculate expected records (assuming 10Hz sampling = 100ms intervals)
	expectedSamplingRate := 10.0 // Hz
	report.ExpectedRecords = int(report.TimeRange.Duration * expectedSamplingRate)
	report.MissingRecords = report.ExpectedRecords - report.ActualRecords

	if report.ExpectedRecords > 0 {
		report.DataLossPercent = float64(report.MissingRecords) / float64(report.ExpectedRecords) * 100
	}

	// 3. Check for sequence gaps
	sequenceGaps, err := dic.repo.DetectSequenceGaps(ctx, machineID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to detect sequence gaps")
	} else {
		report.SequenceGaps = sequenceGaps
	}

	// 4. Analyze timing precision
	report.TimingDrift = dic.analyzeTimingPrecision(sensorData)

	// 5. Check for duplicates
	duplicateCount, err := dic.countDuplicates(ctx, machineID, startTime, endTime)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count duplicates")
	} else {
		report.DuplicateCount = duplicateCount
	}

	// 6. Calculate quality score and generate issues/recommendations
	dic.assessQuality(report)

	log.Info().
		Str("machine_id", machineID).
		Float64("quality_score", report.QualityScore).
		Float64("data_loss_pct", report.DataLossPercent).
		Int("sequence_gaps", len(report.SequenceGaps)).
		Msg("Data integrity check completed")

	return report, nil
}

// analyzeTimingPrecision analyzes the precision of sampling intervals
func (dic *DataIntegrityChecker) analyzeTimingPrecision(data []SensorData) TimingAnalysis {
	if len(data) < 2 {
		return TimingAnalysis{}
	}

	expectedInterval := 100.0 // 100ms in milliseconds
	var intervals []float64
	var totalInterval float64

	for i := 1; i < len(data); i++ {
		interval := data[i].Timestamp.Sub(data[i-1].Timestamp).Seconds() * 1000 // Convert to milliseconds
		intervals = append(intervals, interval)
		totalInterval += interval
	}

	actualInterval := totalInterval / float64(len(intervals))

	// Calculate standard deviation
	var variance float64
	for _, interval := range intervals {
		diff := interval - actualInterval
		variance += diff * diff
	}
	stdDev := variance / float64(len(intervals))
	if stdDev > 0 {
		stdDev = stdDev * stdDev // sqrt approximation
	}

	// Find maximum jitter
	var maxJitter float64
	for _, interval := range intervals {
		jitter := interval - expectedInterval
		if jitter < 0 {
			jitter = -jitter
		}
		if jitter > maxJitter {
			maxJitter = jitter
		}
	}

	// Calculate drift rate
	driftRate := ((actualInterval - expectedInterval) / expectedInterval) * 100

	return TimingAnalysis{
		ExpectedInterval:  expectedInterval,
		ActualInterval:    actualInterval,
		StandardDeviation: stdDev,
		MaxJitter:         maxJitter,
		DriftRate:         driftRate,
	}
}

// countDuplicates counts duplicate records in the time range
func (dic *DataIntegrityChecker) countDuplicates(ctx context.Context, machineID string, startTime, endTime time.Time) (int, error) {
	query := `
		SELECT COUNT(*) as duplicates
		FROM (
			SELECT time, machine_id, COUNT(*) as count
			FROM sensor_data 
			WHERE machine_id = $1 AND time BETWEEN $2 AND $3
			GROUP BY time, machine_id 
			HAVING COUNT(*) > 1
		) as dup_groups
	`
	var duplicates int
	err := dic.repo.db.QueryRow(ctx, query, machineID, startTime, endTime).Scan(&duplicates)
	return duplicates, err
}

// assessQuality calculates a quality score and generates issues/recommendations
func (dic *DataIntegrityChecker) assessQuality(report *IntegrityReport) {
	score := 100.0 // Start with perfect score
	
	// Data loss penalty
	if report.DataLossPercent > 0 {
		score -= report.DataLossPercent * 0.5 // 0.5 points per percent data loss
		if report.DataLossPercent > 50 {
			report.Issues = append(report.Issues, "Severe data loss detected (>50%)")
			report.Recommendations = append(report.Recommendations, "Check edge agent connectivity and buffering")
		} else if report.DataLossPercent > 10 {
			report.Issues = append(report.Issues, "Significant data loss detected (>10%)")
			report.Recommendations = append(report.Recommendations, "Monitor network stability and NATS connection")
		}
	}

	// Sequence gap penalty
	if len(report.SequenceGaps) > 0 {
		score -= float64(len(report.SequenceGaps)) * 2.0 // 2 points per gap
		report.Issues = append(report.Issues, fmt.Sprintf("Sequence gaps detected: %d missing sequence numbers", len(report.SequenceGaps)))
		report.Recommendations = append(report.Recommendations, "Investigate message ordering and processing")
	}

	// Duplicate penalty
	if report.DuplicateCount > 0 {
		score -= float64(report.DuplicateCount) * 5.0 // 5 points per duplicate
		report.Issues = append(report.Issues, fmt.Sprintf("Duplicate records detected: %d", report.DuplicateCount))
		report.Recommendations = append(report.Recommendations, "Review message deduplication logic")
	}

	// Timing drift penalty
	if report.TimingDrift.DriftRate > 5.0 {
		score -= 10.0
		report.Issues = append(report.Issues, fmt.Sprintf("Timing drift detected: %.2f%% deviation", report.TimingDrift.DriftRate))
		report.Recommendations = append(report.Recommendations, "Optimize sampling loop precision")
	}

	// Jitter penalty
	if report.TimingDrift.MaxJitter > 50.0 {
		score -= 5.0
		report.Issues = append(report.Issues, fmt.Sprintf("High timing jitter: %.2fms max", report.TimingDrift.MaxJitter))
		report.Recommendations = append(report.Recommendations, "Consider system performance tuning")
	}

	// Ensure score doesn't go below 0
	if score < 0 {
		score = 0
	}

	report.QualityScore = score

	// Add positive feedback for high quality
	if score >= 95 {
		report.Issues = append(report.Issues, "Excellent data quality - no significant issues detected")
	} else if score >= 80 {
		report.Issues = append(report.Issues, "Good data quality with minor issues")
	} else if score >= 60 {
		report.Issues = append(report.Issues, "Moderate data quality issues detected")
	} else {
		report.Issues = append(report.Issues, "Poor data quality - immediate attention required")
	}
}

// GetRealtimeQualityMetrics returns current data quality metrics
func (dic *DataIntegrityChecker) GetRealtimeQualityMetrics(ctx context.Context, machineID string) (map[string]interface{}, error) {
	// Get last 5 minutes of data for real-time assessment
	endTime := time.Now()
	startTime := endTime.Add(-5 * time.Minute)

	report, err := dic.PerformIntegrityCheck(ctx, machineID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"quality_score":     report.QualityScore,
		"data_loss_percent": report.DataLossPercent,
		"sequence_gaps":     len(report.SequenceGaps),
		"duplicate_count":   report.DuplicateCount,
		"timing_drift":      report.TimingDrift.DriftRate,
		"max_jitter_ms":     report.TimingDrift.MaxJitter,
		"last_updated":      time.Now(),
	}, nil
}