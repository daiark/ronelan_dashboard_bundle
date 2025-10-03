import React, { useState, useEffect, useRef } from 'react';
import { useDncStore } from '../../store/dncStore';

type LogLevel = 'all' | 'info' | 'warn' | 'error';

const LogConsole: React.FC = () => {
  const { logs, clearLogs } = useDncStore();
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);
  
  // Determine log level from message content (simple heuristic)
  const getLogLevel = (msg: string): LogLevel => {
    const lower = msg.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('exception')) return 'error';
    if (lower.includes('warn') || lower.includes('warning') || lower.includes('timeout')) return 'warn';
    return 'info';
  };
  
  const filteredLogs = logs.filter(log => {
    if (levelFilter === 'all') return true;
    return getLogLevel(log.msg) === levelFilter;
  });
  
  const getLevelColor = (msg: string): string => {
    const level = getLogLevel(msg);
    switch (level) {
      case 'error': return 'text-accent-red-400';
      case 'warn': return 'text-accent-orange-400';
      default: return 'text-dark-300';
    }
  };
  
  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-dark-100 font-semibold">Log ({filteredLogs.length}/{logs.length})</div>
        <div className="flex items-center gap-2">
          <select 
            className="bg-dark-700 text-dark-100 rounded px-2 py-1 text-xs" 
            value={levelFilter} 
            onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <button 
            className="bg-dark-700 hover:bg-dark-600 px-2 py-1 rounded border border-dark-600 text-xs" 
            onClick={clearLogs}
            disabled={logs.length === 0}
          >
            Clear
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto bg-dark-900 border border-dark-700 rounded p-2 text-xs font-mono"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-dark-500 italic">No logs{levelFilter !== 'all' ? ` (${levelFilter} level)` : ''}</div>
        ) : (
          filteredLogs.map((l, idx) => (
            <div key={idx} className={getLevelColor(l.msg)}>
              <span className="text-dark-500">[{new Date(l.ts * 1000).toLocaleTimeString()}]</span> {l.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogConsole;

