import { resolveDirectBase, isDncMock } from '../config/dnc';
import { createMockDncSocket } from './dncMock';
import type { DncSocket } from '../types/dnc';

export function makeDncWebSocket(deviceId: string): DncSocket {
  if (isDncMock()) return createMockDncSocket();
  const gatewayHttp = import.meta.env.VITE_API_BASE_URL as string;
  const direct = resolveDirectBase(deviceId);
  if (direct) {
    const wsBase = direct.replace(/^http/, 'ws');
    return new WebSocket(`${wsBase}/api/v1/ws`) as unknown as DncSocket;
  }
  const wsBase = gatewayHttp.replace(/^http/, 'ws');
  return new WebSocket(`${wsBase}/api/dnc/${deviceId}/v1/ws`) as unknown as DncSocket;
}

