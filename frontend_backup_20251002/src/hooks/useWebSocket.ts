import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage, SensorData } from '../types';
import { useMachineStore } from '../store/machineStore';
import { apiService } from '../services/apiService';

interface UseWebSocketOptions {
  machineId?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number; // Ping interval for connection health
  connectionTimeout?: number; // Timeout for initial connection
}

export const useWebSocket = ({
  machineId,
  reconnectInterval = 3000, // Faster reconnection for industrial reliability
  maxReconnectAttempts = 20, // More attempts for industrial environments
}: UseWebSocketOptions = {}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  
  const { addSensorData, setMachineOnline, setError } = useMachineStore();

  const connect = useCallback(() => {
    try {
      const wsUrl = apiService.getWebSocketUrl(machineId);
      console.log('Connecting to WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttemptsRef.current = 0;
        if (machineId) {
          setMachineOnline(machineId, true);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'sensor_data': {
              const sensorData = message.data as SensorData;
              addSensorData(sensorData.machine_id, sensorData);
              break;
            }
            case 'machine_status': {
              // Handle machine status updates if needed
              console.log('Machine status update:', message.data);
              break;
            }
            case 'error': {
              const errorData = message.data as { message: string };
              setError(`WebSocket error: ${errorData.message}`);
              break;
            }
            default: {
              console.warn('Unknown WebSocket message type:', message.type);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          setError('Failed to parse WebSocket message');
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        if (machineId) {
          setMachineOnline(machineId, false);
        }
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Maximum WebSocket reconnection attempts reached');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to establish WebSocket connection');
    }
  }, [machineId, reconnectInterval, maxReconnectAttempts, addSensorData, setMachineOnline, setError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting');
      wsRef.current = null;
    }
    
    if (machineId) {
      setMachineOnline(machineId, false);
    }
  }, [machineId, setMachineOnline]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Connection management
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Return connection state and utilities
  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    connect,
    disconnect,
    sendMessage,
  };
};
