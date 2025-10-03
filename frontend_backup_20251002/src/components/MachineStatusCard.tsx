import React from 'react';
import { Link } from 'react-router-dom';
import { MachineStatus } from '../types';
import type { MachineStatusData } from '../types';
import NCProgramStatus from './nc-programs/NCProgramStatus';

interface MachineStatusCardProps {
  machineStatus: MachineStatusData;
  onClick?: () => void;
  onPauseProgram?: (programId: string) => void;
  onStopProgram?: (programId: string) => void;
}

const MachineStatusCard: React.FC<MachineStatusCardProps> = ({
  machineStatus,
  onPauseProgram,
  onStopProgram
}) => {
  const { machine, latestData, isOnline, lastUpdate, status } = machineStatus;

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


  const formatValue = (value: number, unit: string, decimals: number = 1): string => {
    return `${value.toFixed(decimals)}${unit}`;
  };

  return (
    <Link to={`/machine/${machine.id}`}>
      <div className="bg-dark-800 rounded-xl shadow-lg border border-dark-700 p-6 transition-all duration-200 cursor-pointer hover:shadow-xl hover:border-dark-600 hover:bg-dark-750 group">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status, isOnline)} shadow-lg`}></div>
              <div>
                <h3 className="text-xl font-bold text-dark-100 group-hover:text-accent-green-400 transition-colors">
                  {machine.name}
                </h3>
                <p className="text-sm text-dark-300">{machine.location}</p>
              </div>
            </div>
          <div className="text-right">
            <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
              isOnline 
                ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400' 
                : 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className="text-xs text-dark-400 mt-1">
              {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <div className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium ${
            status === MachineStatus.RUNNING 
              ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400' 
              : status === MachineStatus.MAINTENANCE
              ? 'bg-accent-orange-500 bg-opacity-20 text-accent-orange-400'
              : status === MachineStatus.ERROR
              ? 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
              : 'bg-dark-600 text-dark-300'
          }`}>
            {status}
          </div>
        </div>

        {/* Machine Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-dark-400">Controller:</span>
            <span className="ml-2 font-medium text-dark-200">{machine.controller_type}</span>
          </div>
          <div>
            <span className="text-dark-400">Model:</span>
            <span className="ml-2 font-medium text-dark-200">{machine.model || 'N/A'}</span>
          </div>
        </div>

        {/* Key Metrics - Highlighted */}
        {latestData ? (
          <div className="space-y-4">
            {/* Top Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-dark-700 rounded-lg p-3 text-center border border-dark-600">
                <div className="text-xs text-accent-green-400 font-medium mb-1">SPINDLE</div>
                <div className="text-lg font-bold text-accent-green-300">
                  {formatValue(latestData.spindle_speed, '', 0)}
                </div>
                <div className="text-xs text-dark-400">RPM</div>
              </div>
              <div className="bg-dark-700 rounded-lg p-3 text-center border border-dark-600">
                <div className="text-xs text-accent-orange-400 font-medium mb-1">LOAD</div>
                <div className="text-lg font-bold text-accent-orange-300">
                  {formatValue(latestData.spindle_load_percent, '', 0)}
                </div>
                <div className="text-xs text-dark-400">%</div>
              </div>
              <div className="bg-dark-700 rounded-lg p-3 text-center border border-dark-600">
                <div className="text-xs text-accent-purple-400 font-medium mb-1">POWER</div>
                <div className="text-lg font-bold text-accent-purple-300">
                  {formatValue(latestData.total_power_kw, '', 1)}
                </div>
                <div className="text-xs text-dark-400">kW</div>
              </div>
            </div>

            {/* Temperature & Program */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-dark-400">Temperature:</span>
                <span className={`font-semibold ${
                  latestData.temperature > 80 
                    ? 'text-accent-red-400' 
                    : latestData.temperature > 60 
                    ? 'text-accent-orange-400' 
                    : 'text-accent-green-400'
                }`}>
                  {formatValue(latestData.temperature, '°C', 1)}
                </span>
              </div>
              <div className="text-dark-300">
                Line: {latestData.active_program_line}
              </div>
            </div>

            {/* NC Program Status - Read Only */}
            <NCProgramStatus
              machineId={machine.id}
              machineName={machine.name}
              currentProgram={machine.current_program}
              raspberryPiStatus={machine.raspberry_pi_status}
              raspberryPiDeviceId={machine.raspberry_pi_device_id}
              onPauseProgram={onPauseProgram}
              onStopProgram={onStopProgram}
              compact={false}
            />
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-dark-400 text-sm">
              {isOnline ? 'Waiting for data...' : 'Machine offline'}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default MachineStatusCard;
