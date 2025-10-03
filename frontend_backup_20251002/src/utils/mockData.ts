import type { Machine, SensorData, MachineStatusData, NCProgram } from '../types';
import { MachineStatus, NCProgramStatus, RaspberryPiStatus } from '../types';

export const mockMachines: Machine[] = [
  {
    id: "CNC-001",
    name: "CNC Machine 1",
    location: "Factory Floor A",
    controller_type: "Fanuc 31i",
    max_spindle_speed_rpm: 12000,
    axis_count: 3,
    created_at: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-08T12:30:00Z",
    model: "DMG MORI NLX 2500",
    status: MachineStatus.RUNNING,
    raspberry_pi_device_id: "Pi-Device-001",
    raspberry_pi_status: RaspberryPiStatus.CONNECTED,
    current_program: {
      id: "prog-001",
      name: "PART_HOUSING_v2.nc",
      filename: "PART_HOUSING_v2.nc",
      machine_id: "CNC-001",
      created_at: "2024-01-08T08:00:00Z",
      last_modified: "2024-01-08T08:00:00Z",
      status: NCProgramStatus.RUNNING,
      progress: 67.5,
      estimated_duration: 45,
      file_size: 15840,
      checksum: "sha256:abc123..."
    } as NCProgram
  },
  {
    id: "CNC-002", 
    name: "CNC Machine 2",
    location: "Factory Floor A",
    controller_type: "Siemens 840D",
    max_spindle_speed_rpm: 10000,
    axis_count: 4,
    created_at: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-08T12:25:00Z",
    model: "Mazak INTEGREX i-300",
    status: MachineStatus.RUNNING,
    raspberry_pi_device_id: "Pi-Device-002",
    raspberry_pi_status: RaspberryPiStatus.CONNECTED,
    current_program: {
      id: "prog-002",
      name: "BRACKET_ASSEMBLY.h",
      filename: "BRACKET_ASSEMBLY.h",
      machine_id: "CNC-002",
      created_at: "2024-01-08T10:30:00Z",
      last_modified: "2024-01-08T10:30:00Z",
      status: NCProgramStatus.PAUSED,
      progress: 34.2,
      estimated_duration: 28,
      file_size: 8960,
      checksum: "sha256:def456..."
    } as NCProgram
  },
  {
    id: "CNC-003",
    name: "CNC Machine 3", 
    location: "Factory Floor B",
    controller_type: "Haas NGC",
    max_spindle_speed_rpm: 8000,
    axis_count: 3,
    created_at: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-08T12:20:00Z",
    model: "Haas VF-2SS",
    status: MachineStatus.MAINTENANCE,
    raspberry_pi_device_id: "Pi-Device-003",
    raspberry_pi_status: RaspberryPiStatus.DISCONNECTED
  },
  {
    id: "MILL-001",
    name: "Milling Machine 1",
    location: "Factory Floor B", 
    controller_type: "Mazak Matrix",
    max_spindle_speed_rpm: 15000,
    axis_count: 5,
    created_at: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-08T12:15:00Z",
    model: "Okuma GENOS M560-V",
    status: MachineStatus.IDLE
  }
];

export const generateMockSensorData = (machineId: string, count: number = 50): SensorData[] => {
  const data: SensorData[] = [];
  const now = new Date();
  
  // Different base values for different machines
  const baseValues = {
    "CNC-001": { 
      temp: 45, speed: 8500, load: 75, power: 15.2,
      // Vibration (higher for active cutting)
      spindle_vib_rms: 3.2, spindle_vib_peak: 8.5,
      x_axis_vib_rms: 1.8, x_axis_vib_peak: 4.2,
      // Temperature (warmer for active machine)
      bearing_temp: 52, motor_temp: 48
    },
    "CNC-002": { 
      temp: 42, speed: 7200, load: 68, power: 12.8,
      spindle_vib_rms: 2.8, spindle_vib_peak: 7.1,
      x_axis_vib_rms: 1.5, x_axis_vib_peak: 3.8,
      bearing_temp: 48, motor_temp: 44
    },
    "CNC-003": { 
      temp: 48, speed: 6800, load: 82, power: 18.5,
      spindle_vib_rms: 0.8, spindle_vib_peak: 2.1, // Lower - maintenance mode
      x_axis_vib_rms: 0.4, x_axis_vib_peak: 1.2,
      bearing_temp: 38, motor_temp: 35
    },
    "MILL-001": { 
      temp: 38, speed: 12000, load: 55, power: 22.1,
      spindle_vib_rms: 0.5, spindle_vib_peak: 1.8, // Lower - idle
      x_axis_vib_rms: 0.3, x_axis_vib_peak: 0.9,
      bearing_temp: 42, motor_temp: 38
    }
  };
  
  const base = baseValues[machineId as keyof typeof baseValues] || baseValues["CNC-001"];
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now.getTime() - (count - i) * 5000); // 5 second intervals
    
    // Add realistic variation
    const tempVariation = (Math.random() - 0.5) * 10;
    const speedVariation = (Math.random() - 0.5) * 2000;
    const loadVariation = (Math.random() - 0.5) * 30;
    const powerVariation = (Math.random() - 0.5) * 5;
    
    // Vibration variation (correlates with spindle activity)
    const vibrationFactor = 1 + (Math.random() - 0.5) * 0.4; // ±20% variation
    const spindleVibRmsVar = base.spindle_vib_rms * vibrationFactor;
    const spindleVibPeakVar = base.spindle_vib_peak * vibrationFactor;
    const xAxisVibRmsVar = base.x_axis_vib_rms * vibrationFactor;
    const xAxisVibPeakVar = base.x_axis_vib_peak * vibrationFactor;
    
    // Temperature variation (gradual changes)
    const tempFactor = 1 + (Math.random() - 0.5) * 0.1; // ±5% variation
    const bearingTempVar = base.bearing_temp * tempFactor;
    const motorTempVar = base.motor_temp * tempFactor;
    
    // Simulate different machine states
    let machineState = "running";
    if (Math.random() < 0.1) machineState = "idle";
    if (Math.random() < 0.02) machineState = "maintenance";
    
    data.push({
      machine_id: machineId,
      temperature: Math.max(20, base.temp + tempVariation),
      spindle_speed: Math.max(0, base.speed + speedVariation),
      timestamp: timestamp.toISOString(),
      x_pos_mm: 50 + Math.random() * 200,
      y_pos_mm: 25 + Math.random() * 150,
      z_pos_mm: 10 + Math.random() * 80,
      feed_rate_actual: 800 + Math.random() * 800,
      spindle_load_percent: Math.max(0, Math.min(100, base.load + loadVariation)),
      machine_state: machineState,
      active_program_line: Math.floor(100 + Math.random() * 200),
      total_power_kw: Math.max(0, base.power + powerVariation),
      
      // Vibration sensor data
      vibration_spindle_rms: Math.max(0, spindleVibRmsVar),
      vibration_spindle_peak: Math.max(0, spindleVibPeakVar),
      vibration_x_axis_rms: Math.max(0, xAxisVibRmsVar),
      vibration_x_axis_peak: Math.max(0, xAxisVibPeakVar),
      
      // Temperature sensor data
      spindle_bearing_temp: Math.max(20, bearingTempVar),
      motor_temperature: Math.max(20, motorTempVar),
      
      // Sensor health (mostly online for demo)
      sensor_health: {
        spindle_vibration: Math.random() > 0.05 ? 'online' : 'offline',
        x_axis_vibration: Math.random() > 0.05 ? 'online' : 'offline', 
        temperature_sensors: Math.random() > 0.02 ? 'online' : 'offline'
      }
    });
  }
  
  return data;
};

// Pre-generated sensor data for all machines
export const mockSensorData = {
  "CNC-001": generateMockSensorData("CNC-001"),
  "CNC-002": generateMockSensorData("CNC-002"),
  "CNC-003": generateMockSensorData("CNC-003"),
  "MILL-001": generateMockSensorData("MILL-001")
};

// Mock machine statuses
export const mockMachineStatuses: Record<string, MachineStatusData> = {
  "CNC-001": {
    machine: mockMachines[0],
    latestData: mockSensorData["CNC-001"][mockSensorData["CNC-001"].length - 1],
    isOnline: true,
    lastUpdate: new Date(),
    status: MachineStatus.RUNNING
  },
  "CNC-002": {
    machine: mockMachines[1], 
    latestData: mockSensorData["CNC-002"][mockSensorData["CNC-002"].length - 1],
    isOnline: true,
    lastUpdate: new Date(),
    status: MachineStatus.RUNNING
  },
  "CNC-003": {
    machine: mockMachines[2],
    latestData: mockSensorData["CNC-003"][mockSensorData["CNC-003"].length - 1],
    isOnline: false, // Offline machine for testing
    lastUpdate: new Date(Date.now() - 300000), // 5 minutes ago
    status: MachineStatus.MAINTENANCE
  },
  "MILL-001": {
    machine: mockMachines[3],
    latestData: mockSensorData["MILL-001"][mockSensorData["MILL-001"].length - 1],
    isOnline: true,
    lastUpdate: new Date(),
    status: MachineStatus.IDLE
  }
};
