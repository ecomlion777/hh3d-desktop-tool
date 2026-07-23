/**
 * AppStatusBar - Summary Status Bar
 * Displays overall counts: Total Profiles, Running, Waiting, Proxy Error, Login Required.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  PlayCircle,
  Clock,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Radio,
  Wifi
} from 'lucide-react';
import { SystemStats } from '../../types';

interface AppStatusBarProps {
  totalProfiles?: number;
  runningCount?: number;
  waitingCount?: number;
  stoppedCount?: number;
  proxyErrorCount?: number;
  loginRequiredCount?: number;
  systemStats?: SystemStats;
  activeFilterStatus?: string | null;
  onFilterStatusChange?: (status: string | null) => void;
  runningProfilesCount?: number;
  totalProfilesCount?: number;
  activeTab?: string;
}

export const AppStatusBar: React.FC<AppStatusBarProps> = ({
  totalProfiles,
  runningCount,
  waitingCount = 0,
  stoppedCount = 0,
  proxyErrorCount = 0,
  loginRequiredCount = 0,
  systemStats,
  activeFilterStatus = null,
  onFilterStatusChange,
  runningProfilesCount,
  totalProfilesCount
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  const actualTotal = totalProfiles ?? totalProfilesCount ?? 0;
  const actualRunning = runningCount ?? runningProfilesCount ?? 0;
  const netSpeed = systemStats?.networkSpeedMbps ?? 18.5;

  useEffect(() => {
    const updateClock = () => {
      setTimeStr(new Date().toLocaleTimeString('vi-VN'));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFilterClick = (status: string | null) => {
    if (onFilterStatusChange) {
      onFilterStatusChange(status);
    }
  };

  return (
    <footer id="app-status-bar" className="h-8 bg-slate-950 border-t border-slate-800 text-slate-300 text-xs px-3 flex items-center justify-between shrink-0 select-none overflow-x-auto custom-scrollbar">
      {/* Left Summary Counts Pill Group */}
      <div className="flex items-center space-x-3 text-[11px] shrink-0">
        <button
          onClick={() => handleFilterClick(null)}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded transition ${
            activeFilterStatus === null
              ? 'bg-slate-800 text-white font-medium ring-1 ring-slate-700'
              : 'hover:bg-slate-900 text-slate-400'
          }`}
          title="Xem tất cả profile"
        >
          <Users className="w-3 h-3 text-cyan-400" />
          <span>Tổng: <strong className="text-slate-100 font-mono">{actualTotal}</strong></span>
        </button>

        <span className="text-slate-800">|</span>

        {/* Running */}
        <button
          onClick={() => handleFilterClick('running')}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded transition ${
            activeFilterStatus === 'running'
              ? 'bg-emerald-950/80 text-emerald-300 font-medium ring-1 ring-emerald-500/40'
              : 'hover:bg-slate-900 text-slate-300'
          }`}
          title="Lọc danh sách Đang Chạy"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Đang chạy: <strong className="text-emerald-400 font-mono">{actualRunning}</strong></span>
        </button>

        {/* Waiting */}
        <button
          onClick={() => handleFilterClick('waiting')}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded transition ${
            activeFilterStatus === 'waiting'
              ? 'bg-amber-950/80 text-amber-300 font-medium ring-1 ring-amber-500/40'
              : 'hover:bg-slate-900 text-slate-300'
          }`}
          title="Lọc danh sách Đang Chờ"
        >
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Đang chờ: <strong className="text-amber-400 font-mono">{waitingCount}</strong></span>
        </button>

        {/* Proxy Error */}
        <button
          onClick={() => handleFilterClick('proxy_error')}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded transition ${
            activeFilterStatus === 'proxy_error'
              ? 'bg-rose-950/80 text-rose-300 font-medium ring-1 ring-rose-500/40'
              : 'hover:bg-slate-900 text-slate-300'
          }`}
          title="Lọc danh sách Lỗi Proxy"
        >
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          <span>Lỗi proxy: <strong className="text-rose-400 font-mono">{proxyErrorCount}</strong></span>
        </button>

        {/* Login Required */}
        <button
          onClick={() => handleFilterClick('login_required')}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded transition ${
            activeFilterStatus === 'login_required'
              ? 'bg-purple-950/80 text-purple-300 font-medium ring-1 ring-purple-500/40'
              : 'hover:bg-slate-900 text-slate-300'
          }`}
          title="Lọc danh sách Cần Đăng Nhập"
        >
          <KeyRound className="w-3 h-3 text-purple-400" />
          <span>Cần đăng nhập: <strong className="text-purple-400 font-mono">{loginRequiredCount}</strong></span>
        </button>
      </div>

      {/* Right System Info & Clock */}
      <div className="flex items-center space-x-4 text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center space-x-1.5">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="font-mono text-slate-300">{netSpeed} MB/s</span>
        </div>

        <span className="text-slate-800">|</span>

        <div className="flex items-center space-x-1 font-mono text-slate-300">
          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>IPC: READY</span>
        </div>

        <span className="text-slate-800">|</span>

        <span className="font-mono text-slate-200 font-medium">{timeStr}</span>
      </div>
    </footer>
  );
};
