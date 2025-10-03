import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMachineStore } from '../store/machineStore';
import { MachineStatus } from '../types';

export type PanelType = 'time-series' | 'circular-charts' | 'production-metrics' | 'temperature-overview';

interface SidebarProps {
  selectedMachineId?: string | null;
  onMachineSelect: (machineId: string | null) => void;
  selectedPanels?: PanelType[];
  onTogglePanel?: (panel: PanelType) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  selectedMachineId, 
  onMachineSelect,
  selectedPanels = [],
  onTogglePanel = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {}
}) => {
  const { machines, machineStatuses } = useMachineStore();
  const navigate = useNavigate();

  const handleAllMachinesClick = () => {
    onMachineSelect(null);
    navigate('/'); // Navigate to dashboard overview
  };

  const handleMachineClick = (machineId: string) => {
    // Navigate to machine detail page instead of selecting
    navigate(`/machine/${machineId}`);
  };

  const panelOptions = [
    {
      id: 'time-series' as PanelType,
      name: 'Time Series Chart',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      description: 'Real-time sensor data'
    },
    {
      id: 'circular-charts' as PanelType,
      name: 'Efficiency Metrics',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
      description: 'Circular progress indicators'
    },
    {
      id: 'production-metrics' as PanelType,
      name: 'Production Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
      description: 'Daily production metrics'
    },
    {
      id: 'temperature-overview' as PanelType,
      name: 'Temperature Monitor',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l3-3 3 3v13a7 7 0 11-6 0z" />
        </svg>
      ),
      description: 'Temperature analytics'
    }
  ];

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

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-72'} bg-dark-800 shadow-xl border-r border-dark-700 flex flex-col transition-all duration-300`}>
      {/* Toggle Button */}
      <div className="p-4 border-b border-dark-700 flex justify-between items-center">
        {!isCollapsed && <h2 className="text-lg font-semibold text-dark-100">Control Panel</h2>}
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-5 h-5 transform transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      {/* Total Machines Summary */}
      <div className="p-4 border-b border-dark-700">
        {isCollapsed ? (
          <div className="flex justify-center" title={`Total Machines: ${machines.length}`}>
            <div className="w-8 h-8 bg-accent-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
              <span className="text-accent-green-400 font-bold text-sm">{machines.length}</span>
            </div>
          </div>
        ) : (
          <div className="bg-dark-700 rounded-lg border border-dark-600 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-accent-green-400 text-sm font-medium mb-1">TOTAL MACHINES</p>
                <p className="text-2xl font-bold text-accent-green-300">{machines.length}</p>
              </div>
              <div className="w-10 h-10 bg-accent-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* DNC Feeder Section */}
      <div className="p-4 border-b border-dark-700">
        <button 
          onClick={() => navigate('/dnc')}
          className="w-full bg-dark-700 rounded-lg border border-dark-600 p-3 hover:bg-dark-600 transition-colors group text-left"
          title={isCollapsed ? 'DNC Feeder Tool' : undefined}
        >
          {isCollapsed ? (
            <div className="flex justify-center">
              <div className="w-6 h-6 bg-accent-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center group-hover:bg-opacity-30">
                <svg className="w-4 h-4 text-accent-blue-400 group-hover:text-accent-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v10a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-accent-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center group-hover:bg-opacity-30">
                  <svg className="w-4 h-4 text-accent-blue-400 group-hover:text-accent-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v10a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-accent-blue-400 text-sm font-medium group-hover:text-accent-blue-300">DNC FEEDER</p>
                  <p className="text-xs text-dark-300 group-hover:text-white">Access Tool</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-dark-400 group-hover:text-accent-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </button>
      </div>
      
      {/* Machines Section */}
      <div className="flex-1">
        <nav className={`p-4 space-y-2 max-h-80 overflow-y-auto scrollbar-thin`}>
          {/* All Machines Option */}
          <button
            onClick={handleAllMachinesClick}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              !selectedMachineId
                ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400 border-l-4 border-accent-green-500'
                : 'text-dark-300 hover:bg-dark-700'
            }`}
            title={isCollapsed ? 'Dashboard Overview' : undefined}
          >
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <div className="w-2 h-2 bg-accent-green-500 rounded-full"></div>
              {!isCollapsed && <span className="font-medium text-sm">Dashboard Overview</span>}
            </div>
          </button>

          {/* Individual Machines */}
          {machines.map((machine) => {
            const status = machineStatuses[machine.id];
            const isOnline = status?.isOnline || false;
            
            return (
              <button
                key={machine.id}
                onClick={() => handleMachineClick(machine.id)}
                className="w-full text-left px-3 py-2 rounded-lg transition-colors text-dark-300 hover:bg-dark-700 hover:text-accent-green-400"
                title={isCollapsed ? `${machine.name} (${machine.location})` : undefined}
              >
                {isCollapsed ? (
                  <div className="flex justify-center">
                    <div className={`w-3 h-3 rounded-full ${
                      getStatusColor(status?.status || MachineStatus.IDLE, isOnline)
                    }`}></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        getStatusColor(status?.status || MachineStatus.IDLE, isOnline)
                      }`}></div>
                      <div>
                        <span className="font-medium text-sm">{machine.name}</span>
                        <div className="text-xs text-dark-500 mt-0.5">
                          {machine.location}
                        </div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      status?.status === MachineStatus.RUNNING
                        ? 'bg-accent-green-500 bg-opacity-20 text-accent-green-400' 
                        : status?.status === MachineStatus.MAINTENANCE
                        ? 'bg-accent-orange-500 bg-opacity-20 text-accent-orange-400'
                        : status?.status === MachineStatus.ERROR
                        ? 'bg-accent-red-500 bg-opacity-20 text-accent-red-400'
                        : 'bg-dark-600 text-dark-400'
                    }`}>
                      {status?.status || 'IDLE'}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
        
        {!isCollapsed && (
          <div className="p-4 border-t border-dark-700">
            <div className="text-xs text-dark-400">
              <div className="flex items-center justify-between mb-2">
                <span>Online Status</span>
                <span className="font-medium text-dark-200">
                  {Object.values(machineStatuses).filter(s => s.isOnline).length}/{machines.length}
                </span>
              </div>
              <div className="w-full bg-dark-600 rounded-full h-2">
                <div 
                  className="bg-accent-green-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${machines.length > 0 
                      ? (Object.values(machineStatuses).filter(s => s.isOnline).length / machines.length) * 100 
                      : 0}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel Selection Section */}
      <div className="border-t-2 border-dark-700">
        {!isCollapsed && (
          <div className="p-6 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-dark-100 mb-1">Display Panels</h2>
            <p className="text-xs text-dark-400">Choose data to display</p>
          </div>
        )}
        
        <nav className="p-4 space-y-2">
          {panelOptions.map((option) => {
            const isSelected = selectedPanels.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => onTogglePanel(option.id)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-accent-purple-500 bg-opacity-20 text-accent-purple-400 border-l-4 border-accent-purple-500'
                    : 'text-dark-300 hover:bg-dark-700'
                }`}
                title={isCollapsed ? option.name : undefined}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                  <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                    <div className={`${
                      isSelected ? 'text-accent-purple-400' : 'text-dark-400'
                    }`}>
                      {option.icon}
                    </div>
                    {!isCollapsed && (
                      <div>
                        <span className="font-medium text-sm">{option.name}</span>
                        <div className="text-xs text-dark-500 mt-0.5">
                          {option.description}
                        </div>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'border-accent-purple-400 bg-accent-purple-500' 
                        : 'border-dark-500'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
};

export default Sidebar;
