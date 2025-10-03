export type DncMode = 'standard' | 'bcc' | 'bcc_listen' | 'receive';

export interface SerialConfig {
  port: string;
  baud: number;
  bytesize: number;
  parity: 'N' | 'E' | 'O' | 'M' | 'S';
  stopbits: number;
  rtscts: boolean;
  xonxoff: boolean;
  timeout: number;
}

export interface StandardConfig {
  nuls: number;
  delay: number;
  wait_dc1: boolean;
  handshake_timeout: number;
  complete_timeout: number;
}

export interface BccConfig {
  retries: number;
  delay: number;
  dc1_after_bcc: boolean;
  program_name?: string | null;
}

export interface ReceiveConfig {
  handshake_timeout: number;
  complete_timeout: number;
  dc1_to_start: boolean;
  output_dir?: string | null;
}

export interface DncConfig {
  serial: SerialConfig;
  mode: { value: DncMode };
  encoding: string;
  eol: '\r' | '\n' | '\r\n';
  standard: StandardConfig;
  bcc: BccConfig;
  receive: ReceiveConfig;
}

export interface PortInfo {
  device: string;
  name?: string;
  description?: string;
  vid?: number;
  pid?: number;
  manufacturer?: string;
  product?: string;
  serial_number?: string;
}

export interface Progress {
  bytes_sent: number;
  total_bytes: number;
  rate_bps: number;
  elapsed_seconds: number;
  eta_seconds: number;
  percent: number;
}

export interface DncStateResponse { state: string }

export type LogEvent = { type: 'log'; ts: number; level: string; msg: string };
export type ProgressEvent = { type: 'progress'; ts: number; bytes: number; total: number; rate_bps?: number; percent: number };
export type StateEvent = { type: 'state'; ts: number; state: string };
export type ErrorEvent = { type: 'error'; ts: number; code: string; message: string };
export type DncWsEvent = LogEvent | ProgressEvent | StateEvent | ErrorEvent;

// Sanitization types
export interface SanitizeChange {
  line_number: number;
  before: string;
  after: string;
  reason?: string;
}

export interface SanitizeIssues {
  changes: SanitizeChange[];
  warnings: string[];
  errors: string[];
  has_changes: boolean;
  has_issues: boolean;
}

// Minimal socket interface used by DNC store and services
export type DncSocket = {
  onmessage: ((ev: MessageEvent) => void) | null;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  close: () => void;
};

