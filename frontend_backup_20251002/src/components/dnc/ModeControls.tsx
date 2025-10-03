import React, { useState } from 'react';
import { useDncStore } from '../../store/dncStore';
import type { DncConfig } from '../../types/dnc';

const ModeControls: React.FC = () => {
  const { config, setMode, send, receive, pause, resume, stop, uploading, uploadFile, fileId, state, wsStatus, startWs } = useDncStore();
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!config) return null;

  const mode = config.mode.value;
  
  // Auto-connect WebSocket if not connected when starting transfers
  const ensureConnectedAndStart = async (action: () => void) => {
    if (wsStatus !== 'connected') {
      setStatusMessage('Connecting...');
      startWs();
      // Give a moment for connection, then proceed
      setTimeout(() => {
        action();
        setStatusMessage('');
      }, 500);
    } else {
      action();
      setStatusMessage('');
    }
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-dark-400 text-sm">Mode</label>
        <select className="bg-dark-700 text-dark-100 rounded px-3 py-2" value={mode} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as DncConfig['mode']['value'])}>
          <option value="standard">standard</option>
          <option value="bcc">bcc</option>
          <option value="bcc_listen">bcc_listen</option>
          <option value="receive">receive</option>
        </select>
      </div>

      {/* Status feedback */}
      {statusMessage && (
        <div className="text-sm text-accent-orange-400 py-1">
          {statusMessage}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {(mode === 'standard' || mode === 'bcc') && (
          <>
            <input type="file" onChange={(e) => setLocalFile(e.target.files?.[0] || null)} />
            <button disabled={!localFile || uploading} className="bg-dark-700 hover:bg-dark-600 px-3 py-2 rounded border border-dark-600" onClick={() => localFile && uploadFile(localFile)}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button 
              disabled={!fileId} 
              className="bg-accent-green-600 hover:bg-accent-green-500 disabled:opacity-50 px-3 py-2 rounded" 
              onClick={() => ensureConnectedAndStart(() => {
                send();
                setStatusMessage('Transfer started');
                setTimeout(() => setStatusMessage(''), 2000);
              })}
            >
              Start
            </button>
          </>
        )}
        {mode === 'receive' && (
          <button 
            className="bg-accent-green-600 hover:bg-accent-green-500 px-3 py-2 rounded" 
            onClick={() => ensureConnectedAndStart(() => {
              receive();
              setStatusMessage('Receive started');
              setTimeout(() => setStatusMessage(''), 2000);
            })}
          >
            Start Receive
          </button>
        )}
        <button 
          disabled={!(state === 'sending' || state === 'receiving')} 
          className="bg-dark-700 hover:bg-dark-600 disabled:opacity-50 px-3 py-2 rounded border border-dark-600" 
          onClick={() => {
            pause();
            setStatusMessage('Transfer paused');
            setTimeout(() => setStatusMessage(''), 2000);
          }}
        >
          Pause
        </button>
        <button 
          disabled={state !== 'paused'} 
          className="bg-dark-700 hover:bg-dark-600 disabled:opacity-50 px-3 py-2 rounded border border-dark-600" 
          onClick={() => {
            resume();
            setStatusMessage('Transfer resumed');
            setTimeout(() => setStatusMessage(''), 2000);
          }}
        >
          Resume
        </button>
        <button 
          disabled={!(state === 'sending' || state === 'receiving' || state === 'paused')} 
          className="bg-accent-red-700 hover:bg-accent-red-600 disabled:opacity-50 px-3 py-2 rounded" 
          onClick={() => {
            stop();
            setStatusMessage('Transfer stopped');
            setTimeout(() => setStatusMessage(''), 2000);
          }}
        >
          Stop
        </button>
      </div>
      
      {/* Additional status info */}
      <div className="text-xs text-dark-400 pt-2 flex gap-4">
        {!fileId && (mode === 'standard' || mode === 'bcc') && (
          <span>← Upload a file to enable Start</span>
        )}
        {wsStatus !== 'connected' && (
          <span className="text-accent-orange-400">WS not connected - will auto-connect on Start</span>
        )}
      </div>
    </div>
  );
};

export default ModeControls;

