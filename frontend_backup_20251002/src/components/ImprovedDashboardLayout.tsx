import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import MachineStatusCard from './MachineStatusCard';
import CompactMachineCard from './CompactMachineCard';
import TimeSeriesPanel from './panels/TimeSeriesPanel';
import CircularChartsPanel from './panels/CircularChartsPanel';
import ProductionMetricsPanel from './panels/ProductionMetricsPanel';
import TemperatureOverviewPanel from './panels/TemperatureOverviewPanel';
import ResizableLayout from './ResizableLayout';
import ResizablePanel from './ResizablePanel';
import { MachineStatus, RaspberryPiStatus } from '../types';
import type { Machine, MachineStatusData } from '../types';
import type { PanelType } from './Sidebar';
import AddMachineModal from './modals/AddMachineModal';

interface ImprovedDashboardLayoutProps {
  machines: Machine[];
  machineStatuses: Record<string, MachineStatusData>;
  selectedPanels: PanelType[];
  onTogglePanel: (panel: PanelType) => void;
}

const ImprovedDashboardLayout: React.FC<ImprovedDashboardLayoutProps> = ({ 
  machines, 
  machineStatuses,
  selectedPanels,
  onTogglePanel 
}) => {
  const [isCompactView, setIsCompactView] = useState(false);
  const [gridCols, setGridCols] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Machine management modal
  const [showAddModal, setShowAddModal] = useState(false);

  // NC Program handlers (TODO: Connect to actual store)
  const handlePauseProgram = async (programId: string) => {
    console.log('Pause program:', programId);
    // TODO: Implement actual program pausing logic
  };

  const handleStopProgram = async (programId: string) => {
    console.log('Stop program:', programId);
    // TODO: Implement actual program stopping logic
  };


  // Calculate optimal grid columns based on container width
  const calculateGridColumns = useCallback(() => {
    if (!containerRef.current || !isCompactView) {
      setGridCols(1);
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const minCardWidth = 160; // Minimum card width in pixels
    const gap = 12; // Gap between cards in pixels
    const padding = 48; // Container padding (24px * 2)
    
    const availableWidth = containerWidth - padding;
    const maxColumns = Math.floor((availableWidth + gap) / (minCardWidth + gap));
    
    const columns = Math.max(1, Math.min(maxColumns, 8));
    setGridCols(columns);
  }, [isCompactView]);

  // Update grid on resize and view change
  useEffect(() => {
    calculateGridColumns();
    
    const resizeObserver = new ResizeObserver(calculateGridColumns);

    if (containerRef.current) {
      // Observe the container itself
      resizeObserver.observe(containerRef.current);
      // Also observe the parent (the ResizableLayout panel)
      const parent = containerRef.current.parentElement;
      if (parent) {
        resizeObserver.observe(parent);
      }
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isCompactView]);

  const runningCount = Object.values(machineStatuses).filter(s => 
    s.status === MachineStatus.RUNNING
  ).length;
  
  
  const maintenanceCount = Object.values(machineStatuses).filter(s => 
    s.status === MachineStatus.MAINTENANCE
  ).length;
  
  const errorCount = Object.values(machineStatuses).filter(s => 
    s.status === MachineStatus.ERROR
  ).length;
  

  // Mock Raspberry Pi status for testing - consistent with device assignment
  const getMockRaspberryPiStatus = (machine: Machine) => {
    // Only show connected if machine has a device assigned
    return machine.raspberry_pi_device_id ? RaspberryPiStatus.CONNECTED : RaspberryPiStatus.DISCONNECTED;
  };

  // Render panel based on type
  const renderPanel = (panelType: PanelType) => {
    switch (panelType) {
      case 'time-series':
        return <TimeSeriesPanel />;
      case 'circular-charts':
        return <CircularChartsPanel />;
      case 'production-metrics':
        return <ProductionMetricsPanel />;
      case 'temperature-overview':
        return <TemperatureOverviewPanel />;
      default:
        return null;
    }
  };

  // Panel configuration with names, icons, and optimal sizing
  const panelConfig = {
    'time-series': { 
      name: 'Time Series Chart', 
      icon: '📈',
      defaultHeight: 350,
      minHeight: 250,
      maxHeight: 600
    },
    'circular-charts': { 
      name: 'Efficiency Metrics', 
      icon: '📊',
      defaultHeight: 300,
      minHeight: 200,
      maxHeight: 450
    },
    'production-metrics': { 
      name: 'Production Overview', 
      icon: '🏭',
      defaultHeight: 650,
      minHeight: 450,
      maxHeight: 1200
    },
    'temperature-overview': { 
      name: 'Temperature Monitor', 
      icon: '🌡️',
      defaultHeight: 450,
      minHeight: 300,
      maxHeight: 700
    }
  };

  return (
    <div className="space-y-6">

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-green-400 text-sm font-medium mb-1">RUNNING</p>
              <p className="text-3xl font-bold text-accent-green-300">{runningCount}</p>
            </div>
            <div className="w-12 h-12 bg-accent-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-orange-400 text-sm font-medium mb-1">MAINTENANCE</p>
              <p className="text-3xl font-bold text-accent-orange-300">{maintenanceCount}</p>
            </div>
            <div className="w-12 h-12 bg-accent-orange-500 bg-opacity-20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-red-400 text-sm font-medium mb-1">ERRORS</p>
              <p className="text-3xl font-bold text-accent-red-300">{errorCount}</p>
            </div>
            <div className="w-12 h-12 bg-accent-red-500 bg-opacity-20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-dark-800 rounded-xl border border-dark-700 p-6 hover:border-accent-green-500 hover:bg-dark-750 transition-all duration-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-accent-green-400 text-sm font-medium mb-1 group-hover:text-accent-green-300">ADD MACHINE</p>
              <p className="text-sm text-dark-300 group-hover:text-dark-200">Create new machine</p>
            </div>
            <div className="w-12 h-12 bg-accent-green-500 bg-opacity-20 rounded-lg flex items-center justify-center group-hover:bg-opacity-30">
              <svg className="w-6 h-6 text-accent-green-400 group-hover:text-accent-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* Main Content Area with Resizable Layout */}
      <ResizableLayout
        hasRightPanel={selectedPanels.length > 0}
        leftPanel={
          <div className="h-full p-6 space-y-6" ref={containerRef}>
            <div>
              {/* Layout Toggle Button */}
              <div className="flex justify-start mb-4">
                <button
                  onClick={() => setIsCompactView(!isCompactView)}
                  className="flex items-center space-x-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg transition-colors group"
                  title={isCompactView ? 'Switch to detailed view' : 'Switch to compact view'}
                >
                  {isCompactView ? (
                    <>
                      <svg className="w-4 h-4 text-dark-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span className="text-xs text-dark-300 group-hover:text-white">Detailed</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-dark-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span className="text-xs text-dark-300 group-hover:text-white">Compact</span>
                    </>
                  )}
                </button>
              </div>
              
              <div 
                className={`grid gap-3 overflow-auto max-h-full ${
                  isCompactView ? '' : 'gap-4'
                }`}
                style={{
                  gridTemplateColumns: isCompactView 
                    ? `repeat(${gridCols}, minmax(0, 1fr))`
                    : '1fr'
                }}
              >
                {machines.map((machine) => {
                  const status = machineStatuses[machine.id];
                  if (!status) return null;

                  // Add mock Raspberry Pi status for testing - consistent with device assignment
                  const enhancedStatus = {
                    ...status,
                    machine: {
                      ...status.machine,
                      raspberry_pi_status: getMockRaspberryPiStatus(status.machine)
                    }
                  };

                  return (
                    <Suspense key={machine.id} fallback={
                      <div className={`bg-dark-800 rounded-xl border border-dark-700 ${
                        isCompactView ? 'p-3 h-32' : 'p-6'
                      }`}>
                        <div className="animate-pulse flex space-x-4">
                          <div className={`rounded-full bg-dark-600 ${
                            isCompactView ? 'h-6 w-6' : 'h-12 w-12'
                          }`}></div>
                          <div className="flex-1 space-y-2 py-1">
                            <div className={`h-4 bg-dark-600 rounded ${
                              isCompactView ? 'w-full' : 'w-3/4'
                            }`}></div>
                            {!isCompactView && (
                              <div className="h-4 bg-dark-600 rounded w-1/2"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    }>
                      {isCompactView ? (
                        <CompactMachineCard
                          machineStatus={enhancedStatus}
                          onPauseProgram={handlePauseProgram}
                          onStopProgram={handleStopProgram}
                        />
                      ) : (
                        <MachineStatusCard
                          machineStatus={enhancedStatus}
                          onPauseProgram={handlePauseProgram}
                          onStopProgram={handleStopProgram}
                        />
                      )}
                    </Suspense>
                  );
                })}
              </div>
            </div>
          </div>
        }
        rightPanel={
          <div className="h-full p-6 overflow-auto">
            <div>
              {selectedPanels.map((panelType) => {
                const config = panelConfig[panelType];
                return (
                  <ResizablePanel
                    key={panelType}
                    title={config.name}
                    onRemove={() => onTogglePanel(panelType)}
                    defaultHeight={config.defaultHeight}
                    minHeight={config.minHeight}
                    maxHeight={config.maxHeight}
                    autoHeight={true}
                  >
                    <Suspense fallback={
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-green-500"></div>
                      </div>
                    }>
                      {renderPanel(panelType)}
                    </Suspense>
                  </ResizablePanel>
                );
              })}
            </div>
          </div>
        }
      />
      
      {/* Add Machine Modal */}
      <AddMachineModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};

export default ImprovedDashboardLayout;
