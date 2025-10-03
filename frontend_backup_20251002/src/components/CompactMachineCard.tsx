import React from 'react';
import { Link } from 'react-router-dom';
import { MachineStatus } from '../types';
import type { MachineStatusData } from '../types';
import NCProgramStatus from './nc-programs/NCProgramStatus';

interface CompactMachineCardProps {
  machineStatus: MachineStatusData;
  onPauseProgram?: (programId: string) => void;
  onStopProgram?: (programId: string) => void;
}

const CompactMachineCard: React.FC<CompactMachineCardProps> = ({
  machineStatus,
  onPauseProgram,
  onStopProgram
}) => {
  const { machine, latestData, isOnline, status } = machineStatus;

  const getStatusColor = (status: MachineStatus, isOnline: boolean) => {
    if (!isOnline) return 'bg-accent-red-500';
    
    switch (status) {
      case MachineStatus.RUNNING:
        return 'bg-accent-green-500';
      case MachineStatus.MAINTENANCE:
        return 'bg-accent-orange-500';
      case MachineStatus.ERROR:
        return 'bg-accent-red-500';
      case MachineStatus.IDLE:
      default:
        return 'bg-dark-400';
    }
  };


  const formatValue = (value: number, decimals: number = 0): string => {
    return value.toFixed(decimals);
  };

  return (
    <Link to={`/machine/${machine.id}`}>
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-3 transition-all duration-200 cursor-pointer hover:shadow-lg hover:border-dark-600 hover:bg-dark-750 group h-full">
        {/* Header with Status */}
        <div className="flex items-center justify-between mb-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status, isOnline)} shadow-sm`}></div>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            status === MachineStatus.RUNNING 
              ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400' 
              : status === MachineStatus.MAINTENANCE
              ? 'bg-accent-orange-500 bg-opacity-20 text-accent-orange-400'
              : status === MachineStatus.ERROR
              ? 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
              : 'bg-dark-600 text-dark-400'
          }`}>
            {isOnline ? (status || 'IDLE') : 'OFF'}
          </div>
        </div>

        {/* Machine Name */}
        <div className="mb-2">
          <h4 className="text-sm font-semibold text-dark-100 group-hover:text-accent-green-400 transition-colors truncate">
            {machine.name}
          </h4>
          <p className="text-xs text-dark-400 truncate">{machine.location}</p>
        </div>

        {/* Key Metrics */}
        {latestData && isOnline ? (
          <div className="space-y-1">
            {/* Spindle Speed */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">RPM:</span>
              <span className="font-medium text-accent-green-300">
                {formatValue(latestData.spindle_speed)}
              </span>
            </div>
            
            {/* Load */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">Load:</span>
              <span className="font-medium text-accent-orange-300">
                {formatValue(latestData.spindle_load_percent)}%
              </span>
            </div>

            {/* Temperature with color coding */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">Temp:</span>
              <span className={`font-medium ${
                latestData.temperature > 80 
                  ? 'text-accent-red-400' 
                  : latestData.temperature > 60 
                  ? 'text-accent-orange-400' 
                  : 'text-accent-green-400'
              }`}>
                {formatValue(latestData.temperature, 1)}°C
              </span>
            </div>

            {/* Power */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-400">Power:</span>
              <span className="font-medium text-accent-purple-300">
                {formatValue(latestData.total_power_kw, 1)}kW
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <span className="text-xs text-dark-500">
              {isOnline ? 'No data' : 'Offline'}
            </span>
          </div>
        )}

        {/* NC Program Status - Compact Read Only */}
        <NCProgramStatus
          machineId={machine.id}
          machineName={machine.name}
          currentProgram={machine.current_program}
          raspberryPiStatus={machine.raspberry_pi_status}
          raspberryPiDeviceId={machine.raspberry_pi_device_id}
          onPauseProgram={onPauseProgram}
          onStopProgram={onStopProgram}
          compact={true}
        />

      </div>
    </Link>
  );
};

export default CompactMachineCard;
