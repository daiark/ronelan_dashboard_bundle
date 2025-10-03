DROP TABLE IF EXISTS sensor_data;
DROP TABLE IF EXISTS machines;

CREATE TABLE sensor_data (
    time TIMESTAMPTZ NOT NULL,
    machine_id TEXT NOT NULL,
    sequence_number BIGINT NOT NULL,
    temperature DOUBLE PRECISION NOT NULL,
    spindle_speed DOUBLE PRECISION NOT NULL,
    x_pos_mm DOUBLE PRECISION,
    y_pos_mm DOUBLE PRECISION,
    z_pos_mm DOUBLE PRECISION,
    feed_rate_actual DOUBLE PRECISION,
    spindle_load_percent DOUBLE PRECISION,
    machine_state TEXT,
    active_program_line INTEGER,
    total_power_kw DOUBLE PRECISION,
    
    -- Unique constraint to prevent duplicate sequence numbers per machine
    UNIQUE(machine_id, sequence_number)
);

CREATE TABLE machines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    controller_type TEXT,
    max_spindle_speed_rpm INTEGER,
    axis_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DNC transfer tracking tables
-- Optional: enable TimescaleDB features if available
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- try to create extension if we can
        BEGIN
            CREATE EXTENSION IF NOT EXISTS timescaledb;
        EXCEPTION WHEN OTHERS THEN
            -- ignore if not installed
            NULL;
        END;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS dnc_transfers (
    transfer_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    program_name TEXT,
    mode TEXT,
    params JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT
);

CREATE TABLE IF NOT EXISTS dnc_events (
    time TIMESTAMPTZ NOT NULL,
    transfer_id TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    state TEXT,
    line INTEGER,
    lines_total INTEGER,
    bytes_sent BIGINT,
    rate_lps DOUBLE PRECISION,
    eta_sec DOUBLE PRECISION,
    event TEXT,
    error TEXT,
    extra JSONB
);

CREATE INDEX IF NOT EXISTS idx_dnc_events_machine_time ON dnc_events(machine_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_dnc_events_transfer_time ON dnc_events(transfer_id, time DESC);

-- Create hypertable if TimescaleDB is present
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('dnc_events', 'time', if_not_exists => TRUE);
    END IF;
END $$;
