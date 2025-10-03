import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useDncStore } from '../store/dncStore';
import SerialConfigPanel from '../components/dnc/SerialConfigPanel';
import ModeControls from '../components/dnc/ModeControls';
import NcEditor from '../components/dnc/NcEditor';
import LogConsole from '../components/dnc/LogConsole';
import TransferProgress from '../components/dnc/TransferProgress';
import { listDncDevices } from '../config/dnc';

const DncFeederPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const {
    deviceId, setDevice, refreshPorts, loadConfig, wsStatus, ports,
  } = useDncStore();

  const devices = listDncDevices();
  const defaultDevice = devices.length > 0 ? devices[0].id : 'demo';
  const [selectedDevice, setSelectedDevice] = useState<string>(defaultDevice);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Get machine context from URL parameters
  const machineId = searchParams.get('machineId');
  const machineName = searchParams.get('machineName');
  const deviceIdFromUrl = searchParams.get('deviceId');

  useEffect(() => {
    // On first load, prefer deviceId from URL if provided
    if (deviceIdFromUrl && selectedDevice !== deviceIdFromUrl) {
      setSelectedDevice(deviceIdFromUrl);
      setDevice(deviceIdFromUrl);
      return;
    }
    // Keep the store's deviceId in sync with the local selection.
    if (selectedDevice && deviceId !== selectedDevice) {
      setDevice(selectedDevice);
    }
  }, [deviceId, selectedDevice, setDevice, deviceIdFromUrl]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshPorts(), loadConfig()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar 
        onMachineSelect={() => {}} 
        selectedPanels={['time-series']} 
        onTogglePanel={() => {}} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Machine Context Display */}
          {machineId && (
            <div className="bg-accent-blue-500 bg-opacity-10 border border-accent-blue-500 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-accent-blue-400 font-semibold">Selected Machine: {machineName || machineId}</h3>
                  <p className="text-sm text-dark-300">Send NC programs directly to this machine</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-dark-300 text-sm font-medium">Device</label>
              <select className="bg-dark-700 text-dark-100 rounded px-3 py-2 min-w-32"
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                {devices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id} {d.name && `- ${d.name}`}
                  </option>
                ))}
              </select>
              
              {/* Device status indicators */}
              <div className="flex items-center gap-3 text-xs">
                <span className={`flex items-center gap-1 ${
                  wsStatus === 'connected' ? 'text-accent-green-400' :
                  wsStatus === 'connecting' ? 'text-accent-orange-400' :
                  'text-dark-400'
                }`}>
                  <span>{wsStatus === 'connected' ? '●' : wsStatus === 'connecting' ? '◐' : '○'}</span>
                  WebSocket
                </span>
                <span className="text-dark-400">
                  Ports: {ports.length > 0 ? ports.length : 'none'}
                </span>
              </div>
              
              <button 
                disabled={!selectedDevice || refreshing} 
                className="ml-auto bg-dark-700 hover:bg-dark-600 px-3 py-2 rounded border border-dark-600 disabled:opacity-50" 
                onClick={handleRefresh}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <SerialConfigPanel />
              <ModeControls />
              <TransferProgress />
            </div>
            <div className="space-y-4">
              <NcEditor />
              <LogConsole />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DncFeederPage;

