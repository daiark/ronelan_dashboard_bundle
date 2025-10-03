// Machine Status Enum for consistent state management
export enum MachineStatus {
  RUNNING = 'Running',
  IDLE = 'Idle',
  ERROR = 'Error',
  MAINTENANCE = 'Maintenance'
}

// API Types based on Go backend models
export interface SensorData {
  machine_id: string;
  temperature: number;
  spindle_speed: number;
  timestamp: string;
  x_pos_mm: number;
  y_pos_mm: number;
  z_pos_mm: number;
  feed_rate_actual: number;
  spindle_load_percent: number;
  machine_state: string;
  active_program_line: number;
  total_power_kw: number;
  
  // Vibration sensor data (ADXL355)
  vibration_spindle_rms?: number;    // m/s² - RMS acceleration at spindle
  vibration_spindle_peak?: number;   // m/s² - Peak acceleration at spindle
  vibration_x_axis_rms?: number;     // m/s² - RMS acceleration at X-axis
  vibration_x_axis_peak?: number;    // m/s² - Peak acceleration at X-axis
  
  // Additional temperature sensors (DS18B20)
  spindle_bearing_temp?: number;     // °C - Spindle bearing temperature
  motor_temperature?: number;        // °C - Servo motor temperature
  
  // Sensor health indicators
  sensor_health?: {
    spindle_vibration: 'online' | 'offline' | 'error';
    x_axis_vibration: 'online' | 'offline' | 'error';
    temperature_sensors: 'online' | 'offline' | 'error';
  };
}

export interface Machine {
  id: string;
  name: string;
  location: string;
  controller_type: string;
  max_spindle_speed_rpm: number;
  axis_count: number;
  created_at: string;
  last_updated: string;
  model?: string;
  status?: MachineStatus;
  // NC Program integration
  raspberry_pi_ip?: string;
  raspberry_pi_status?: RaspberryPiStatus;
  raspberry_pi_device_id?: string; // Assigned Pi device ID
  current_program?: NCProgram;
  program_queue?: NCProgram[];
}

// UI State Types
export interface MachineStatusData {
  machine: Machine;
  latestData?: SensorData;
  isOnline: boolean;
  lastUpdate: Date;
  status: MachineStatus;
}

// Chart and Widget Data Types
export interface ChartDataPoint {
  timestamp: string | number;
  value: number;
  label?: string;
}

export interface MetricData {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

export interface RadialGaugeData {
  value: number;
  max: number;
  min?: number;
  unit?: string;
  label: string;
  status?: MachineStatus;
}

// NC Program Types
export enum NCProgramStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  ERROR = 'error',
  PAUSED = 'paused'
}

export interface NCProgram {
  id: string;
  name: string;
  filename: string;
  content?: string;
  machine_id: string;
  created_at: string;
  last_modified: string;
  status: NCProgramStatus;
  progress?: number;
  estimated_duration?: number; // in minutes
  file_size: number; // in bytes
  checksum?: string;
}

// Raspberry Pi Integration Types
export enum RaspberryPiStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  UNKNOWN = 'unknown',
  ERROR = 'error'
}

export interface RaspberryPiInfo {
  ip_address: string;
  status: RaspberryPiStatus;
  last_heartbeat?: string;
  dnc_service_running: boolean;
  available_storage?: number; // in MB
  cpu_usage?: number; // percentage
  memory_usage?: number; // percentage
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'sensor_data' | 'machine_status' | 'nc_program_update' | 'raspberry_pi_status' | 'error';
  data: SensorData | Machine | NCProgram | RaspberryPiInfo | { message: string };
  timestamp: string;
}
