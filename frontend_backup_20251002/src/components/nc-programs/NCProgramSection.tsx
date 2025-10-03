import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NCProgram, NCProgramStatus, RaspberryPiStatus } from '../../types';

interface NCProgramSectionProps {
  machineId: string;
  machineName?: string;
  currentProgram?: NCProgram;
  raspberryPiStatus?: RaspberryPiStatus;
  raspberryPiDeviceId?: string;
  onPauseProgram?: (programId: string) => void;
  onStopProgram?: (programId: string) => void;
  compact?: boolean;
}

const NCProgramSection: React.FC<NCProgramSectionProps> = ({
  machineId,
  machineName,
  currentProgram,
  raspberryPiStatus,
  raspberryPiDeviceId,
  onPauseProgram,
  onStopProgram,
  compact = false
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

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

  const getProgramStatusColor = (status: NCProgramStatus) => {
    switch (status) {
      case NCProgramStatus.RUNNING:
        return 'text-accent-green-400';
      case NCProgramStatus.PAUSED:
        return 'text-accent-orange-400';
      case NCProgramStatus.ERROR:
        return 'text-accent-red-400';
      case NCProgramStatus.COMPLETED:
        return 'text-accent-blue-400';
      default:
        return 'text-dark-400';
    }
  };

  const handleSendProgram = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      // Navigate to DNC feeder with machine context
      const searchParams = new URLSearchParams({
        machineId: machineId,
        ...(machineName && { machineName: machineName }),
        ...(raspberryPiDeviceId && { deviceId: raspberryPiDeviceId })
      });
      navigate(`/dnc?${searchParams.toString()}`);
    } finally {
      // Reset loading state after a short delay to avoid flicker
      setTimeout(() => setIsLoading(false), 500);
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
          <div className="flex items-center justify-between text-xs">
            <span className={getRaspberryPiStatusColor()}>
              {getRaspberryPiStatusIcon()} Pi
            </span>
            <button
              onClick={handleSendProgram}
              disabled={isLoading || raspberryPiStatus !== RaspberryPiStatus.CONNECTED}
              className="px-2 py-1 bg-accent-blue-500 bg-opacity-20 text-accent-blue-400 rounded text-xs hover:bg-opacity-30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="nc-program-section">
      {/* Main Control Panel */}
      <div className="bg-dark-700 rounded-xl border border-dark-600 p-4">
        {/* Top Row: Device Name, Program Name, Feed Button */}
        <div className="flex items-center justify-between mb-4">
          {/* Left: Connected Raspberry Pi Device Name */}
          <div className="flex items-center space-x-2">
            {raspberryPiDeviceId ? (
              <>
                <span className={getRaspberryPiStatusColor()}>
                  {getRaspberryPiStatusIcon()}
                </span>
                <span className={`text-sm font-medium ${getRaspberryPiStatusColor()}`}>
                  {raspberryPiDeviceId}
                </span>
              </>
            ) : (
              <span className="text-sm text-dark-400">No device assigned</span>
            )}
          </div>

          {/* Center: Program Name */}
          <div className="flex-1 text-center">
            {currentProgram ? (
              <div className="flex items-center justify-center space-x-2">
                <span className={getProgramStatusColor(currentProgram.status)}>📄</span>
                <span className="text-lg font-medium text-dark-100">{currentProgram.name}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  currentProgram.status === NCProgramStatus.RUNNING
                    ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400'
                    : currentProgram.status === NCProgramStatus.PAUSED
                    ? 'bg-accent-orange-500 bg-opacity-20 text-accent-orange-400'
                    : currentProgram.status === NCProgramStatus.ERROR
                    ? 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
                    : 'bg-dark-600 text-dark-400'
                }`}>
                  {currentProgram.status.toUpperCase()}
                </span>
              </div>
            ) : (
              <span className="text-sm text-dark-400">No program loaded</span>
            )}
          </div>

          {/* Right: Feed Button */}
          <button
            onClick={handleSendProgram}
            disabled={!raspberryPiDeviceId || isLoading}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 bg-accent-blue-500 bg-opacity-20 text-accent-blue-400 border border-accent-blue-500 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-dark-500 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v10a2 2 0 01-2 2z" />
            </svg>
            <span>Feed</span>
          </button>
        </div>

        {/* Progress Bar Section */}
        {currentProgram && currentProgram.progress !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-dark-400">
              <span>Block Transfer Progress</span>
              <span>{Math.round(currentProgram.progress)}%</span>
            </div>
            <div className="w-full bg-dark-600 rounded-full h-3">
              <div 
                className="bg-accent-green-500 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${currentProgram.progress}%` }}
              >
                {currentProgram.progress > 15 && (
                  <span className="text-xs font-medium text-white">{Math.round(currentProgram.progress)}%</span>
                )}
              </div>
            </div>
            <div className="text-xs text-dark-400 text-center">
              Transferring NC blocks via serial to CNC controller
            </div>
          </div>
        )}
        
        {/* Program Controls - Below main panel when program is active */}
        {currentProgram && (currentProgram.status === NCProgramStatus.RUNNING || currentProgram.status === NCProgramStatus.PAUSED) && (
          <div className="flex items-center justify-center space-x-3 mt-4 pt-4 border-t border-dark-600">
            {currentProgram.status === NCProgramStatus.RUNNING && onPauseProgram && (
              <button
                onClick={() => onPauseProgram(currentProgram.id)}
                className="px-4 py-2 bg-accent-orange-500 bg-opacity-20 text-accent-orange-400 rounded-lg text-sm hover:bg-opacity-30 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
                <span>Pause Transfer</span>
              </button>
            )}
            {onStopProgram && (
              <button
                onClick={() => onStopProgram(currentProgram.id)}
                className="px-4 py-2 bg-accent-red-500 bg-opacity-20 text-accent-red-400 rounded-lg text-sm hover:bg-opacity-30 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9V10z" />
                </svg>
                <span>Stop Transfer</span>
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default NCProgramSection;
