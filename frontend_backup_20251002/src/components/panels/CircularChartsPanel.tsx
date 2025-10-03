import React from 'react';
import { useMachineStore } from '../../store/machineStore';
import { MachineStatus } from '../../types';

interface CircularProgressProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ 
  value, 
  max, 
  label, 
  unit, 
  color, 
  size = 100 
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${percentage * circumference / 100} ${circumference}`;

  return (
    <div className="flex flex-col items-center justify-center p-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-dark-600"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold text-dark-100">
            {value.toFixed(0)}
          </div>
          <div className="text-xs text-dark-400">
            {unit}
          </div>
        </div>
      </div>
      
      {/* Label */}
      <div className="text-xs font-medium text-dark-200 mt-2 text-center">
        {label}
      </div>
    </div>
  );
};

const CircularChartsPanel: React.FC = () => {
  const { machines, machineStatuses } = useMachineStore();

  // Calculate analytics
  const totalMachines = machines.length;
  const runningCount = Object.values(machineStatuses).filter(s => s.status === MachineStatus.RUNNING).length;
  const onlineCount = Object.values(machineStatuses).filter(s => s.isOnline).length;
  
  // Calculate overall efficiency
  const overallEfficiency = totalMachines > 0 ? (runningCount / totalMachines) * 100 : 0;
  
  // Calculate average utilization
  const avgUtilization = Object.values(machineStatuses)
    .filter(s => s.latestData)
    .reduce((sum, s) => sum + (s.latestData?.spindle_load_percent || 0), 0) / onlineCount || 0;

  // Calculate average temperature
  const avgTemperature = Object.values(machineStatuses)
    .filter(s => s.latestData)
    .reduce((sum, s) => sum + (s.latestData?.temperature || 0), 0) / onlineCount || 0;

  // Calculate average power usage
  const avgPower = Object.values(machineStatuses)
    .filter(s => s.latestData)
    .reduce((sum, s) => sum + (s.latestData?.total_power_kw || 0), 0) / onlineCount || 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-dark-100">Performance Metrics</h3>
        <div className="text-xs text-accent-green-400 bg-accent-green-500 bg-opacity-20 px-2 py-1 rounded">
          Real-time
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-2 gap-4 content-start">
        <CircularProgress
          value={overallEfficiency}
          max={100}
          label="Overall Efficiency"
          unit="%"
          color="#10b981"
          size={80}
        />
        
        <CircularProgress
          value={avgUtilization}
          max={100}
          label="Avg Utilization"
          unit="%"
          color="#f59e0b"
          size={80}
        />
        
        <CircularProgress
          value={avgTemperature}
          max={100}
          label="Avg Temperature"
          unit="°C"
          color="#ef4444"
          size={80}
        />
        
        <CircularProgress
          value={avgPower}
          max={50}
          label="Avg Power"
          unit="kW"
          color="#a855f7"
          size={80}
        />
      </div>
    </div>
  );
};

export default CircularChartsPanel;
