import axios from 'axios';
import type { Machine, SensorData } from '../types';

// Configure axios with base URL from environment variables
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    return Promise.reject(error);
  }
);

export const apiService = {
  // Fetch all machines
  async fetchMachines(): Promise<Machine[]> {
    try {
      const response = await api.get<Machine[]>('/api/v1/machines');
      return response.data;
    } catch (error) {
      console.error('Error fetching machines:', error);
      throw new Error('Failed to fetch machines');
    }
  },

  // Create a new machine
  async createMachine(machine: Omit<Machine, 'id' | 'created_at' | 'last_updated'>): Promise<Machine> {
    try {
      const response = await api.post<Machine>('/api/v1/machines', machine);
      return response.data;
    } catch (error) {
      console.error('Error creating machine:', error);
      throw new Error('Failed to create machine');
    }
  },

  // Fetch sensor data for a specific machine
  async fetchMachineData(
    machineId: string, 
    startTime?: string, 
    endTime?: string
  ): Promise<SensorData[]> {
    try {
      const params = new URLSearchParams();
      if (startTime) params.append('start_time', startTime);
      if (endTime) params.append('end_time', endTime);
      
      const response = await api.get<SensorData[]>(
        `/api/v1/machines/${machineId}/data${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching data for machine ${machineId}:`, error);
      throw new Error(`Failed to fetch data for machine ${machineId}`);
    }
  },

  // Get WebSocket URL for real-time data
  getWebSocketUrl(machineId?: string): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return machineId ? `${wsUrl}/ws/machines/${machineId}` : `${wsUrl}/ws/machines`;
  },
};

export default apiService;
