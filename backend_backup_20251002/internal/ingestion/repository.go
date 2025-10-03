// internal/ingestion/repository.go
package ingestion

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// InsertSensorData inserts a new sensor data record into the database with deduplication.
func (r *Repository) InsertSensorData(ctx context.Context, data SensorData) error {
	// DEBUG: Log the data being inserted
	if os.Getenv("CNC_DEBUG") != "" {
		log.Printf("DEBUG: Inserting data - MachineID: %s, SequenceNumber: %d, Timestamp: %s", 
			data.MachineID, data.SequenceNumber, data.Timestamp)
	}
	
	query := `INSERT INTO sensor_data (time, machine_id, sequence_number, temperature, spindle_speed, x_pos_mm, y_pos_mm, z_pos_mm, feed_rate_actual, spindle_load_percent, machine_state, active_program_line, total_power_kw) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	          ON CONFLICT (machine_id, sequence_number) DO NOTHING`
	_, err := r.db.Exec(ctx, query, data.Timestamp, data.MachineID, data.SequenceNumber, data.Temperature, data.SpindleSpeed, data.XPosMM, data.YPosMM, data.ZPosMM, data.FeedRateActual, data.SpindleLoadPercent, data.MachineState, data.ActiveProgramLine, data.TotalPowerKW)
	
	if err != nil {
		if os.Getenv("CNC_DEBUG") != "" {
			log.Printf("DEBUG: Database insertion failed for MachineID: %s, SequenceNumber: %d, Error: %v", 
				data.MachineID, data.SequenceNumber, err)
		}
	}
	
	return err
}

// GetSensorDataForMachine retrieves sensor data for a specific machine within a time range.
func (r *Repository) GetSensorDataForMachine(ctx context.Context, machineID string, startTime, endTime time.Time) ([]SensorData, error) {
	query := `SELECT time, machine_id, sequence_number, temperature, spindle_speed, x_pos_mm, y_pos_mm, z_pos_mm, feed_rate_actual, spindle_load_percent, machine_state, active_program_line, total_power_kw FROM sensor_data WHERE machine_id = $1 AND time BETWEEN $2 AND $3 ORDER BY sequence_number ASC`
	rows, err := r.db.Query(ctx, query, machineID, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []SensorData
	for rows.Next() {
		var sd SensorData
		if err := rows.Scan(&sd.Timestamp, &sd.MachineID, &sd.SequenceNumber, &sd.Temperature, &sd.SpindleSpeed, &sd.XPosMM, &sd.YPosMM, &sd.ZPosMM, &sd.FeedRateActual, &sd.SpindleLoadPercent, &sd.MachineState, &sd.ActiveProgramLine, &sd.TotalPowerKW); err != nil {
			return nil, err
		}
		data = append(data, sd)
	}

	return data, nil
}

// GetAllMachines retrieves all registered machines.
func (r *Repository) GetAllMachines(ctx context.Context) ([]Machine, error) {
	query := `SELECT id, name, location, controller_type, max_spindle_speed_rpm, axis_count, created_at, last_updated FROM machines ORDER BY name ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var machines []Machine
	for rows.Next() {
		var m Machine
		if err := rows.Scan(&m.ID, &m.Name, &m.Location, &m.ControllerType, &m.MaxSpindleSpeedRPM, &m.AxisCount, &m.CreatedAt, &m.LastUpdated); err != nil {
			return nil, err
		}
		machines = append(machines, m)
	}

	return machines, nil
}

// CreateMachine adds a new machine to the database.
func (r *Repository) CreateMachine(ctx context.Context, machine Machine) error {
	query := `INSERT INTO machines (id, name, location, controller_type, max_spindle_speed_rpm, axis_count) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Exec(ctx, query, machine.ID, machine.Name, machine.Location, machine.ControllerType, machine.MaxSpindleSpeedRPM, machine.AxisCount)
	return err
}

// GetLastSequenceNumber returns the highest sequence number for a machine.
func (r *Repository) GetLastSequenceNumber(ctx context.Context, machineID string) (uint64, error) {
	query := `SELECT COALESCE(MAX(sequence_number), 0) FROM sensor_data WHERE machine_id = $1`
	var lastSeq uint64
	err := r.db.QueryRow(ctx, query, machineID).Scan(&lastSeq)
	return lastSeq, err
}

// DetectSequenceGaps finds missing sequence numbers for a machine.
func (r *Repository) DetectSequenceGaps(ctx context.Context, machineID string) ([]uint64, error) {
	query := `
		WITH sequence_series AS (
			SELECT generate_series(1, (SELECT MAX(sequence_number) FROM sensor_data WHERE machine_id = $1)) as seq
		)
		SELECT seq FROM sequence_series
		WHERE seq NOT IN (SELECT sequence_number FROM sensor_data WHERE machine_id = $1)
		ORDER BY seq
	`
	rows, err := r.db.Query(ctx, query, machineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gaps []uint64
	for rows.Next() {
		var seq uint64
		if err := rows.Scan(&seq); err != nil {
			return nil, err
		}
		gaps = append(gaps, seq)
	}
	return gaps, nil
}

// UpsertDNCTransfer updates or inserts a transfer record when progress arrives.
func (r *Repository) UpsertDNCTransfer(ctx context.Context, ev DNCEvent) error {
	status := ev.State
	if status == "completed" || status == "error" || status == "canceled" {
		// terminal states close the transfer
		query := `INSERT INTO dnc_transfers (transfer_id, machine_id, program_name, mode, params, status, started_at, completed_at)
				VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, NOW()), NOW())
				ON CONFLICT (transfer_id)
				DO UPDATE SET status=EXCLUDED.status, completed_at=NOW(), program_name=EXCLUDED.program_name, mode=EXCLUDED.mode, params=EXCLUDED.params` 
		params := map[string]interface{}{"line": ev.Line, "lines_total": ev.LinesTotal}
		b, _ := json.Marshal(params)
		_, err := r.db.Exec(ctx, query, ev.TransferID, ev.MachineID, ev.ProgramName, ev.Mode, b, status, time.Now().UTC())
		return err
	}
	// running/paused/etc.
	query := `INSERT INTO dnc_transfers (transfer_id, machine_id, program_name, mode, params, status, started_at)
			VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, NOW()))
			ON CONFLICT (transfer_id)
			DO UPDATE SET status=EXCLUDED.status, program_name=EXCLUDED.program_name, mode=EXCLUDED.mode, params=EXCLUDED.params`
	params := map[string]interface{}{"line": ev.Line, "lines_total": ev.LinesTotal}
	b, _ := json.Marshal(params)
	_, err := r.db.Exec(ctx, query, ev.TransferID, ev.MachineID, ev.ProgramName, ev.Mode, b, ev.State, time.Now().UTC())
	return err
}

// InsertDNCEvent persists a single DNC progress event.
func (r *Repository) InsertDNCEvent(ctx context.Context, ev DNCEvent) error {
	b, _ := json.Marshal(ev.Extra)
	query := `INSERT INTO dnc_events (time, transfer_id, machine_id, state, line, lines_total, bytes_sent, rate_lps, eta_sec, event, error, extra)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	_, err := r.db.Exec(ctx, query, ev.Time, ev.TransferID, ev.MachineID, ev.State, ev.Line, ev.LinesTotal, ev.BytesSent, ev.RateLPS, ev.ETASec, ev.Event, ev.Error, b)
	return err
}

// GetDNCTransfers returns recent transfers in a time range.
func (r *Repository) GetDNCTransfers(ctx context.Context, startTime, endTime time.Time, limit int) ([]DNCTransfer, error) {
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	query := `SELECT transfer_id, machine_id, program_name, mode, params, started_at, completed_at, status
			FROM dnc_transfers WHERE started_at BETWEEN $1 AND $2
			ORDER BY started_at DESC LIMIT $3`
	rows, err := r.db.Query(ctx, query, startTime, endTime, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DNCTransfer
	for rows.Next() {
		var t DNCTransfer
		var paramsBytes []byte
		if err := rows.Scan(&t.TransferID, &t.MachineID, &t.ProgramName, &t.Mode, &paramsBytes, &t.StartedAt, &t.CompletedAt, &t.Status); err != nil {
			return nil, err
		}
		if len(paramsBytes) > 0 {
			_ = json.Unmarshal(paramsBytes, &t.Params)
		}
		out = append(out, t)
	}
	return out, nil
}

// GetDNCEventsByTransfer returns events for a transfer in a time range.
func (r *Repository) GetDNCEventsByTransfer(ctx context.Context, transferID string, startTime, endTime time.Time) ([]DNCEvent, error) {
	query := `SELECT time, transfer_id, machine_id, state, line, lines_total, bytes_sent, rate_lps, eta_sec, event, error, extra
			FROM dnc_events WHERE transfer_id = $1 AND time BETWEEN $2 AND $3 ORDER BY time ASC`
	rows, err := r.db.Query(ctx, query, transferID, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DNCEvent
	for rows.Next() {
		var e DNCEvent
		var extraBytes []byte
		var errStr *string
		if err := rows.Scan(&e.Time, &e.TransferID, &e.MachineID, &e.State, &e.Line, &e.LinesTotal, &e.BytesSent, &e.RateLPS, &e.ETASec, &e.Event, &errStr, &extraBytes); err != nil {
			return nil, err
		}
		e.Error = errStr
		if len(extraBytes) > 0 {
			_ = json.Unmarshal(extraBytes, &e.Extra)
		}
		out = append(out, e)
	}
	return out, nil
}
