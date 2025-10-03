// internal/ingestion/models.go
package ingestion

import "time"

// SensorData represents a single data point from a CNC machine.
type SensorData struct {
	MachineID         string    `json:"machine_id"`
	SequenceNumber    uint64    `json:"sequence_number"`    // Monotonic sequence per machine
	Temperature       float64   `json:"temperature"`
	SpindleSpeed      float64   `json:"spindle_speed"`
	Timestamp         time.Time `json:"timestamp"`
	XPosMM            float64   `json:"x_pos_mm"`
	YPosMM            float64   `json:"y_pos_mm"`
	ZPosMM            float64   `json:"z_pos_mm"`
	FeedRateActual    float64   `json:"feed_rate_actual"`
	SpindleLoadPercent float64   `json:"spindle_load_percent"`
	MachineState      string    `json:"machine_state"`
	ActiveProgramLine int       `json:"active_program_line"`
	TotalPowerKW      float64   `json:"total_power_kw"`
}

// Machine represents a CNC machine with its metadata.
type Machine struct {
	ID                  string    `json:"id"`
	Name                string    `json:"name"`
	Location            string    `json:"location"`
	ControllerType      string    `json:"controller_type"`
	MaxSpindleSpeedRPM  int       `json:"max_spindle_speed_rpm"`
	AxisCount           int       `json:"axis_count"`
	CreatedAt           time.Time `json:"created_at"`
	LastUpdated         time.Time `json:"last_updated"`
}

// DNC models for progress tracking
// These mirror the JSON emitted by the DNC service.
type DNCTransfer struct {
	TransferID  string                 `json:"transfer_id"`
	MachineID   string                 `json:"machine_id"`
	ProgramName string                 `json:"program_name"`
	Mode        string                 `json:"mode"`
	Params      map[string]interface{} `json:"params"`
	StartedAt   time.Time              `json:"started_at"`
	CompletedAt *time.Time             `json:"completed_at"`
	Status      string                 `json:"status"`
}

type DNCEvent struct {
	Time        time.Time              `json:"time"`
	TransferID  string                 `json:"transfer_id"`
	MachineID   string                 `json:"machine_id"`
	State       string                 `json:"state"`
	Line        int                    `json:"line"`
	LinesTotal  int                    `json:"lines_total"`
	BytesSent   int64                  `json:"bytes_sent"`
	RateLPS     float64                `json:"rate_lps"`
	ETASec      float64                `json:"eta_sec"`
	Event       string                 `json:"event"`
	Error       *string                `json:"error"`
	Extra       map[string]interface{} `json:"extra"`
}
