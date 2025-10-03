import React from 'react';
import { NCProgram, NCProgramStatus as NCStatus, RaspberryPiStatus } from '../../types';

interface NCProgramStatusProps {
  machineId: string;
  machineName?: string;
  currentProgram?: NCProgram;
  raspberryPiStatus?: RaspberryPiStatus;
  raspberryPiDeviceId?: string;
  onPauseProgram?: (programId: string) => void;
  onStopProgram?: (programId: string) => void;
  compact?: boolean;
}

const NCProgramStatus: React.FC<NCProgramStatusProps> = ({
  currentProgram,
  raspberryPiStatus,
  raspberryPiDeviceId,
  compact = false
}) => {
  const getRaspberryPiStatusColor = () => {
    switch (raspberryPiStatus) {
      case RaspberryPiStatus.CONNECTED:
        return 'text-accent-green-400';
      case RaspberryPiStatus.DISCONNECTED:
        return 'text-accent-red-400';
      case RaspberryPiStatus.ERROR:
        return 'text-accent-red-500';
      default:
        return 'text-dark-400';
    }
  };

  const getRaspberryPiStatusIcon = () => {
    switch (raspberryPiStatus) {
      case RaspberryPiStatus.CONNECTED:
        return '🔗';
      case RaspberryPiStatus.DISCONNECTED:
        return '🔴';
      case RaspberryPiStatus.ERROR:
        return '⚠️';
      default:
        return '⚫';
    }
  };

  const getProgramStatusColor = (status: NCStatus) => {
    switch (status) {
      case NCStatus.RUNNING:
        return 'text-accent-green-400';
      case NCStatus.PAUSED:
        return 'text-accent-orange-400';
      case NCStatus.ERROR:
        return 'text-accent-red-400';
      case NCStatus.COMPLETED:
        return 'text-accent-blue-400';
      default:
        return 'text-dark-400';
    }
  };

  if (compact) {
    return (
      <div className="nc-program-compact mt-2">
        {currentProgram ? (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1">
              <span className={getProgramStatusColor(currentProgram.status)}>📄</span>
              <span className="text-dark-300 truncate max-w-16">
                {currentProgram.name}
              </span>
            </div>
            {currentProgram.progress !== undefined && (
              <div className="text-accent-green-400 font-medium">
                {Math.round(currentProgram.progress)}%
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center text-xs">
            <span className={getRaspberryPiStatusColor()}>
              {getRaspberryPiStatusIcon()} Pi
            </span>
            {raspberryPiDeviceId && (
              <span className="ml-2 text-dark-400 font-mono">
                {raspberryPiDeviceId}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="nc-program-section mt-4 pt-4 border-t border-dark-700">
      {/* Raspberry Pi Status - Read Only */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={getRaspberryPiStatusColor()}>
            {getRaspberryPiStatusIcon()}
          </span>
          <span className={`text-xs font-medium ${getRaspberryPiStatusColor()}`}>
            Raspberry Pi: {raspberryPiStatus || 'Unknown'}
          </span>
          {raspberryPiDeviceId && (
            <span className="ml-3 text-xs text-dark-400">
              Device: <span className="text-dark-200 font-mono">{raspberryPiDeviceId}</span>
            </span>
          )}
        </div>
      </div>

      {/* Current Program - Read Only */}
      {currentProgram ? (
        <div className="bg-dark-700 rounded-lg p-3 border border-dark-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className={getProgramStatusColor(currentProgram.status)}>📄</span>
              <span className="text-sm font-medium text-dark-100">
                {currentProgram.name}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-2 py-1 rounded ${
                currentProgram.status === NCStatus.RUNNING
                  ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400'
                  : currentProgram.status === NCStatus.PAUSED
                  ? 'bg-accent-orange-500 bg-opacity-20 text-accent-orange-400'
                  : currentProgram.status === NCStatus.ERROR
                  ? 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
                  : 'bg-dark-600 text-dark-400'
              }`}>
                {currentProgram.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {currentProgram.progress !== undefined && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-dark-400 mb-1">
                <span>Progress</span>
                <span>{Math.round(currentProgram.progress)}%</span>
              </div>
              <div className="w-full bg-dark-600 rounded-full h-2">
                <div 
                  className="bg-accent-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentProgram.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-dark-400 text-sm py-4">
          {raspberryPiStatus === RaspberryPiStatus.CONNECTED 
            ? 'No active program' 
            : 'Pi must be connected for program management'
          }
        </div>
      )}
    </div>
  );
};

export default NCProgramStatus;
