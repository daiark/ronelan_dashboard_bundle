import type { DncConfig, PortInfo, Progress, DncMode, SanitizeIssues, DncSocket } from '../types/dnc';

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

const defaultConfig: DncConfig = {
  serial: {
    port: '/dev/mock0', baud: 9600, bytesize: 7, parity: 'E', stopbits: 1,
    rtscts: true, xonxoff: false, timeout: 1.0,
  },
  mode: { value: 'standard' },
  encoding: 'ascii',
  eol: '\r\n',
  standard: { nuls: 50, delay: 0.10, wait_dc1: true, handshake_timeout: 20, complete_timeout: 10 },
  bcc: { retries: 3, delay: 0.10, dc1_after_bcc: false, program_name: null },
  receive: { handshake_timeout: 20, complete_timeout: 10, dc1_to_start: false, output_dir: null },
};

let currentConfig: DncConfig = JSON.parse(JSON.stringify(defaultConfig));
let connected = false;
let stateValue = 'idle';
let uploaded: { id: string; name: string; size: number } | null = null;
let progressBytes = 0;
let totalBytes = 100000;

export const dncMock = {
  async health(_deviceId: string) { void _deviceId; return { status: 'ok', version: 'mock-0.1.0' }; },
  async ports(_deviceId: string): Promise<PortInfo[]> { void _deviceId; return [
    { device: '/dev/mock0', description: 'Mock Serial Port 0' },
    { device: '/dev/mock1', description: 'Mock Serial Port 1' },
  ]; },
  async getConfig(_deviceId: string): Promise<DncConfig> { void _deviceId; await delay(100); return currentConfig; },
  async setConfig(_deviceId: string, cfg: DncConfig): Promise<DncConfig> { void _deviceId; currentConfig = cfg; return currentConfig; },
  async connect(_deviceId: string) { void _deviceId; connected = true; stateValue = 'connected'; return { ok: true }; },
  async disconnect(_deviceId: string) { void _deviceId; connected = false; stateValue = 'idle'; return { ok: true }; },
  async setMode(_deviceId: string, mode: DncMode) { void _deviceId; currentConfig.mode.value = mode; return { mode }; },
  async upload(_deviceId: string, file: File) {
    void _deviceId;
    uploaded = { id: 'mockfile', name: file.name, size: file.size };
    totalBytes = Math.max(50000, file.size || 100000);
    return { file_id: uploaded.id, filename: file.name, size: file.size };
  },
  async send(_deviceId: string, _file_id: string) { void _deviceId; void _file_id; if (!connected) return { started: false }; stateValue = 'sending'; progressBytes = 0; return { started: true }; },
  async receive(_deviceId: string, _out?: string) { void _deviceId; void _out; if (!connected) return { started: false }; stateValue = 'receiving'; progressBytes = 0; return { started: true }; },
  async pause(_deviceId: string) { void _deviceId; stateValue = 'paused'; return { paused: true }; },
  async resume(_deviceId: string) { void _deviceId; stateValue = currentConfig.mode.value === 'receive' ? 'receiving' : 'sending'; return { resumed: true }; },
  async stop(_deviceId: string) { void _deviceId; stateValue = 'connected'; return { stopped: true }; },
  async progress(_deviceId: string): Promise<Progress> { void _deviceId;
    return {
      bytes_sent: progressBytes,
      total_bytes: totalBytes,
      rate_bps: 5000,
      elapsed_seconds: 0,
      eta_seconds: Math.max(0, (totalBytes - progressBytes) / 5000),
      percent: totalBytes ? (progressBytes / totalBytes) * 100 : 0,
    };
  },
  async state(_deviceId: string) { void _deviceId; return { state: stateValue }; },
  async sanitize(_deviceId: string, content: string): Promise<{ clean: string; issues: SanitizeIssues }> {
    void _deviceId;
    // Lightweight sanitizer mimicking backend behavior
    // eslint-disable-next-line no-control-regex
    const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
    const BEGIN_RE = /^(\s*\d*\s*)BEGIN\s+PGM\s+(\S+)(.*)$/i;
    const END_RE = /^(\s*\d*\s*)END\s+PGM\s+(\S+)(.*)$/i;

    const lines = content.split(/\r?\n/);
    const changes: SanitizeIssues['changes'] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    let beginName: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const original = lines[i];
      let line = original;
      // Remove control chars
      if (CONTROL_CHARS_RE.test(line)) {
        const clean = line.replace(CONTROL_CHARS_RE, '');
        if (clean !== line) {
          changes.push({ line_number: i, before: line, after: clean, reason: 'Removed control characters' });
          line = clean;
        }
      }
      // Fix common typo: 'PG' -> 'PGM' after BEGIN
      const beginPgTypo = line.match(/^(\s*\d*\s*)BEGIN\s+PG(\s+\S+.*)$/i);
      if (beginPgTypo) {
        const [, prefix, rest] = beginPgTypo;
        const fixed = `${prefix}BEGIN PGM${rest}`;
        changes.push({ line_number: i, before: original, after: fixed, reason: 'Fixed PGM keyword' });
        lines[i] = fixed;
        line = fixed;
      }
      // Normalize BEGIN PGM
      const b = line.match(BEGIN_RE);
      if (b) {
        const [, prefix, name, suffix] = b;
        const normalized = `${prefix}BEGIN PGM ${name.toUpperCase()}${suffix}`;
        if (normalized !== original) {
          changes.push({ line_number: i, before: original, after: normalized, reason: 'Normalized BEGIN PGM statement' });
        }
        lines[i] = normalized;
        beginName = name.toUpperCase();
        continue;
      }
      // Fix common typo: 'PG' -> 'PGM' after END
      const endPgTypo = line.match(/^(\s*\d*\s*)END\s+PG(\s+\S+.*)$/i);
      if (endPgTypo) {
        const [, prefix, rest] = endPgTypo;
        const fixed = `${prefix}END PGM${rest}`;
        changes.push({ line_number: i, before: original, after: fixed, reason: 'Fixed PGM keyword' });
        lines[i] = fixed;
        line = fixed;
      }
      // Normalize END PGM
      const e = line.match(END_RE);
      if (e) {
        const [, prefix, name, suffix] = e;
        const normalizedName = beginName || name.toUpperCase();
        const normalized = `${prefix}END PGM ${normalizedName}${suffix}`;
        if (normalized !== original) {
          changes.push({ line_number: i, before: original, after: normalized, reason: 'Normalized END PGM statement' });
        }
        lines[i] = normalized;
        continue;
      }
      // Non-ASCII warning
      try { Buffer.from(line, 'ascii').toString('ascii'); }
      catch { warnings.push(`Line ${i + 1}: Contains non-ASCII characters`); }
      // Long line warning
      if (line.length > 132) warnings.push(`Line ${i + 1}: Exceeds 132 character limit (${line.length} chars)`);
    }

    // BEGIN/END mismatch check
    const beginCount = lines.filter(l => BEGIN_RE.test(l)).length;
    const endCount = lines.filter(l => END_RE.test(l)).length;
    if (beginCount !== endCount) {
      errors.push(`Mismatched BEGIN/END statements: ${beginCount} BEGIN, ${endCount} END`);
    }

    const issues: SanitizeIssues = {
      changes,
      warnings,
      errors,
      has_changes: changes.length > 0,
      has_issues: warnings.length > 0 || errors.length > 0,
    };

    // Apply changes to produce clean content
    const clean = lines.join('\n');
    return { clean, issues };
  },
};

// Mock WebSocket that emits periodic events
export function createMockDncSocket(): DncSocket {
  const socket: DncSocket = {
    onmessage: null,
    onopen: null,
    onclose: null,
    close: () => {
      clearInterval(timer);
      if (typeof socket.onclose === 'function') socket.onclose(new CloseEvent('close'));
    }
  };
  const send = (obj: unknown) => {
    const handler = socket.onmessage as unknown as ((ev: { data: string }) => void) | null;
    if (handler) handler({ data: JSON.stringify(obj) });
  };

  // Fire onopen soon after creation
  setTimeout(() => { if (typeof socket.onopen === 'function') socket.onopen(new Event('open')); }, 0);

  let t = 0;
  const timer = setInterval(() => {
    // Simulate progress when in sending/receiving
    if (stateValue === 'sending' || stateValue === 'receiving') {
      progressBytes = Math.min(totalBytes, progressBytes + 4000 + Math.floor(Math.random() * 3000));
      send({ type: 'progress', ts: Date.now() / 1000, bytes: progressBytes, total: totalBytes, rate_bps: 5000, percent: totalBytes ? (progressBytes / totalBytes) * 100 : 0 });
      if (progressBytes >= totalBytes) {
        stateValue = 'connected';
        send({ type: 'state', ts: Date.now() / 1000, state: stateValue });
        send({ type: 'log', ts: Date.now() / 1000, level: 'info', msg: 'Transfer complete' });
      }
    }
    // Emit periodic log
    if ((t++ % 4) === 0) {
      send({ type: 'log', ts: Date.now() / 1000, level: 'info', msg: `Mock event tick ${t}` });
    }
  }, 500);

  // Initial state
  setTimeout(() => send({ type: 'state', ts: Date.now() / 1000, state: stateValue }), 50);

  return socket;
}

