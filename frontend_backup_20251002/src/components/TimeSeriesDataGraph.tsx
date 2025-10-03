import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { SensorData } from '../types'
import type { ChartDataSource } from '../types/chartDataSources'
import { getDataSourceById } from '../types/chartDataSources'

interface TimeSeriesDataGraphProps {
  data: SensorData[]
  enabledDataSources: ChartDataSource[]
  height?: number
  showLegend?: boolean
}

const TimeSeriesDataGraph = ({ data, enabledDataSources, height = 300, showLegend = true }: TimeSeriesDataGraphProps) => {
  // Transform the data for the chart - memoized for performance
  const chartData = useMemo(() => {
    if (!data || !data.length || !enabledDataSources || !enabledDataSources.length) return [];
    
    return data.map(item => {
      const chartPoint: Record<string, any> = {
        time: new Date(item.timestamp).toLocaleTimeString(),
      };
      
      // Dynamically add enabled data sources
      enabledDataSources.forEach(source => {
        const rawValue = item[source.id as keyof SensorData];
        if (typeof rawValue === 'number') {
          chartPoint[source.id] = rawValue;
        }
      });
      
      return chartPoint;
    });
  }, [data, enabledDataSources])

  // Safe value formatter for tooltips
  const formatValue = (sourceId: string, raw: unknown): string => {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return String(raw ?? '');
    
    const source = enabledDataSources.find(s => s.id === sourceId);
    if (source) {
      return `${n.toFixed(1)} ${source.unit}`;
    }
    
    return n.toFixed(1);
  }

  // Custom tooltip with dark theme
  type TooltipItem = { color?: string; name?: string; value?: number; dataKey?: string };
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 shadow-xl">
          <p className="text-dark-100 font-medium mb-2">{label}</p>
          {payload.map((entry, index: number) => {
            const source = enabledDataSources.find(s => s.id === entry.dataKey);
            return (
              <div key={index} className="flex items-center justify-between mb-1">
                <span 
                  className="text-sm font-medium mr-4"
                  style={{ color: entry.color }}
                >
                  {source?.label || entry.name}:
                </span>
                <span className="text-dark-100 font-semibold">
                  {formatValue(entry.dataKey || '', entry.value)}
                </span>
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  // Early return if no enabled data sources
  if (!enabledDataSources.length) {
    return (
      <div style={{ width: '100%', height }} className="flex items-center justify-center bg-dark-800 rounded-lg">
        <div className="text-center text-dark-400">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium mb-1">Select sensors to view chart</p>
          <p className="text-xs opacity-75">Choose from the options below</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: showLegend ? 60 : 20 }}>
          <defs>
            <linearGradient id="temperatureGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#404040" 
            vertical={false}
          />
          
          <XAxis 
            dataKey="time" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#a3a3a3', fontSize: 12 }}
            interval="preserveStartEnd"
          />
          
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#a3a3a3', fontSize: 12 }}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {showLegend && (
            <Legend 
              wrapperStyle={{ color: '#a3a3a3', fontSize: '14px' }}
              iconType="line"
            />
          )}
          
          {/* Dynamically generated lines based on enabled data sources */}
          {enabledDataSources.map((source, index) => (
            <Line
              key={source.id}
              type="monotone"
              dataKey={source.id}
              stroke={source.color}
              strokeWidth={index === 0 ? 3 : 2} // First line slightly thicker
              dot={false}
              name={source.label}
              strokeDasharray={source.category === 'vibration' ? '5 5' : undefined}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TimeSeriesDataGraph
