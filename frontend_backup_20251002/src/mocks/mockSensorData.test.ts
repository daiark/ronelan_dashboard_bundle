
import { describe, it, expect } from 'vitest';
import { generateMockSensorData } from '../utils/mockData';

describe('generateMockSensorData', () => {
  it('emits all required fields with plausible values', () => {
    const data = generateMockSensorData('CNC-001', 5);
    let prev = 0;
    for (const d of data) {
      expect(typeof d.timestamp).toBe('string');
      const timestamp = new Date(d.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(prev);
      prev = timestamp;

      for (const k of ['vibration_spindle_rms', 'vibration_spindle_peak', 'vibration_x_axis_rms', 'vibration_x_axis_peak', 'spindle_bearing_temp', 'motor_temperature']) {
        expect(typeof (d as SensorData)[k as keyof SensorData]).toBe('number');
      }
    }
  });
});
