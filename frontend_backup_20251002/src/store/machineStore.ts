import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Machine, SensorData, MachineStatusData } from '../types';
import { MachineStatus } from '../types';
import { apiService } from '../services/apiService';
import { mockMachines, mockSensorData, mockMachineStatuses } from '../utils/mockData';

interface MachineState {
  // Data
  machines: Machine[];
  machineStatuses: Record<string, MachineStatusData>;
  sensorData: Record<string, SensorData[]>;
  
  // Loading states
  isLoading: boolean;
  isLoadingData: Record<string, boolean>;
  
  // Error handling
  error: string | null;
  
  // Actions
  fetchMachines: () => Promise<void>;
  fetchMachineData: (machineId: string, startTime?: string, endTime?: string) => Promise<void>;
  updateMachineStatus: (machineId: string, status: Partial<MachineStatusData>) => void;
  addSensorData: (machineId: string, data: SensorData) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setMachineOnline: (machineId: string, isOnline: boolean) => void;
  getMachine: (machineId: string) => Machine | undefined;
  getSensorData: (machineId: string) => SensorData[];

  // CRUD and assignment
  addMachine: (machine: Omit<Machine, 'id'>) => Promise<Machine>;
  updateMachine: (machineId: string, updates: Partial<Machine>) => Promise<void>;
  deleteMachine: (machineId: string) => Promise<void>;
  assignDevice: (machineId: string, deviceId: string) => Promise<void>;
}

export const useMachineStore = create<MachineState>()(
  devtools(
    (set, get) => ({
      // Initial state
      machines: [],
      machineStatuses: {},
      sensorData: {},
      isLoading: false,
      isLoadingData: {},
      error: null,

      // Actions
      fetchMachines: async () => {
        set({ isLoading: true, error: null });
        
        // Use mock data if API base URL is not available (design mode)
        const useMockData = !import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_USE_MOCK_DATA === 'true';
        
        if (useMockData) {
          // Simulate loading time
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const currentState = get();
          // Preserve manually added machines (those with IDs starting with 'M-')
          const manualMachines = currentState.machines.filter(m => m.id.startsWith('M-'));
          const allMachines = [...mockMachines, ...manualMachines];
          
          // Merge mock statuses with existing manually created machine statuses
          const preservedStatuses = { ...mockMachineStatuses };
          manualMachines.forEach(machine => {
            if (currentState.machineStatuses[machine.id]) {
              preservedStatuses[machine.id] = currentState.machineStatuses[machine.id];
            }
          });
          
          set({ 
            machines: allMachines, 
            machineStatuses: preservedStatuses,
            sensorData: mockSensorData,
            isLoading: false 
          });
          return;
        }
        
        try {
          const machines = await apiService.fetchMachines();
          
          // Initialize machine statuses
          const machineStatuses: Record<string, MachineStatusData> = {};
          machines.forEach(machine => {
            machineStatuses[machine.id] = {
              machine,
              isOnline: false,
              lastUpdate: new Date(),
              status: machine.status || MachineStatus.IDLE,
            };
          });
          
          set({ 
            machines, 
            machineStatuses,
            isLoading: false 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch machines';
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
        }
      },

      fetchMachineData: async (machineId: string, startTime?: string, endTime?: string) => {
        set(state => ({ 
          isLoadingData: { ...state.isLoadingData, [machineId]: true },
          error: null 
        }));
        
        try {
          const data = await apiService.fetchMachineData(machineId, startTime, endTime);
          
          set(state => ({
            sensorData: { ...state.sensorData, [machineId]: data },
            isLoadingData: { ...state.isLoadingData, [machineId]: false },
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : `Failed to fetch data for machine ${machineId}`;
          set(state => ({ 
            error: errorMessage,
            isLoadingData: { ...state.isLoadingData, [machineId]: false }
          }));
        }
      },

      updateMachineStatus: (machineId: string, status: Partial<MachineStatusData>) => {
        set(state => ({
          machineStatuses: {
            ...state.machineStatuses,
            [machineId]: {
              ...state.machineStatuses[machineId],
              ...status,
              lastUpdate: new Date(),
            }
          }
        }));
      },

      addSensorData: (machineId: string, data: SensorData) => {
        set(state => {
          const existingData = state.sensorData[machineId] || [];
          const newData = [data, ...existingData].slice(0, 100); // Keep last 100 data points
          
          // Update machine status with latest data
          const machineStatus = state.machineStatuses[machineId];
          if (machineStatus) {
            machineStatus.latestData = data;
            machineStatus.isOnline = true;
            machineStatus.lastUpdate = new Date();
          }
          
          return {
            sensorData: { ...state.sensorData, [machineId]: newData },
            machineStatuses: { ...state.machineStatuses, [machineId]: machineStatus }
          };
        });
      },

      setMachineOnline: (machineId: string, isOnline: boolean) => {
        set(state => {
          const machineStatus = state.machineStatuses[machineId];
          if (machineStatus) {
            return {
              machineStatuses: {
                ...state.machineStatuses,
                [machineId]: {
                  ...machineStatus,
                  isOnline,
                  lastUpdate: new Date(),
                }
              }
            };
          }
          return state;
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      getMachine: (machineId: string) => {
        const state = get();
        return state.machines.find(machine => machine.id === machineId);
      },

      getSensorData: (machineId: string) => {
        const state = get();
        return state.sensorData[machineId] || [];
      },

      // CRUD and assignment (mock implementations until backend available)
      addMachine: async (machine) => {
        const id = `M-${Date.now()}`;
        const newMachine: Machine = { id, ...machine } as Machine;
        set(state => ({ machines: [...state.machines, newMachine] }));
        // Initialize status entry
        set(state => ({
          machineStatuses: {
            ...state.machineStatuses,
            [id]: {
              machine: newMachine,
              isOnline: false,
              lastUpdate: new Date(),
              status: newMachine.status || MachineStatus.IDLE,
            }
          }
        }));
        return newMachine;
      },

      updateMachine: async (machineId, updates) => {
        set(state => ({
          machines: state.machines.map(m => m.id === machineId ? { ...m, ...updates } : m),
          machineStatuses: {
            ...state.machineStatuses,
            [machineId]: state.machineStatuses[machineId]
              ? { ...state.machineStatuses[machineId], machine: { ...state.machineStatuses[machineId].machine, ...updates } }
              : state.machineStatuses[machineId]
          }
        }));
      },

      deleteMachine: async (machineId) => {
        set(state => {
          const { [machineId]: removedStatus, ...restStatuses } = state.machineStatuses;          const { [machineId]: removedData, ...restData } = state.sensorData;
          return {
            machines: state.machines.filter(m => m.id !== machineId),
            machineStatuses: restStatuses,
            sensorData: restData,
          };
        });
      },

      assignDevice: async (machineId, deviceId) => {
        set(state => ({
          machines: state.machines.map(m => m.id === machineId ? { ...m, raspberry_pi_device_id: deviceId } : m),
          machineStatuses: {
            ...state.machineStatuses,
            [machineId]: state.machineStatuses[machineId]
              ? { ...state.machineStatuses[machineId], machine: { ...state.machineStatuses[machineId].machine, raspberry_pi_device_id: deviceId } }
              : state.machineStatuses[machineId]
          }
        }));
      },
    }),
    {
      name: 'machine-store',
    }
  )
);

