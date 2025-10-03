// Chart Data Sources Configuration for Real-time Graph

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
  {
    id: 'spindle_speed',
    label: 'Spindle Speed',
    unit: 'RPM',
    color: '#10B981',
    category: 'motion',
    enabled: true
  },
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
  {
    id: 'temperature',
    label: 'General Temperature',
    unit: '°C',
    color: '#F97316',
    category: 'process',
    enabled: false,
    max_scale: 100
  },
  {
    id: 'vibration_spindle_rms',
    label: 'Spindle Vibration',
    unit: 'm/s²',
    color: '#8B5CF6',
    category: 'vibration',
    enabled: false,
    max_scale: 10
  },
  {
    id: 'spindle_bearing_temp',
    label: 'Bearing Temperature',
    unit: '°C',
    color: '#DC2626',
    category: 'temperature',
    enabled: false,
    max_scale: 100
  }
];

// Helper function to group data sources by category
export const groupDataSourcesByCategory = (sources: ChartDataSource[]) => {
  return sources.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, ChartDataSource[]>);
};

// Helper function to get data source by ID
export const getDataSourceById = (id: string): ChartDataSource | undefined => {
  return AVAILABLE_DATA_SOURCES.find(source => source.id === id);
};

// Helper function to get enabled data sources
export const getEnabledDataSources = (sources: ChartDataSource[]): ChartDataSource[] => {
  return sources.filter(source => source.enabled);
};

// Category display configurations
export const CATEGORY_CONFIG = {
  motion: {
    name: 'Motion',
    icon: '⚡',
    description: 'Machine movement and positioning data'
  },
  process: {
    name: 'Process', 
    icon: '🔧',
    description: 'Machining process parameters'
  },
  vibration: {
    name: 'Vibration',
    icon: '📊',
    description: 'Acceleration and vibration measurements'
  },
  temperature: {
    name: 'Temperature',
    icon: '🌡️', 
    description: 'Temperature monitoring sensors'
  }
} as const;