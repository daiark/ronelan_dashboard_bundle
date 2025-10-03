import axios from 'axios';
import type { DncConfig, PortInfo, Progress, SanitizeIssues } from '../types/dnc';
import { resolveDirectBase, isDncMock } from '../config/dnc';
import { dncMock } from './dncMock';

// Gateway base URL
const BASE = import.meta.env.VITE_API_BASE_URL;

function base(deviceId: string) {
  // Prefer direct base (dev) if available, else gateway proxy
  const direct = resolveDirectBase(deviceId);
  if (direct) return `${direct}/api/v1`;
  return `${BASE}/api/dnc/${deviceId}/v1`;
}

export const dncApi = {
  async health(deviceId: string) {
    if (isDncMock()) return dncMock.health(deviceId);
    const { data } = await axios.get(`${base(deviceId)}/health`);
    return data as { status: 'ok'; version: string };
  },

  async ports(deviceId: string) {
    if (isDncMock()) return dncMock.ports(deviceId) as unknown as PortInfo[];
    const { data } = await axios.get(`${base(deviceId)}/ports`);
    return data as PortInfo[];
  },

  async getConfig(deviceId: string) {
    if (isDncMock()) return dncMock.getConfig(deviceId) as unknown as DncConfig;
    const { data } = await axios.get(`${base(deviceId)}/config`);
    return data as DncConfig;
  },

  async setConfig(deviceId: string, cfg: DncConfig) {
    if (isDncMock()) return dncMock.setConfig(deviceId, cfg) as unknown as DncConfig;
    const { data } = await axios.put(`${base(deviceId)}/config`, cfg);
    return data as DncConfig;
  },

  async connect(deviceId: string) {
    if (isDncMock()) return dncMock.connect(deviceId) as { ok: boolean };
    const { data } = await axios.post(`${base(deviceId)}/connect`);
    return data as { ok: boolean };
  },

  async disconnect(deviceId: string) {
    if (isDncMock()) return dncMock.disconnect(deviceId) as { ok: boolean };
    const { data } = await axios.post(`${base(deviceId)}/disconnect`);
    return data as { ok: boolean };
  },

  async setMode(deviceId: string, mode: DncConfig['mode']['value']) {
    if (isDncMock()) return dncMock.setMode(deviceId, mode) as { mode: string };
    const { data } = await axios.post(`${base(deviceId)}/mode`, { mode: { value: mode } });
    return data as { mode: string };
  },

  async upload(deviceId: string, file: File) {
    if (isDncMock()) return dncMock.upload(deviceId, file) as { file_id: string; filename: string; size: number };
    const form = new FormData();
    form.append('file', file);
    const { data } = await axios.post(`${base(deviceId)}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as { file_id: string; filename: string; size: number };
  },

  async send(deviceId: string, file_id: string) {
    if (isDncMock()) return dncMock.send(deviceId, file_id) as { started: boolean };
    const { data, status } = await axios.post(`${base(deviceId)}/send`, { file_id });
    return { started: status === 202, ...data } as { started: boolean };
  },

  async receive(deviceId: string, output_dir?: string) {
    if (isDncMock()) return dncMock.receive(deviceId, output_dir) as { started: boolean };
    const { data, status } = await axios.post(`${base(deviceId)}/receive`, { output_dir });
    return { started: status === 202, ...data } as { started: boolean };
  },

  async pause(deviceId: string) { if (isDncMock()) return dncMock.pause(deviceId) as { paused: boolean }; return (await axios.post(`${base(deviceId)}/pause`)).data as { paused: boolean }; },
  async resume(deviceId: string) { if (isDncMock()) return dncMock.resume(deviceId) as { resumed: boolean }; return (await axios.post(`${base(deviceId)}/resume`)).data as { resumed: boolean }; },
  async stop(deviceId: string) { if (isDncMock()) return dncMock.stop(deviceId) as { stopped: boolean }; return (await axios.post(`${base(deviceId)}/stop`)).data as { stopped: boolean }; },

  async progress(deviceId: string) {
    if (isDncMock()) return dncMock.progress(deviceId) as unknown as Progress;
    const { data } = await axios.get(`${base(deviceId)}/progress`);
    return data as Progress;
  },

  async state(deviceId: string) {
    if (isDncMock()) return dncMock.state(deviceId) as { state: string };
    const { data } = await axios.get(`${base(deviceId)}/state`);
    return data as { state: string };
  },

  async sanitize(deviceId: string, content: string) {
    if (isDncMock()) return dncMock.sanitize(deviceId, content) as { clean: string; issues: SanitizeIssues };
    const { data } = await axios.post(`${base(deviceId)}/sanitize`, { content });
    return data as { clean: string; issues: SanitizeIssues };
  },
};
