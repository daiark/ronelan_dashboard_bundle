import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { dncApi } from '../services/dncApi';
import { makeDncWebSocket } from '../services/dncWs';
import { isDncMock } from '../config/dnc';
import type { DncConfig, PortInfo, Progress, DncWsEvent, DncSocket, ProgressEvent } from '../types/dnc';

interface DncState {
  deviceId: string | null;
  ports: PortInfo[];
  config: DncConfig | null;
  state: string; // idle|connecting|connected|...
  progress: Progress | null;
  logs: { ts: number; level: string; msg: string }[];
  uploading: boolean;
  fileId: string | null;

  // WS connection state
  ws: DncSocket | null;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  reconnectAttempts: number;
  reconnectTimer: number | null;

  // Actions
  setDevice: (deviceId: string) => Promise<void>;
  refreshPorts: () => Promise<void>;
  loadConfig: () => Promise<void>;
  saveConfig: (cfg: DncConfig) => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setMode: (mode: DncConfig['mode']['value']) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  send: () => Promise<boolean>;
  receive: (outputDir?: string) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  sanitize: (content: string) => Promise<{ clean: string; issues: import('../types/dnc').SanitizeIssues }>;
  clearLogs: () => void;

  // WS
  startWs: () => void;
  stopWs: () => void;
}

export const useDncStore = create<DncState>()(devtools((set, get) => ({
  deviceId: null,
  ports: [],
  config: null,
  state: 'idle',
  progress: null,
  logs: [],
  uploading: false,
  fileId: null,
  ws: null,
  wsStatus: 'disconnected',
  reconnectAttempts: 0,
  reconnectTimer: null,

  setDevice: async (deviceId: string) => {
    // cleanup previous ws
    const st = get();
    if (st.ws) {
      try { st.ws.close(); } catch { /* ignore */ }
    }
    if (st.reconnectTimer) {
      clearTimeout(st.reconnectTimer);
      set({ reconnectTimer: null });
    }
    set({ deviceId, ws: null, wsStatus: 'disconnected', reconnectAttempts: 0 });
    await get().refreshPorts();
    await get().loadConfig();
    get().startWs();
  },

  refreshPorts: async () => {
    const dev = get().deviceId; if (!dev) return;
    const ports = await dncApi.ports(dev);
    set({ ports });
  },

  loadConfig: async () => {
    const dev = get().deviceId; if (!dev) return;
    const cfg = await dncApi.getConfig(dev);
    set({ config: cfg });
  },

  saveConfig: async (cfg: DncConfig) => {
    const dev = get().deviceId; if (!dev) return;
    const saved = await dncApi.setConfig(dev, cfg);
    set({ config: saved });
  },

  connect: async () => {
    const dev = get().deviceId; if (!dev) return false;
    const res = await dncApi.connect(dev);
    if (res.ok) set({ state: 'connected' });
    return !!res.ok;
  },

  disconnect: async () => {
    const dev = get().deviceId; if (!dev) return;
    await dncApi.disconnect(dev);
  },

  setMode: async (mode) => {
    const dev = get().deviceId; if (!dev) return;
    await dncApi.setMode(dev, mode);
    const cfg = get().config;
    if (cfg) set({ config: { ...cfg, mode: { value: mode } } });
  },

  uploadFile: async (file: File) => {
    const dev = get().deviceId; if (!dev) return;
    set({ uploading: true });
    try {
      const res = await dncApi.upload(dev, file);
      set({ fileId: res.file_id });
    } finally {
      set({ uploading: false });
    }
  },

  send: async () => {
    const dev = get().deviceId; if (!dev) return false;
    const fid = get().fileId; if (!fid) return false;
    // Ensure connected state before sending
    if (get().state !== 'connected') {
      try {
        const conn = await dncApi.connect(dev);
        if (!conn.ok) return false;
        set({ state: 'connected' });
      } catch {
        return false;
      }
    }
    const res = await dncApi.send(dev, fid);
    if (res.started) set({ state: 'sending' });
    return !!res.started;
  },

  receive: async (outputDir?: string) => {
    const dev = get().deviceId; if (!dev) return false;
    const res = await dncApi.receive(dev, outputDir);
    if (res.started) set({ state: 'receiving' });
    return !!res.started;
  },

  pause: async () => {
    const dev = get().deviceId; if (!dev) return;
    await dncApi.pause(dev);
    set({ state: 'paused' });
  },

  resume: async () => {
    const dev = get().deviceId; if (!dev) return;
    await dncApi.resume(dev);
    const cfg = get().config;
    const newState = cfg?.mode.value === 'receive' ? 'receiving' : 'sending';
    set({ state: newState || 'connected' });
  },

  stop: async () => {
    const dev = get().deviceId; if (!dev) return;
    await dncApi.stop(dev);
    set({ state: 'connected' });
  },

  sanitize: async (content: string) => {
    const dev = get().deviceId;
    if (!dev) {
      if (isDncMock()) return dncApi.sanitize('demo', content);
      throw new Error('No device');
    }
    return dncApi.sanitize(dev, content);
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  startWs: () => {
    const dev = get().deviceId; if (!dev) return;
    // Close any existing socket and timer
    const st = get();
    if (st.ws) { try { st.ws.close(); } catch { /* ignore */ } }
    if (st.reconnectTimer) { clearTimeout(st.reconnectTimer); set({ reconnectTimer: null }); }

    set({ wsStatus: 'connecting' });
    const ws = makeDncWebSocket(dev);

    ws.onopen = () => {
      set({ wsStatus: 'connected', reconnectAttempts: 0 });
    };

    ws.onclose = () => {
      set({ wsStatus: 'disconnected' });
      // schedule reconnect with backoff
      const attempts = get().reconnectAttempts;
      const delay = Math.min(10000, 500 * Math.pow(2, attempts));
      const timerId = setTimeout(() => {
        set({ reconnectAttempts: attempts + 1, reconnectTimer: null });
        get().startWs();
      }, delay) as unknown as number;
      set({ reconnectTimer: timerId });
    };

    ws.onmessage = (ev: MessageEvent) => {
      const data = JSON.parse(String((ev as MessageEvent).data)) as DncWsEvent;
      if (data.type === 'log') {
        set((s) => ({ logs: [...s.logs, { ts: data.ts, level: data.level, msg: data.msg }].slice(-5000) }));
      } else if (data.type === 'progress') {
        const p = data as ProgressEvent;
        set({ progress: {
          bytes_sent: p.bytes,
          total_bytes: p.total,
          rate_bps: p.rate_bps || 0,
          elapsed_seconds: 0,
          eta_seconds: 0,
          percent: p.percent,
        }});
      } else if (data.type === 'state') {
        set({ state: data.state });
      }
    };

    set({ ws });
  },

  stopWs: () => {
    const st = get();
    if (st.ws) { try { st.ws.close(); } catch { /* ignore */ } }
    if (st.reconnectTimer) { clearTimeout(st.reconnectTimer); }
    set({ ws: null, reconnectTimer: null, wsStatus: 'disconnected', reconnectAttempts: 0 });
  },
})));
