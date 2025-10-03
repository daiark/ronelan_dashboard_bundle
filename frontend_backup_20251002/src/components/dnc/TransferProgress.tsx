import React from 'react';
import { useDncStore } from '../../store/dncStore';

const TransferProgress: React.FC = () => {
  const { progress, state, wsStatus, reconnectAttempts } = useDncStore();
  const percent = Math.round(progress?.percent || 0);
  const wsColor = wsStatus === 'connected' ? 'text-accent-green-400' : wsStatus === 'connecting' ? 'text-accent-orange-400' : 'text-accent-red-400';
  const wsIcon = wsStatus === 'connected' ? '●' : wsStatus === 'connecting' ? '◐' : '○';
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-dark-100 font-semibold">Transfer Status</div>
        <div className="text-sm text-dark-300 flex items-center gap-4">
          <span>State: <span className="text-dark-100 capitalize">{state}</span></span>
          <span className="flex items-center gap-1">
            <span className={wsColor}>{wsIcon}</span>
            <span className={wsColor}>{wsStatus}</span>
            {reconnectAttempts > 0 && wsStatus === 'disconnected' && (
              <span className="text-dark-500 text-xs">(retry {reconnectAttempts})</span>
            )}
          </span>
        </div>
      </div>
      <div className="w-full bg-dark-900 rounded h-3 border border-dark-700">
        <div 
          className={`h-3 rounded transition-all duration-300 ${
            state === 'sending' || state === 'receiving' ? 'bg-accent-green-600' : 
            state === 'paused' ? 'bg-accent-orange-500' :
            'bg-dark-600'
          }`}
          style={{ width: `${percent}%` }} 
        />
      </div>
      {progress ? (
        <div className="text-xs text-dark-300">
          {formatBytes(progress.bytes_sent)} / {formatBytes(progress.total_bytes)} · {progress.rate_bps} B/s · {percent}%
        </div>
      ) : (
        <div className="text-xs text-dark-500">
          {state === 'idle' ? 'Ready to transfer' : 'No active transfer'}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <WsControls />
      </div>
    </div>
  );
};

const WsControls: React.FC = () => {
  const { startWs, stopWs, wsStatus } = useDncStore();
  return (
    <div className="flex gap-2">
      <button className="bg-dark-700 hover:bg-dark-600 px-3 py-1 rounded border border-dark-600" onClick={() => stopWs()} disabled={wsStatus === 'disconnected'}>
        Disconnect WS
      </button>
      <button className="bg-dark-700 hover:bg-dark-600 px-3 py-1 rounded border border-dark-600" onClick={() => { stopWs(); startWs(); }}>
        Reconnect WS
      </button>
    </div>
  );
};

export default TransferProgress;

