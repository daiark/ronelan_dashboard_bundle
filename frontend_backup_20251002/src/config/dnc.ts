export type DncDevice = { id: string; name?: string; base?: string };

export const DNC_USE_MOCK: boolean = (import.meta.env.VITE_DNC_USE_MOCK ?? 'true') === 'true';

// Parse VITE_DNC_DEVICE_MAP like:
// "pi-1=http://192.168.1.10:8081,pi-2=http://192.168.1.11:8081"
function parseDeviceMap(raw?: string): Record<string, string> {
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const pair of raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)) {
    const [id, url] = pair.split('=').map(s => s.trim());
    if (id && url) map[id] = url.replace(/\/$/, '');
  }
  return map;
}

const RAW = import.meta.env.VITE_DNC_DEVICE_MAP;
const DEVICE_MAP = parseDeviceMap(RAW);

export function listDncDevices(): DncDevice[] {
  if (DNC_USE_MOCK) {
    // Mock multiple Raspberry Pi devices for testing
    return [
      { id: 'rpi-001', name: 'Pi Station A (Floor 1)' },
      { id: 'rpi-002', name: 'Pi Station B (Floor 1)' },
      { id: 'rpi-003', name: 'Pi Station C (Floor 2)' },
      { id: 'rpi-004', name: 'Pi Station D (Floor 2)' },
      { id: 'demo', name: 'Demo Device (Development)' }
    ];
  }
  const ids = Object.keys(DEVICE_MAP);
  return ids.length ? ids.map(id => ({ id, base: DEVICE_MAP[id] })) : [];
}

export function resolveDirectBase(deviceId: string): string | null {
  if (DNC_USE_MOCK) return null;
  return DEVICE_MAP[deviceId] || null;
}

export function isDncMock(): boolean { return DNC_USE_MOCK; }

