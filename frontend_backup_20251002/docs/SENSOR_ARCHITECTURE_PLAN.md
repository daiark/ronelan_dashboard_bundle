# Sensor Architecture & Integration Plan

## Overview

This document outlines the sensor architecture for CNC machine monitoring with one Raspberry Pi per machine, focusing on vibration monitoring integration with the existing DNC feeder system.

## Architecture: One Pi per Machine

```
┌─────────────────────────────────────────────────┐
│                CNC Machine                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────────┐   │
│  │ ADXL355 │    │ ADXL355 │    │ Temperature │   │
│  │Spindle  │    │ X-Axis  │    │  Sensors    │   │
│  └─────────┘    └─────────┘    └─────────────┘   │
│         │            │               │           │
│         └────────────┼───────────────┘           │
│                      │                           │
│  ┌───────────────────▼─────────────────────────┐ │
│  │          Raspberry Pi                       │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │     DNC Feeder Service                  │ │ │
│  │  │  - Program Transfer (RS-232)            │ │ │
│  │  │  - BCC/Standard Protocol                │ │ │
│  │  │  - Progress Tracking                    │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │     Sensor Data Service                 │ │ │
│  │  │  - ADXL355 SPI Interface                │ │ │
│  │  │  - Real-time Vibration Analysis         │ │ │
│  │  │  - Temperature Monitoring               │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │     Data Aggregation Service            │ │ │
│  │  │  - WebSocket Server                     │ │ │
│  │  │  - Data Fusion (DNC + Sensors)          │ │ │
│  │  │  - Historical Data Buffer               │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│                      │                           │
└──────────────────────┼───────────────────────────┘
                       │ Ethernet
                       ▼
┌─────────────────────────────────────────────────┐
│              Backend Server                     │
│  ┌─────────────────────────────────────────────┐ │
│  │     Machine Data API                        │ │
│  │  - Aggregates data from all Pis             │ │
│  │  - Historical storage                       │ │
│  │  - Dashboard WebSocket relay                │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│               Frontend Dashboard                │
│  ┌─────────────────────────────────────────────┐ │
│  │     Real-time Chart with Data Selector     │ │
│  │  - Combined DNC + Sensor data display       │ │
│  │  - Interactive legend for data selection    │ │
│  │  - Synchronized time series visualization   │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Sensor Hardware Configuration

### Primary Sensors per Machine
```yaml
vibration_sensors:
  spindle_sensor:
    type: ADXL355
    location: "Spindle housing front"
    interface: SPI
    sampling_rate: 2048  # Hz
    range: "±8g"
    
  x_axis_sensor:
    type: ADXL355
    location: "X-axis motor coupling"
    interface: SPI
    sampling_rate: 2048  # Hz
    range: "±4g"

temperature_sensors:
  spindle_bearing:
    type: DS18B20
    location: "Spindle bearing housing"
    interface: 1-Wire
    
  motor_temperature:
    type: DS18B20
    location: "Servo motor housing"
    interface: 1-Wire
```

### Pi GPIO Allocation
```
SPI0 (ADXL355 Sensors):
- GPIO 10: MOSI
- GPIO 9:  MISO
- GPIO 11: SCLK
- GPIO 8:  CS0 (Spindle sensor)
- GPIO 7:  CS1 (X-axis sensor)

1-Wire (Temperature):
- GPIO 4: 1-Wire data line

UART (DNC):
- GPIO 14: TX (to CNC)
- GPIO 15: RX (from CNC)
- GPIO 17: RTS
- GPIO 16: CTS
```

## Data Model Integration

### Enhanced Sensor Data Types
```typescript
// Extended sensor data structure
export interface SensorData {
  machine_id: string;
  timestamp: string;
  
  // Existing DNC/Controller data
  temperature: number;
  spindle_speed: number;
  x_pos_mm: number;
  y_pos_mm: number;
  z_pos_mm: number;
  feed_rate_actual: number;
  spindle_load_percent: number;
  total_power_kw: number;
  
  // New vibration sensor data
  vibration_spindle_rms: number;    // m/s²
  vibration_spindle_peak: number;   // m/s²
  vibration_x_axis_rms: number;     // m/s²
  vibration_x_axis_peak: number;    // m/s²
  
  // New temperature sensor data
  spindle_bearing_temp: number;     // °C
  motor_temperature: number;        // °C
  
  // Data quality indicators
  sensor_health: {
    spindle_vibration: 'online' | 'offline' | 'error';
    x_axis_vibration: 'online' | 'offline' | 'error';
    temperature_sensors: 'online' | 'offline' | 'error';
  };
}
```

## Real-time Chart Data Selection

### Chart Data Sources Configuration
```typescript
export interface ChartDataSource {
  id: string;
  label: string;
  unit: string;
  color: string;
  category: 'motion' | 'process' | 'vibration' | 'temperature';
  enabled: boolean;
  min_scale?: number;
  max_scale?: number;
}

export const AVAILABLE_DATA_SOURCES: ChartDataSource[] = [
  // Motion Data
  {
    id: 'spindle_speed',
    label: 'Spindle Speed',
    unit: 'RPM',
    color: '#10B981',
    category: 'motion',
    enabled: true
  },
  {
    id: 'feed_rate_actual',
    label: 'Feed Rate',
    unit: 'mm/min',
    color: '#3B82F6',
    category: 'motion',
    enabled: false
  },
  
  // Process Data
  {
    id: 'spindle_load_percent',
    label: 'Spindle Load',
    unit: '%',
    color: '#F59E0B',
    category: 'process',
    enabled: false,
    max_scale: 100
  },
  {
    id: 'total_power_kw',
    label: 'Total Power',
    unit: 'kW',
    color: '#EF4444',
    category: 'process',
    enabled: false
  },
  
  // Vibration Data (NEW)
  {
    id: 'vibration_spindle_rms',
    label: 'Spindle Vibration RMS',
    unit: 'm/s²',
    color: '#8B5CF6',
    category: 'vibration',
    enabled: false,
    max_scale: 10
  },
  {
    id: 'vibration_spindle_peak',
    label: 'Spindle Vibration Peak',
    unit: 'm/s²',
    color: '#A855F7',
    category: 'vibration',
    enabled: false,
    max_scale: 20
  },
  {
    id: 'vibration_x_axis_rms',
    label: 'X-Axis Vibration RMS',
    unit: 'm/s²',
    color: '#EC4899',
    category: 'vibration',
    enabled: false,
    max_scale: 5
  },
  
  // Temperature Data (NEW)
  {
    id: 'spindle_bearing_temp',
    label: 'Spindle Bearing Temp',
    unit: '°C',
    color: '#F97316',
    category: 'temperature',
    enabled: false,
    max_scale: 100
  },
  {
    id: 'motor_temperature',
    label: 'Motor Temperature',
    unit: '°C',
    color: '#DC2626',
    category: 'temperature',
    enabled: false,
    max_scale: 80
  }
];
```

## Implementation Phases

### Phase 1: Hardware Setup (2-3 weeks)
```bash
# Pi sensor service setup
1. Install ADXL355 Python library
2. Configure SPI interface
3. Setup 1-Wire for temperature sensors
4. Test sensor data collection

# Data service integration
5. Extend existing heidenhain_sender.py with sensor reading
6. Create unified WebSocket data stream
7. Test data transmission to backend
```

### Phase 2: Frontend Integration (1-2 weeks)
```typescript
// Update existing chart component
1. Extend TimeSeriesDataGraph to support multiple data sources
2. Add interactive legend with category grouping
3. Implement data source toggle functionality
4. Add color coding and units display
```

### Phase 3: Mock Data Enhancement (1 week)
```typescript
// Enhanced mock data generation
1. Add realistic vibration patterns (cutting vs idle)
2. Generate correlated temperature data
3. Simulate sensor health states
4. Create realistic sensor failure scenarios
```

## Pi Software Architecture

### Service Structure
```python
# /home/pi/sensor_service.py
class SensorDataService:
    def __init__(self):
        self.adxl355_spindle = ADXL355(spi_device=0, cs_pin=8)
        self.adxl355_x_axis = ADXL355(spi_device=0, cs_pin=7)
        self.temp_sensors = DS18B20MultiSensor(pin=4)
        
    def read_sensor_data(self):
        return {
            'vibration_spindle_rms': self.calculate_rms(self.adxl355_spindle.read()),
            'vibration_spindle_peak': self.calculate_peak(self.adxl355_spindle.read()),
            'vibration_x_axis_rms': self.calculate_rms(self.adxl355_x_axis.read()),
            'vibration_x_axis_peak': self.calculate_peak(self.adxl355_x_axis.read()),
            'spindle_bearing_temp': self.temp_sensors.read('spindle_bearing'),
            'motor_temperature': self.temp_sensors.read('motor'),
            'timestamp': datetime.now().isoformat()
        }

# Integration with existing DNC service
class EnhancedDNCService(DNCService):
    def __init__(self):
        super().__init__()
        self.sensor_service = SensorDataService()
        
    def get_combined_data(self):
        # Merge DNC progress data with sensor readings
        dnc_data = self.get_dnc_status()
        sensor_data = self.sensor_service.read_sensor_data()
        return {**dnc_data, **sensor_data}
```

## Frontend Chart Legend Implementation

### Interactive Legend Component
```typescript
interface ChartLegendProps {
  dataSources: ChartDataSource[];
  onToggleDataSource: (sourceId: string) => void;
  groupByCategory?: boolean;
}

const ChartLegend: React.FC<ChartLegendProps> = ({ 
  dataSources, 
  onToggleDataSource,
  groupByCategory = true 
}) => {
  const groupedSources = groupByCategory 
    ? groupBy(dataSources, 'category')
    : { all: dataSources };
    
  return (
    <div className="chart-legend bg-dark-800 rounded-lg p-3 mt-4">
      {Object.entries(groupedSources).map(([category, sources]) => (
        <div key={category} className="legend-category mb-2">
          {groupByCategory && (
            <h4 className="text-xs font-semibold text-dark-300 mb-1">
              {category.toUpperCase()}
            </h4>
          )}
          <div className="flex flex-wrap gap-2">
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => onToggleDataSource(source.id)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  source.enabled 
                    ? 'bg-opacity-20 text-white' 
                    : 'bg-dark-600 text-dark-400 hover:text-dark-200'
                }`}
                style={{ 
                  backgroundColor: source.enabled ? source.color + '33' : undefined,
                  borderLeft: `3px solid ${source.color}`
                }}
              >
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: source.color }}
                />
                <span>{source.label}</span>
                <span className="text-dark-500">({source.unit})</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

## Integration Benefits

1. **Unified Data Stream**: All machine data (DNC + sensors) flows through single WebSocket
2. **Real-time Correlation**: Vibration spikes correlate with program events, spindle speed changes
3. **Predictive Insights**: Gradual vibration increases indicate tool wear, bearing degradation
4. **Troubleshooting**: Temperature trends help diagnose servo motor issues, coolant problems
5. **Process Optimization**: Feed rate vs vibration correlation helps optimize cutting parameters

## Cost Breakdown (Per Machine)

```
Hardware:
- 2x ADXL355 Breakout Boards: $60
- 2x DS18B20 Temperature Sensors: $6  
- Wiring & Connectors: $20
- Magnetic Sensor Mounts: $30
Total Hardware: $116

Development:
- Pi software integration: 16 hours
- Frontend chart enhancement: 12 hours  
- Testing & validation: 8 hours
Total Development: 36 hours per machine type
```

## Next Steps

1. **Order sensors**: 2x ADXL355 + 2x DS18B20 for proof of concept
2. **Extend mock data**: Add vibration and temperature fields to existing sensor data generation
3. **Update chart component**: Add legend and multi-source capability
4. **Pi integration**: Modify existing DNC service to include sensor readings
5. **Test correlation**: Validate that vibration data correlates with cutting operations

This architecture leverages your existing Pi-per-machine setup while adding valuable sensor data that machinist can interpret through the familiar real-time chart interface.