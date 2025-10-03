import React, { useEffect, useState } from 'react';
import { useMachineStore } from '../store/machineStore';
import Header from '../components/Header';
import Sidebar, { type PanelType } from '../components/Sidebar';
import ImprovedDashboardLayout from '../components/ImprovedDashboardLayout';


const DashboardPage: React.FC = () => {
  const [selectedPanels, setSelectedPanels] = useState<PanelType[]>(['time-series']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const {
    machines,
    machineStatuses,
    isLoading,
    error,
    fetchMachines,
    clearError
  } = useMachineStore();

  // Setup WebSocket for real-time data (temporarily disabled)
  // useWebSocket({
  //   machineId: undefined, // Connect to all machines
  //   reconnectInterval: 5000,
  //   maxReconnectAttempts: 10
  // });

  // Fetch machines on component mount
  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  // Error handling
  const handleErrorDismiss = () => {
    clearError();
  };

  // Panel toggle handler
  const handleTogglePanel = (panel: PanelType) => {
    setSelectedPanels(prev => 
      prev.includes(panel) 
        ? prev.filter(p => p !== panel)
        : [...prev, panel]
    );
  };

  // Loading state
  if (isLoading && machines.length === 0) {
    return (
      <div className="flex h-screen bg-dark-900">
        <Sidebar 
          onMachineSelect={() => {}} 
          selectedPanels={selectedPanels}
          onTogglePanel={handleTogglePanel}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-green-500 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-dark-100 mb-2">Loading machines...</h2>
              <p className="text-dark-400">Please wait while we fetch your machine data</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar 
        onMachineSelect={() => {}} 
        selectedPanels={selectedPanels}
        onTogglePanel={handleTogglePanel}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col">
        <Header />
        
        {/* Error Banner */}
        {error && (
          <div className="bg-accent-red-500 bg-opacity-20 border-l-4 border-accent-red-500 p-4 m-4">
            <div className="flex items-center justify-between">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-accent-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-accent-red-300">{error}</p>
                </div>
              </div>
              <button
                onClick={handleErrorDismiss}
                className="text-accent-red-400 hover:text-accent-red-300 transition-colors"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto scrollbar-thin">
          <ImprovedDashboardLayout 
            machines={machines} 
            machineStatuses={machineStatuses} 
            selectedPanels={selectedPanels}
            onTogglePanel={handleTogglePanel}
          />
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;

