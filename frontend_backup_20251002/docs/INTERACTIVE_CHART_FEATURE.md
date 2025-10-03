# Interactive Real-Time Data Chart Feature

## Overview

The interactive real-time data chart feature provides users with the ability to select and visualize multiple sensor data sources simultaneously. This feature supports the future integration of vibration sensors (ADXL355) and temperature sensors (DS18B20) from Raspberry Pi devices connected to CNC machines.

## Architecture

### Component Structure
```
TimeSeriesPanel (Container)
├── TimeSeriesDataGraph (Chart Rendering)
└── ChartLegend (Interactive Controls)
```

### Data Flow
```
Mock Data Generator → Machine Store → TimeSeriesPanel
                                          ├── Chart Data Processing
                                          ├── Data Source State Management
                                          └── Legend Interaction Handling
```

## Key Features

### 1. Multi-Source Data Selection
- Users can toggle individual data sources on/off
- Real-time chart updates based on selections
- Persistent user preferences via localStorage

### 2. Categorized Data Sources
Categories organize sensor types:
- **Motion** ⚡: Spindle speed, feed rate, positioning
- **Process** 🔧: Spindle load, power consumption, general temperature
- **Vibration** 📊: ADXL355 sensor data (RMS and peak acceleration)
- **Temperature** 🌡️: DS18B20 sensor data (bearing and motor temperatures)

### 3. Adaptive Chart Rendering
- Dynamic line generation based on enabled sources
- Color-coded lines matching legend indicators
- Proper unit formatting in tooltips
- Empty state when no sources are selected

## Implementation Details

### ChartLegend Component
**Location:** `src/components/charts/ChartLegend.tsx`

**Key Features:**
- Category-grouped data source toggles
- Visual color indicators matching chart lines
- Source count display per category
- Responsive design for mobile devices

**Props:**
```typescript
interface ChartLegendProps {
  dataSources: ChartDataSource[];
  onToggleDataSource: (sourceId: string) => void;
  groupByCategory?: boolean;
}
```

### TimeSeriesDataGraph Enhancement
**Location:** `src/components/TimeSeriesDataGraph.tsx`

**Key Changes:**
- Accepts `enabledDataSources` prop for dynamic rendering
- Generates chart lines based on enabled sources only
- Dynamic tooltip formatting using source metadata
- Empty state handling when no sources are enabled

**New Props:**
```typescript
interface TimeSeriesDataGraphProps {
  data: SensorData[];
  enabledDataSources: ChartDataSource[];
  height?: number;
  showLegend?: boolean;
}
```

### TimeSeriesPanel Integration
**Location:** `src/components/panels/TimeSeriesPanel.tsx`

**State Management:**
- Manages data source enabled/disabled state
- Persists preferences to localStorage
- Handles toggle interactions from legend

**LocalStorage Schema:**
```typescript
// Saved as 'chartDataSources' in localStorage
[
  {
    id: string,
    label: string,
    unit: string,
    color: string,
    category: 'motion' | 'process' | 'vibration' | 'temperature',
    enabled: boolean,
    min_scale?: number,
    max_scale?: number
  },
  // ... more sources
]
```

## Data Source Configuration

### Adding New Sensor Types
To add new sensor data sources, update `src/types/chartDataSources.ts`:

```typescript
export const AVAILABLE_DATA_SOURCES: ChartDataSource[] = [
  // ... existing sources
  {
    id: 'new_sensor_field',
    label: 'New Sensor Name',
    unit: 'unit',
    color: '#hexcolor',
    category: 'appropriate_category',
    enabled: false,
    max_scale: 100 // optional
  }
];
```

### Sensor Data Interface
Ensure corresponding fields exist in `SensorData` interface (`src/types/index.ts`):

```typescript
export interface SensorData {
  // ... existing fields
  new_sensor_field?: number; // Optional for gradual rollout
}
```

### Mock Data Integration
Update mock data generation in `src/utils/mockData.ts`:

```typescript
// In generateMockSensorData function
data.push({
  // ... existing fields
  new_sensor_field: generateRealisticValue(),
});
```

## User Experience

### Default Behavior
- Only "Spindle Speed" is enabled by default
- User selections persist across sessions
- Legend shows enabled count per category
- Chart displays empty state when no sources are selected

### Interaction Flow
1. User sees chart with default data source (Spindle Speed)
2. User clicks legend items to toggle additional sources
3. Chart immediately updates to show/hide selected data
4. Preferences are automatically saved to localStorage
5. Next session restores user's selections

### Visual Indicators
- **Color dots** in legend match chart line colors exactly
- **Checkmark icons** show enabled state clearly
- **Category icons** help identify sensor types
- **Unit labels** provide context for data ranges

## Performance Considerations

### Optimization Techniques
- **Memoized data processing** prevents unnecessary chart re-renders
- **LocalStorage caching** reduces initial load time
- **Conditional rendering** avoids processing disabled sources
- **Empty state handling** prevents chart render errors

### Recommended Limits
- **Maximum 8-10 simultaneous data sources** for optimal performance
- **50 data points maximum** for smooth real-time updates
- **5-second update intervals** balance responsiveness with performance

## Backend Integration

### WebSocket Data Format
The chart expects sensor data in this format:
```typescript
{
  machine_id: string;
  timestamp: string; // ISO format
  
  // Motion data
  spindle_speed: number;
  feed_rate_actual: number;
  
  // Process data  
  spindle_load_percent: number;
  total_power_kw: number;
  temperature: number;
  
  // Vibration data (from ADXL355)
  vibration_spindle_rms?: number;
  vibration_spindle_peak?: number;
  vibration_x_axis_rms?: number;
  vibration_x_axis_peak?: number;
  
  // Temperature data (from DS18B20)
  spindle_bearing_temp?: number;
  motor_temperature?: number;
  
  // Health indicators
  sensor_health?: {
    spindle_vibration: 'online' | 'offline' | 'error';
    x_axis_vibration: 'online' | 'offline' | 'error';
    temperature_sensors: 'online' | 'offline' | 'error';
  };
}
```

### Raspberry Pi Integration
Each Pi device will:
1. **Collect DNC data** via RS-232 from CNC controller
2. **Read sensor data** from ADXL355 (SPI) and DS18B20 (1-Wire)
3. **Combine data streams** into unified WebSocket messages
4. **Send to backend** which relays to dashboard WebSocket

## Troubleshooting

### Common Issues

**Chart not updating after toggle:**
- Check that `enabledDataSources` prop is passed correctly
- Verify data source IDs match `SensorData` field names
- Ensure state updates trigger re-render

**LocalStorage errors:**
- Handle cases where localStorage is disabled/full
- Graceful fallback to default data sources
- Console warnings should not break functionality

**Missing sensor data:**
- Optional fields in `SensorData` handle missing values
- Chart skips null/undefined values automatically
- Tooltip formatting handles non-numeric data safely

**Performance issues:**
- Monitor number of enabled sources (limit to 8-10)
- Check data point count (limit to 50)
- Use React DevTools to identify unnecessary re-renders

## Future Enhancements

### Planned Features
1. **Dual Y-axis support** for vastly different data ranges
2. **Data export functionality** for selected time ranges
3. **Alarm threshold indicators** on chart lines
4. **Historical data overlay** comparing current vs. past performance
5. **Machine-specific data source presets** based on controller type

### Extensibility
The architecture supports:
- **Additional sensor categories** (e.g., 'hydraulic', 'coolant')
- **Custom color schemes** per machine or user preference
- **Data source grouping/filtering** for complex setups
- **Real-time alarm visualization** integrated with chart display

## Testing

### Manual Test Scenarios
1. **Toggle individual sources** - verify immediate chart updates
2. **Select all sources** - confirm performance remains smooth
3. **Disable all sources** - verify empty state displays correctly
4. **Refresh page** - confirm localStorage persistence works
5. **Mobile responsive** - test legend layout on small screens

### Automated Tests
Consider adding:
- Unit tests for data source state management
- Integration tests for localStorage persistence
- Performance tests with maximum data sources
- Visual regression tests for chart rendering

This feature provides a solid foundation for the upcoming sensor integration while maintaining excellent user experience and performance.