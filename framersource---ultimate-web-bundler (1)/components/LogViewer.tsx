
import React from 'react';
import { ScrapeLog } from '../types';

interface LogViewerProps {
  logs: ScrapeLog[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Activity Feed</h3>
        {logs.length > 0 && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>}
      </div>
      <div 
        ref={scrollRef}
        className="flex-grow overflow-y-auto space-y-3 font-mono text-sm text-gray-400 pr-2 custom-scrollbar"
      >
        {logs.map((log) => (
          <div key={log.timestamp} className="flex gap-4 items-start animate-fade-in py-1 border-b border-white/5">
            <span className="text-gray-600 whitespace-nowrap text-xs pt-1">
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-emerald-400' : 
              log.type === 'warning' ? 'text-amber-400' : 
              'text-gray-300'
            }>
              <span className="opacity-50 mr-2">➜</span>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 text-center py-12">
            <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="italic">Waiting for input URL...</p>
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
};

export default LogViewer;
