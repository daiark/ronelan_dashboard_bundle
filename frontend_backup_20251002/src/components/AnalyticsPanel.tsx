import React from 'react';
import { useMachineStore } from '../store/machineStore';
import { MachineStatus } from '../types';

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
  size = 120 
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${percentage * circumference / 100} ${circumference}`;

  return (
    <div className="flex flex-col items-center justify-center p-4">
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
          <div className="text-2xl font-bold text-dark-100">
            {value.toFixed(0)}
          </div>
          <div className="text-sm text-dark-400">
            {unit}
          </div>
        </div>
      </div>
      
      {/* Label */}
      <div className="text-sm font-medium text-dark-200 mt-2 text-center">
        {label}
      </div>
    </div>
  );
};

interface ProductionOrderProps {
  orderId: string;
  completed: number;
  total: number;
  status: 'active' | 'completed' | 'paused';
}

const ProductionOrder: React.FC<ProductionOrderProps> = ({ orderId, completed, total, status }) => {
  const percentage = (completed / total) * 100;
  
  const statusColors = {
    active: 'bg-accent-green-500',
    completed: 'bg-accent-green-600',
    paused: 'bg-accent-orange-500'
  };

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-dark-100">Order {orderId}</div>
          <div className="text-xs text-dark-400 capitalize">{status}</div>
        </div>
        <div className={`w-3 h-3 rounded-full ${statusColors[status]}`}></div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-dark-300">Progress</span>
          <span className="text-dark-100 font-medium">{completed}/{total}</span>
        </div>
        
        <div className="w-full bg-dark-600 rounded-full h-2">
          <div 
            className="bg-accent-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        
        <div className="text-xs text-dark-400">
          {percentage.toFixed(1)}% Complete
        </div>
      </div>
    </div>
  );
};

const AnalyticsPanel: React.FC = () => {
  const { machines, machineStatuses } = useMachineStore();

  // Calculate analytics
  const totalMachines = machines.length;
  const runningCount = Object.values(machineStatuses).filter(s => s.status === MachineStatus.RUNNING).length;
  const onlineCount = Object.values(machineStatuses).filter(s => s.isOnline).length;
  
  // Calculate overall efficiency (mock calculation)
  const overallEfficiency = totalMachines > 0 ? (runningCount / totalMachines) * 100 : 0;
  
  // Calculate average utilization (mock)
  const avgUtilization = Object.values(machineStatuses)
    .filter(s => s.latestData)
    .reduce((sum, s) => sum + (s.latestData?.spindle_load_percent || 0), 0) / onlineCount || 0;

  // Mock production data
  const totalProduction = 847;
  const targetProduction = 1000;
  
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl h-full">
      {/* Header */}
      <div className="p-6 border-b border-dark-700">
        <h2 className="text-xl font-semibold text-dark-100">Production Analytics</h2>
        <p className="text-sm text-dark-400 mt-1">Real-time performance metrics</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Circular Progress Indicators */}
        <div className="grid grid-cols-2 gap-4">
          <CircularProgress
            value={overallEfficiency}
            max={100}
            label="Overall Efficiency"
            unit="%"
            color="#10b981"
          />
          
          <CircularProgress
            value={avgUtilization}
            max={100}
            label="Avg Utilization"
            unit="%"
            color="#f59e0b"
          />
        </div>

        {/* Production Progress */}
        <div className="space-y-4">
          <div className="bg-dark-700 rounded-lg p-4 border border-dark-600">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-dark-100">Daily Production</div>
              <div className="text-xs text-accent-green-400 bg-accent-green-500 bg-opacity-20 px-2 py-1 rounded">
                Active
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold text-dark-100">{totalProduction}</span>
                <span className="text-sm text-dark-400">/ {targetProduction} parts</span>
              </div>
              
              <div className="w-full bg-dark-600 rounded-full h-3">
                <div 
                  className="bg-accent-green-500 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${(totalProduction / targetProduction) * 100}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-xs text-dark-400">
                <span>{((totalProduction / targetProduction) * 100).toFixed(1)}% of target</span>
                <span>ETA: 2h 15m</span>
              </div>
            </div>
          </div>

          {/* Active Production Orders */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-dark-200">Active Orders</h3>
            
            <ProductionOrder
              orderId="PO-2024-001"
              completed={245}
              total={300}
              status="active"
            />
            
            <ProductionOrder
              orderId="PO-2024-002"
              completed={602}
              total={700}
              status="active"
            />
            
            <ProductionOrder
              orderId="PO-2024-003"
              completed={150}
              total={150}
              status="completed"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600">
            <div className="text-xs text-dark-400">Uptime</div>
            <div className="text-lg font-bold text-accent-green-400">98.5%</div>
          </div>
          
          <div className="bg-dark-700 rounded-lg p-3 border border-dark-600">
            <div className="text-xs text-dark-400">Quality</div>
            <div className="text-lg font-bold text-accent-green-400">99.2%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
