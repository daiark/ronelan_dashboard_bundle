import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SensorData } from '../types';
import type { ChartDataSource } from '../types/chartDataSources';
import { AVAILABLE_DATA_SOURCES, groupDataSourcesByCategory, CATEGORY_CONFIG } from '../types/chartDataSources';

interface RealTimeChartProps {
  data: SensorData[];
  title?: string;
  height?: number;
}

import { getWindowedSeries } from '../utils/dataWindow';

const RealTimeChart: React.FC<RealTimeChartProps> = ({
  data,
  title = "Real-Time Machine Data",
  height = 400
}) => {
  // Data source selection state
  const [dataSources, setDataSources] = useState<ChartDataSource[]>(
    AVAILABLE_DATA_SOURCES.map(source => ({ ...source }))
  );
  
  // Toggle data source visibility
  const toggleDataSource = (sourceId: string) => {
    setDataSources(prev => 
      prev.map(source => 
        source.id === sourceId 
          ? { ...source, enabled: !source.enabled }
          : source
      )
    );
  };
  
  // Get enabled data sources for chart rendering
  const enabledDataSources = useMemo(() => 
    dataSources.filter(source => source.enabled), 
    [dataSources]
  );
  // Process data for chart display with enhanced sensor data
  const chartData = useMemo(() => {
    const windowedData = getWindowedSeries(data, 50);
    return windowedData.map((item, index) => ({
        time: new Date(item.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        timestamp: new Date(item.timestamp).getTime(),
        // Existing data
        temperature: item.temperature,
        spindle_speed: item.spindle_speed,
        spindle_load_percent: item.spindle_load_percent,
        total_power_kw: item.total_power_kw,
        feed_rate_actual: item.feed_rate_actual,
        // Enhanced sensor data
        vibration_spindle_rms: item.vibration_spindle_rms,
        vibration_spindle_peak: item.vibration_spindle_peak,
        vibration_x_axis_rms: item.vibration_x_axis_rms,
        vibration_x_axis_peak: item.vibration_x_axis_peak,
        spindle_bearing_temp: item.spindle_bearing_temp,
        motor_temperature: item.motor_temperature,
        index
      }));
  }, [data]);

  // Custom tooltip component
  type TooltipItem = { color?: string; name?: string; value?: number; dataKey?: string };
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800 p-4 border border-dark-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-dark-100 mb-2">{`Time: ${label}`}</p>
          {payload.map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}${getUnit(entry.dataKey)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getUnit = (dataKey?: string): string => {
    if (!dataKey) return '';
    const source = dataSources.find(s => s.id === dataKey);
    return source ? ` ${source.unit}` : '';
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-dark-800 rounded-lg shadow-sm border border-dark-700 p-6">
        <h3 className="text-lg font-semibold text-dark-100 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-dark-400 text-lg mb-2">📊</div>
            <div className="text-dark-300">No data available</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-lg shadow-sm border border-dark-700 p-6">
      <h3 className="text-lg font-semibold text-dark-100 mb-4">{title}</h3>
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            stroke="#64748b"
            fontSize={12}
            interval="preserveStartEnd"
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            stroke="#64748b"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Dynamic Lines based on enabled data sources */}
          {enabledDataSources.map(source => (
            <Line
              key={source.id}
              type="monotone"
              dataKey={source.id}
              stroke={source.color}
              strokeWidth={2}
              dot={{ r: 2, fill: source.color }}
              activeDot={{ r: 4, fill: source.color }}
              name={source.label}
              yAxisId={0}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Interactive Data Source Selector */}
      <div className="mt-4 bg-dark-700 rounded-lg border border-dark-600 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-dark-100">Data Sources</h4>
          <span className="text-xs text-dark-400">
            {enabledDataSources.length} of {dataSources.length} enabled
          </span>
        </div>
        
        {Object.entries(groupDataSourcesByCategory(dataSources)).map(([category, sources]) => (
          <div key={category} className="legend-category mb-4 last:mb-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm">
                {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.icon}
              </span>
              <h5 className="text-xs font-semibold text-dark-300 uppercase tracking-wide">
                {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.name || category}
              </h5>
              <div className="flex-1 h-px bg-dark-600"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sources.map(source => (
                <button
                  key={source.id}
                  onClick={() => toggleDataSource(source.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 text-left ${
                    source.enabled 
                      ? 'bg-opacity-20 text-dark-100 border-l-2 shadow-sm' 
                      : 'bg-dark-800 text-dark-400 hover:text-dark-200 hover:bg-dark-600'
                  }`}
                  style={{ 
                    backgroundColor: source.enabled ? source.color + '20' : undefined,
                    borderLeftColor: source.enabled ? source.color : 'transparent'
                  }}
                  title={`Toggle ${source.label} (${source.unit})`}
                >
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ 
                      backgroundColor: source.color,
                      opacity: source.enabled ? 1 : 0.5
                    }}
                  />
                  <span className="font-medium truncate flex-1">{source.label}</span>
                  <span className="text-dark-500 text-xs flex-shrink-0">
                    {source.unit}
                  </span>
                  {source.enabled && (
                    <div className="w-3 h-3 flex-shrink-0">
                      <svg className="w-full h-full text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        
        {/* Quick Actions */}
        <div className="border-t border-dark-600 pt-3 mt-3">
          <div className="flex justify-between text-xs">
            <button
              onClick={() => {
                dataSources.forEach(source => {
                  if (!source.enabled) toggleDataSource(source.id);
                });
              }}
              className="text-accent-green-400 hover:text-accent-green-300 transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => {
                dataSources.forEach(source => {
                  if (source.enabled && source.id !== 'spindle_speed') {
                    toggleDataSource(source.id);
                  }
                });
              }}
              className="text-accent-red-400 hover:text-accent-red-300 transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeChart;
