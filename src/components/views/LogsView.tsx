/**
 * LogsView - Comprehensive Event Log Console
 */

import React, { useState } from 'react';
import { Terminal, Trash2, Download, Search, Filter, RefreshCw } from 'lucide-react';
import { LogEntry } from '../../types';

interface LogsViewProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onClearLogs }) => {
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchUid = log.profileUid?.toLowerCase().includes(q);
      const matchName = log.profileName?.toLowerCase().includes(q);
      const matchSrc = log.source.toLowerCase().includes(q);
      if (!matchMsg && !matchUid && !matchName && !matchSrc) return false;
    }
    return true;
  });

  const handleExportLogs = () => {
    const textContent = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HH3D_System_Logs_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="view-logs" className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden select-none">
      
      {/* Header Toolbar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100">Nhật Ký Lịch Sử Hệ Thống (Logs Console)</h2>
            <p className="text-xs text-slate-400">Ghi nhận toàn bộ sự kiện tài khoản, lỗi proxy, và lệnh IPC</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportLogs}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition flex items-center gap-1.5 font-medium"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tải Logs (.TXT)</span>
          </button>

          <button
            onClick={onClearLogs}
            className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded transition flex items-center gap-1.5 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa Sạch Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
        <div className="flex items-center space-x-1">
          {['all', 'info', 'success', 'warn', 'error'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1 rounded font-medium uppercase text-[11px] transition ${
                levelFilter === lvl
                  ? 'bg-slate-700 text-white font-bold border border-slate-600'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl === 'all' ? 'Tất cả' : lvl}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm theo UID, tên, nội dung..."
            className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
          />
        </div>
      </div>

      {/* Main Console Body */}
      <div className="flex-1 bg-slate-950 p-4 font-mono text-xs overflow-y-auto custom-scrollbar space-y-1.5 border-t border-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Không có nhật ký nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredLogs.map(log => {
            const levelColor =
              log.level === 'success'
                ? 'text-emerald-400 border-emerald-900/40'
                : log.level === 'warn'
                ? 'text-amber-400 border-amber-900/40'
                : log.level === 'error'
                ? 'text-rose-400 border-rose-900/40'
                : 'text-slate-300 border-slate-800/60';

            return (
              <div
                key={log.id}
                className={`p-2 rounded bg-slate-900/80 border ${levelColor} flex flex-col md:flex-row md:items-center justify-between gap-1 leading-relaxed`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 text-[11px] shrink-0">[{log.timestamp}]</span>
                  <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 shrink-0">
                    {log.source}
                  </span>
                  {log.profileUid && (
                    <span className="text-cyan-400 font-bold shrink-0">[{log.profileUid}]</span>
                  )}
                  <span className="truncate">{log.message}</span>
                </div>

                <span className="uppercase text-[10px] font-bold self-end md:self-auto shrink-0">
                  {log.level}
                </span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
