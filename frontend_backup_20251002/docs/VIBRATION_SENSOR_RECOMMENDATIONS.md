# Vibration Sensor Recommendations for CNC Monitoring

## Executive Summary

Based on the balance between data relevance and implementation ease, this document recommends sensor solutions for CNC machine monitoring integrated with your Raspberry Pi DNC system.

## 🎯 Primary Recommendation: ADXL355 + ESP32 Wireless Network

### Why This Architecture?
- **High Relevance**: Vibration directly indicates cutting conditions, tool wear, spindle health
- **Easy Implementation**: SPI interface, well-documented libraries
- **Scalable**: One Pi can monitor multiple machines via wireless sensor nodes
- **Cost Effective**: ~$30-50 per sensor node including wireless capability

### Technical Specifications
```
Sensor: ADXL355 (Analog Devices)
- Range: ±2g, ±4g, ±8g (selectable)
- Noise: 25 μg/√Hz
- Resolution: 20-bit
- Interface: SPI/I2C
- Temperature Range: -40°C to +125°C

Wireless Platform: ESP32
- WiFi: 802.11 b/g/n
- Processing: Dual-core 240MHz
- Memory: 520KB SRAM
- Power: 3.3V, sleep modes available
- Cost: ~$5-10 per module
```

## 🔧 Implementation Architectures

### Option 1: Direct Pi Connection (Single Machine)
```
┌─────────────┐    SPI    ┌─────────────┐    Ethernet    ┌─────────────┐
│  ADXL355    │◄─────────►│ Raspberry Pi │◄──────────────►│  Backend    │
│  Sensors    │           │ - DNC       │                │  Server     │
│ (4x units)  │           │ - LSV-2     │                │             │
└─────────────┘           │ - Analysis  │                └─────────────┘
                          └─────────────┘
```
**Best for**: Single machine, direct control, lowest latency

### Option 2: Wireless Sensor Network (Multi-Machine)
```
┌─────────────┐    WiFi    ┌─────────────┐    Ethernet    ┌─────────────┐
│ ESP32+ADXL  │───────────►│ Raspberry Pi │◄──────────────►│  Backend    │
│ Node 1-4    │            │   Hub       │                │  Server     │ 
└─────────────┘            │ - DNC       │                │             │
┌─────────────┐    WiFi    │ - LSV-2     │                └─────────────┘
│ ESP32+ADXL  │───────────►│ - MQTT      │
│ Node 5-8    │            │ - Analysis  │
└─────────────┘            └─────────────┘
```
**Best for**: Multiple machines, easy installation, flexible placement

### Option 3: Hybrid Approach (Recommended)
```
Machine 1 (High Priority):
┌─────────────┐    SPI     ┌─────────────┐
│  ADXL355    │◄──────────►│ Pi + DNC    │
│  Direct     │            │ + LSV-2     │
└─────────────┘            └─────────────┘

Machines 2-N (Standard Monitoring):
┌─────────────┐    WiFi    ┌─────────────┐
│ ESP32+ADXL  │───────────►│ Pi Hub      │
│ Wireless    │            │ MQTT Broker │
└─────────────┘            └─────────────┘
```

## 📊 Sensor Placement Strategy

### Critical Locations (Priority Order)
1. **Spindle Housing**: Most direct indication of cutting conditions
2. **X-Axis Linear Guide**: Detects axis wear, alignment issues  
3. **Tool Change Mechanism**: Monitors ATC reliability
4. **Z-Axis (Vertical)**: Indicates tool engagement quality

### Mounting Recommendations
```python
# Sensor placement configuration
sensor_locations = {
    'spindle_front': {
        'position': 'spindle_housing_front',
        'orientation': 'xyz_axes',
        'priority': 1,
        'frequency_range': '0-2000Hz',  # Tool frequencies
        'alert_thresholds': {
            'rms_warning': 2.0,    # m/s²
            'rms_critical': 5.0,   # m/s²
            'peak_critical': 15.0  # m/s²
        }
    },
    
    'x_axis_drive': {
        'position': 'x_axis_motor_coupling',
        'orientation': 'radial',
        'priority': 2,
        'frequency_range': '0-500Hz',   # Mechanical frequencies
        'alert_thresholds': {
            'rms_warning': 1.5,
            'rms_critical': 3.0,
            'peak_critical': 10.0
        }
    }
}
```

## 💾 Data Analysis Strategy

### Real-Time Processing (On Pi)
```python
class VibrationAnalyzer:
    def __init__(self):
        self.sampling_rate = 2048  # Hz
        self.fft_size = 1024
        
    def analyze_vibration(self, raw_data):
        # Time domain analysis
        rms = np.sqrt(np.mean(raw_data**2))
        peak = np.max(np.abs(raw_data))
        crest_factor = peak / rms
        
        # Frequency domain analysis
        fft = np.fft.fft(raw_data, self.fft_size)
        frequencies = np.fft.fftfreq(self.fft_size, 1/self.sampling_rate)
        
        # Tool frequency detection (spindle speed harmonics)
        tool_freq = self.detect_tool_frequency(fft, frequencies)
        
        # Condition assessment
        condition = self.assess_condition(rms, peak, crest_factor, tool_freq)
        
        return {
            'rms': rms,
            'peak': peak,
            'crest_factor': crest_factor,
            'dominant_frequency': tool_freq,
            'condition': condition,  # 'good', 'warning', 'critical'
            'timestamp': datetime.now()
        }
```

### Data Relevance for Machinists
```typescript
// Simplified machinist interface
interface VibrationStatus {
  overall_condition: 'Good' | 'Check Soon' | 'Stop Machine';
  problem_areas: string[];  // ['Spindle', 'X-Axis']
  recommended_action: string;  // 'Continue', 'Inspect tools', 'Call maintenance'
  
  // Optional detail (collapsible)
  technical_details?: {
    rms_levels: Record<string, number>;
    frequency_peaks: Array<{freq: number, amplitude: number}>;
    trend_analysis: 'improving' | 'stable' | 'degrading';
  };
}
```

## 🛠 Implementation Phases

### Phase 1: Single Machine Proof of Concept (2-4 weeks)
- **Hardware**: 2x ADXL355 breakout boards + Pi GPIO connection
- **Locations**: Spindle housing + X-axis
- **Software**: Basic RMS/Peak calculation, simple thresholds
- **UI**: Add vibration status to existing NC program panel

### Phase 2: Wireless Network Expansion (4-6 weeks)  
- **Hardware**: ESP32 + ADXL355 custom boards
- **Network**: MQTT broker on Pi, WiFi sensor nodes
- **Analytics**: FFT analysis, frequency tracking
- **UI**: Dedicated vibration monitoring dashboard

### Phase 3: Advanced Analytics (8-12 weeks)
- **Machine Learning**: Tool wear prediction, chatter detection
- **Integration**: Correlation with LSV-2 data (feed rates, spindle speed)
- **Predictive Maintenance**: Historical trend analysis
- **UI**: Predictive alerts, maintenance scheduling

## 💰 Cost Analysis

### Option 1: Direct Connection (Per Machine)
```
- 4x ADXL355 Breakout Boards: $120
- Wiring & Connectors: $30
- Magnetic Mounts: $40
- Development Time: 40 hours
Total: ~$190 + labor
```

### Option 2: Wireless Network (4 Machines)
```
- 16x ESP32 modules: $160
- 16x ADXL355 sensors: $480  
- Custom PCBs (optional): $200
- Enclosures: $320
- Development Time: 80 hours
Total: ~$1160 + labor
```

### Option 3: Hybrid (1 Direct + 3 Wireless)
```
- Direct machine: $190
- 3x Wireless machines: $870
- Shared development: 60 hours
Total: ~$1060 + labor
```

## 🎯 Alternative Sensor Considerations

### Temperature Sensors (Complementary)
```python
# DS18B20 digital temperature sensors
temperature_locations = {
    'spindle_bearing': 'DS18B20',  # $3 each
    'servo_motors': 'DS18B20',     # Monitor drive heating
    'coolant_temp': 'DS18B20',     # Process monitoring
}
```

### Acoustic Monitoring (Advanced Phase)
```python
# MEMS microphone for tool condition monitoring
acoustic_analysis = {
    'sensor': 'INMP441',  # $5 each
    'frequency_range': '20Hz-20kHz',
    'applications': [
        'cutting_tool_monitoring',
        'chatter_detection',
        'spindle_bearing_analysis'
    ]
}
```

### Current Sensors (Motor Health)
```python
# Non-invasive current transformers
current_monitoring = {
    'sensor': 'SCT-013-030',  # $10 each
    'applications': [
        'spindle_motor_load',
        'axis_drive_current',
        'power_consumption'
    ]
}
```

## 📋 Next Steps Recommendation

1. **Start with Phase 1**: Implement direct ADXL355 connection to one critical machine
2. **Validate Value**: Confirm vibration data correlates with actual cutting conditions
3. **Expand Strategically**: Add wireless nodes to additional machines based on ROI
4. **Integrate with LSV-2**: Combine vibration data with controller position/speed data
5. **Scale Analytics**: Add predictive algorithms as data history accumulates

The vibration sensor approach provides immediate value for tool condition monitoring while building toward comprehensive predictive maintenance capabilities. The modular architecture ensures you can scale based on proven value rather than upfront investment.