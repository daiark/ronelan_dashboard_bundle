import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MachineStatus } from '../types'
import type { Machine, SensorData } from '../types'
import { useMachineStore } from '../store/machineStore'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import RadialGauge from '../components/RadialGauge'
import MetricDisplayBlock from '../components/MetricDisplayBlock'
import TimeSeriesPanel from '../components/panels/TimeSeriesPanel'
import EditMachineModal from '../components/modals/EditMachineModal'
import DeleteMachineModal from '../components/modals/DeleteMachineModal'
import AssignDeviceModal from '../components/nc-programs/AssignDeviceModal'
import NCProgramSection from '../components/nc-programs/NCProgramSection'

const MachineDetailPage = () => {
  const { machineId } = useParams<{ machineId: string }>()
  const navigate = useNavigate()
  const { machines, getMachine, getSensorData } = useMachineStore()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [sensorData, setSensorData] = useState<SensorData[]>([])
  const [latestData, setLatestData] = useState<SensorData | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Machine management modals
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAssignDeviceModal, setShowAssignDeviceModal] = useState(false)

  useEffect(() => {
    if (machineId) {
      const foundMachine = getMachine(machineId)
      if (foundMachine) {
        setMachine(foundMachine)
        const data = getSensorData(machineId)
        setSensorData(data)
        if (data.length > 0) {
          setLatestData(data[data.length - 1])
        }
      } else {
        // If machine not found, redirect to dashboard
        navigate('/')
      }
    }
  }, [machineId, getMachine, getSensorData, navigate, machines])
  
  // Modal handlers
  const handleCloseModals = () => {
    setShowEditModal(false)
    setShowDeleteModal(false)
    setShowAssignDeviceModal(false)
  }
  

  if (!machine || !latestData) {
    return (
      <div className="flex h-screen bg-dark-900">
        <Sidebar 
          onMachineSelect={() => {}} 
          selectedPanels={[]}
          onTogglePanel={() => {}}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-8 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-dark-100 mb-4">Loading machine data...</h2>
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-green-500 mx-auto"></div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: MachineStatus) => {
    switch (status) {
      case MachineStatus.RUNNING:
        return 'accent-green-500'
      case MachineStatus.MAINTENANCE:
        return 'accent-orange-500'
      case MachineStatus.ERROR:
        return 'accent-red-500'
      case MachineStatus.IDLE:
      default:
        return 'dark-400'
    }
  }

  const currentStatus = machine.status || MachineStatus.IDLE

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar 
        onMachineSelect={() => {}} 
        selectedPanels={[]}
        onTogglePanel={() => {}}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto scrollbar-thin">
          {/* Machine Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-dark-300 hover:text-accent-green-500 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              
              <div className="flex items-center space-x-3">
                <div className={`px-4 py-2 rounded-lg bg-${getStatusColor(currentStatus)} bg-opacity-20`}>
                  <span className={`text-${getStatusColor(currentStatus)} font-medium`}>
                    {currentStatus}
                  </span>
                </div>
                
                {/* Machine Management Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowAssignDeviceModal(true)}
                    className="px-3 py-2 bg-accent-purple-500 bg-opacity-20 text-accent-purple-400 rounded-lg hover:bg-opacity-30 transition-colors flex items-center space-x-2"
                    title="Assign Raspberry Pi Device"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Device</span>
                  </button>
                  
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-3 py-2 bg-accent-blue-500 bg-opacity-20 text-accent-blue-400 rounded-lg hover:bg-opacity-30 transition-colors flex items-center space-x-2"
                    title="Edit Machine"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                  
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-3 py-2 bg-accent-red-500 bg-opacity-20 text-accent-red-400 rounded-lg hover:bg-opacity-30 transition-colors flex items-center space-x-2"
                    title="Delete Machine"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-dark-100 mb-2">{machine.name}</h1>
            <div className="flex items-center space-x-6 text-dark-300">
              <span>{machine.location}</span>
              <span>•</span>
              <span>{machine.controller_type}</span>
              <span>•</span>
              <span>Model: {machine.model || 'N/A'}</span>
              {machine.raspberry_pi_device_id && (
                <>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4 text-accent-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Pi: {machine.raspberry_pi_device_id}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Main Chart */}
          <div className="mb-8">
            <TimeSeriesPanel 
              data={sensorData}
              height={400}
            />
          </div>

          {/* NC Program Management Section */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-8">
            <h2 className="text-xl font-semibold text-dark-100 mb-4">NC Program Management</h2>
            <NCProgramSection
              machineId={machine.id}
              machineName={machine.name}
              currentProgram={machine.current_program}
              raspberryPiStatus={machine.raspberry_pi_status}
              raspberryPiDeviceId={machine.raspberry_pi_device_id}
              onPauseProgram={() => {}} // TODO: Implement
              onStopProgram={() => {}} // TODO: Implement
              compact={false}
            />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {/* Radial Gauges */}
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <RadialGauge
                value={latestData.spindle_speed}
                max={machine.max_spindle_speed_rpm}
                label="Spindle Speed"
                unit="RPM"
                status={currentStatus}
              />
            </div>
            
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <RadialGauge
                value={latestData.spindle_load_percent}
                max={100}
                label="Spindle Load"
                unit="%"
                status={currentStatus}
              />
            </div>
            
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <RadialGauge
                value={latestData.temperature}
                max={100}
                label="Temperature"
                unit="°C"
                status={currentStatus}
              />
            </div>
            
            <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
              <RadialGauge
                value={latestData.total_power_kw}
                max={50}
                label="Power"
                unit="kW"
                status={currentStatus}
              />
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricDisplayBlock
              label="X Position"
              value={latestData.x_pos_mm.toFixed(2)}
              unit="mm"
            />
            
            <MetricDisplayBlock
              label="Y Position"
              value={latestData.y_pos_mm.toFixed(2)}
              unit="mm"
            />
            
            <MetricDisplayBlock
              label="Z Position"
              value={latestData.z_pos_mm.toFixed(2)}
              unit="mm"
            />
            
            <MetricDisplayBlock
              label="Feed Rate"
              value={latestData.feed_rate_actual.toFixed(1)}
              unit="mm/min"
            />
          </div>
        </main>
      </div>
      
      {/* Machine Management Modals */}
      <EditMachineModal 
        isOpen={showEditModal} 
        onClose={handleCloseModals} 
        machine={machine} 
      />
      
      <DeleteMachineModal 
        isOpen={showDeleteModal} 
        onClose={() => {
          handleCloseModals()
          // Check if machine still exists after potential deletion
          const stillExists = getMachine(machine.id)
          if (!stillExists) {
            navigate('/')
          }
        }} 
        machine={machine} 
      />
      
      <AssignDeviceModal 
        isOpen={showAssignDeviceModal} 
        onClose={handleCloseModals} 
        machineId={machine.id}
        machineName={machine.name}
        currentDeviceId={machine.raspberry_pi_device_id}
      />
    </div>
  )
}

export default MachineDetailPage
