
export interface SensorData { timestamp: string; [k: string]: string | number | object | undefined }

export function getWindowedSeries(data: SensorData[], windowSize?: number): SensorData[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  const sorted = new Date(data[0]?.timestamp).getTime() <= new Date(data[data.length - 1]?.timestamp).getTime()
    ? data
    : [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const size = windowSize ?? sorted.length;
  return sorted.slice(-size);
}
