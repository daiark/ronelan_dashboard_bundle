import React from 'react';
import { useMachineStore } from '../../store/machineStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TemperatureOverviewPanel: React.FC = () => {
  const { machineStatuses, sensorData } = useMachineStore();

  // Get temperature data for all machines
  const getTemperatureData = () => {
    const combinedData = Object.values(sensorData).flat();
    
    // Group by timestamp and calculate average temperature
    type Bucket = { time: string; temperatures: number[]; count: number };
    const groupedData = combinedData.reduce((acc: Record<string, Bucket>, item) => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      if (!acc[time]) {
        acc[time] = { time, temperatures: [], count: 0 };
      }
      acc[time].temperatures.push(item.temperature);
      acc[time].count++;
      return acc;
    }, {} as Record<string, Bucket>);

    return Object.values(groupedData)
      .map((item) => ({
        time: item.time,
        avgTemp: item.temperatures.reduce((sum: number, temp: number) => sum + temp, 0) / item.count,
        maxTemp: Math.max(...item.temperatures),
        minTemp: Math.min(...item.temperatures)
      }))
      .slice(-20);
  };

  // Calculate temperature statistics
  const getTemperatureStats = () => {
    const onlineStatuses = Object.values(machineStatuses).filter(s => s.isOnline && s.latestData);
    
    if (onlineStatuses.length === 0) {
      return { avg: 0, max: 0, min: 0, critical: 0 };
    }

    const temperatures = onlineStatuses.map(s => s.latestData!.temperature);
    const avg = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    const max = Math.max(...temperatures);
    const min = Math.min(...temperatures);
    const critical = temperatures.filter(temp => temp > 80).length;

    return { avg, max, min, critical };
  };

  const temperatureData = getTemperatureData();
  const stats = getTemperatureStats();

  // Custom tooltip
  type TooltipItem = { color?: string; name?: string; value?: number };
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 shadow-xl">
          <p className="text-dark-100 font-medium mb-2">{label}</p>
          {payload.map((entry, index: number) => (
            <div key={index} className="flex items-center justify-between mb-1">
              <span 
                className="text-sm font-medium mr-4"
                style={{ color: entry.color }}
              >
                {entry.name}:
              </span>
              <span className="text-dark-100 font-semibold">
                {entry.value?.toFixed(1)}°C
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-dark-100">Temperature Monitor</h3>
        <div className={`text-xs px-2 py-1 rounded font-medium ${
          stats.critical > 0 
            ? 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
            : stats.avg > 70 
            ? 'bg-accent-orange-500 bg-opacity-20 text-accent-orange-400'
            : 'bg-accent-green-500 bg-opacity-20 text-accent-green-400'
        }`}>
          {stats.critical > 0 ? 'Critical' : stats.avg > 70 ? 'Warning' : 'Normal'}
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-auto">
        {/* Temperature Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600 text-center">
            <div className="text-xs text-dark-400 mb-1">Average</div>
            <div className={`text-lg font-bold ${
              stats.avg > 80 ? 'text-accent-red-400' : 
              stats.avg > 60 ? 'text-accent-orange-400' : 'text-accent-green-400'
            }`}>
              {stats.avg.toFixed(1)}°C
            </div>
          </div>

          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600 text-center">
            <div className="text-xs text-dark-400 mb-1">Maximum</div>
            <div className={`text-lg font-bold ${
              stats.max > 80 ? 'text-accent-red-400' : 
              stats.max > 60 ? 'text-accent-orange-400' : 'text-accent-green-400'
            }`}>
              {stats.max.toFixed(1)}°C
            </div>
          </div>

          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600 text-center">
            <div className="text-xs text-dark-400 mb-1">Minimum</div>
            <div className="text-lg font-bold text-accent-green-400">
              {stats.min.toFixed(1)}°C
            </div>
          </div>

          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600 text-center">
            <div className="text-xs text-dark-400 mb-1">Critical</div>
            <div className={`text-lg font-bold ${
              stats.critical > 0 ? 'text-accent-red-400' : 'text-accent-green-400'
            }`}>
              {stats.critical}
            </div>
          </div>
        </div>

        {/* Temperature Chart */}
        <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-dark-100 mb-1">Temperature Trend</h4>
            <p className="text-xs text-dark-400">Average temperature across all machines</p>
          </div>
          
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={temperatureData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a3a3a3', fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a3a3a3', fontSize: 10 }}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip content={<CustomTooltip />} />
                
                <Line
                  type="monotone"
                  dataKey="avgTemp"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Average Temp"
                />
                <Line
                  type="monotone"
                  dataKey="maxTemp"
                  stroke="#ef4444"
                  strokeWidth={1}
                  dot={false}
                  name="Max Temp"
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotone"
                  dataKey="minTemp"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dot={false}
                  name="Min Temp"
                  strokeDasharray="3 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Critical Alerts */}
        {stats.critical > 0 && (
          <div className="bg-accent-red-500 bg-opacity-10 border border-accent-red-500 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-accent-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-accent-red-300">
                  Critical Temperature Alert
                </div>
                <div className="text-xs text-accent-red-400 mt-1">
                  {stats.critical} machine{stats.critical > 1 ? 's' : ''} above 80°C
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemperatureOverviewPanel;
