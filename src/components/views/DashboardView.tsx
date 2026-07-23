/**
 * DashboardView - Overview Analytics & Live System Ticker
 */

import React from 'react';
import {
  Users,
  PlayCircle,
  Clock,
  AlertTriangle,
  KeyRound,
  Shield,
  Activity,
  Layers,
  Terminal,
  ArrowUpRight,
  Sparkles,
  Zap,
  Edit2,
  Trash2
} from 'lucide-react';
import { Profile, GroupItem, LogEntry, SystemStats, ViewTab } from '../../types';

interface DashboardViewProps {
  profiles: Profile[];
  groups: GroupItem[];
  logs: LogEntry[];
  systemStats: SystemStats;
  onNavigate: (tab: ViewTab) => void;
  onRunGroup: (groupName: string) => void;
  onStopGroup: (groupName: string) => void;
  onOpenMiniBrowser: (profile: Profile) => void;
  onEditGroup?: (group: GroupItem) => void;
  onDeleteGroup?: (group: GroupItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profiles,
  groups,
  logs,
  systemStats,
  onNavigate,
  onRunGroup,
  onStopGroup,
  onOpenMiniBrowser,
  onEditGroup,
  onDeleteGroup
}) => {
  const total = profiles.length;
  const running = profiles.filter(p => p.status === 'running').length;
  const waiting = profiles.filter(p => p.status === 'waiting').length;
  const stopped = profiles.filter(p => p.status === 'stopped').length;
  const proxyError = profiles.filter(p => p.status === 'proxy_error').length;
  const loginRequired = profiles.filter(p => p.status === 'login_required').length;

  const runningPercent = total > 0 ? Math.round((running / total) * 100) : 0;

  return (
    <div id="view-dashboard" className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full text-slate-200">
      
      {/* Top Banner Widget */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              ELECTRON CORE ONLINE
            </span>
            <span className="text-xs text-slate-400">HH3D Auto-Automation Framework</span>
          </div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            Tổng Quan Hệ Thống Quản Lý Đa Tài Khoản
          </h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Đang giám sát và tự động điều phối <strong className="text-cyan-300 font-mono">{total} profiles</strong> chia làm{' '}
            <strong className="text-emerald-300 font-mono">{groups.length} nhóm</strong> hoạt động thông qua <strong className="text-amber-300 font-mono">40 SOCKS5 Proxy</strong> độc lập.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <button
            onClick={() => onNavigate('profiles')}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow transition flex items-center gap-2"
          >
            <span>Vào Bảng Profile Manager</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tổng Profile</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-slate-100">{total}</span>
          </div>
          <div className="text-[10px] text-slate-500">100% dung lượng</div>
        </div>

        {/* Running Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Đang Chạy</span>
            <PlayCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{running}</span>
            <span className="text-xs text-emerald-500 font-mono font-semibold">({runningPercent}%)</span>
          </div>
          <div className="text-[10px] text-emerald-500/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Hoạt động ổn định
          </div>
        </div>

        {/* Waiting Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Đang Chờ</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-amber-400">{waiting}</span>
          </div>
          <div className="text-[10px] text-slate-500">Chờ hồi thể lực / Task</div>
        </div>

        {/* Proxy Error Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-rose-500/30 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Lỗi Proxy</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-rose-400">{proxyError}</span>
          </div>
          <div className="text-[10px] text-slate-500">Cần kiểm tra lại kết nối</div>
        </div>

        {/* Login Required Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-purple-500/30 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Cần Đăng Nhập</span>
            <KeyRound className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold font-mono text-purple-400">{loginRequired}</span>
          </div>
          <div className="text-[10px] text-slate-500">Hết hạn session token</div>
        </div>
      </div>

      {/* Main Grid Section: Group Cards & Live Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Groups Execution Overview (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Trạng Thái Nhóm Profile</h2>
            </div>
            <button
              onClick={() => onNavigate('profiles')}
              className="text-xs text-cyan-400 hover:underline font-medium"
            >
              Quản lý tất cả nhóm →
            </button>
          </div>

          <div className="space-y-2.5">
            {groups.map(group => {
              const runRatio = group.profileCount > 0 ? Math.round((group.runningCount / group.profileCount) * 100) : 0;
              return (
                <div key={group.id} className="p-3 bg-slate-950 rounded border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }}></span>
                      <span className="font-bold text-xs text-slate-200">{group.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">
                        ({group.runningCount}/{group.profileCount} profiles)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{group.description}</p>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1 border border-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${runRatio}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Group Action Buttons */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => onRunGroup(group.name)}
                      className="px-2 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded text-xs font-medium transition"
                    >
                      Chạy
                    </button>
                    <button
                      onClick={() => onStopGroup(group.name)}
                      className="px-2 py-1 bg-slate-800 text-slate-400 border border-slate-700 hover:bg-rose-950 hover:text-rose-300 rounded text-xs font-medium transition"
                    >
                      Dừng
                    </button>
                    {onEditGroup && (
                      <button
                        onClick={() => onEditGroup(group)}
                        className="p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-cyan-400 rounded transition"
                        title="Chỉnh Sửa Nhóm"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteGroup && (
                      <button
                        onClick={() => onDeleteGroup(group)}
                        className="p-1 bg-slate-800 text-slate-400 hover:bg-rose-900/60 hover:text-rose-300 rounded transition"
                        title="Xóa Nhóm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live System Log Ticker (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Nhật Ký Tự Động</h2>
            </div>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-cyan-400 hover:underline font-medium"
            >
              Xem tất cả →
            </button>
          </div>

          {/* Log Stream Box */}
          <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded p-2.5 space-y-2 overflow-y-auto max-h-[320px] custom-scrollbar text-[11px] font-mono">
            {logs.slice(0, 15).map((log) => {
              const levelColor =
                log.level === 'success'
                  ? 'text-emerald-400'
                  : log.level === 'warn'
                  ? 'text-amber-400'
                  : log.level === 'error'
                  ? 'text-rose-400'
                  : 'text-slate-300';

              return (
                <div key={log.id} className="border-b border-slate-800/40 pb-1.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{log.timestamp}</span>
                    <span className="uppercase text-cyan-500">{log.source}</span>
                  </div>
                  <div className={levelColor}>{log.message}</div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Quick Active Profiles Grid Spotlight */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h2 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Top Account Đang Hoạt Động</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Top 8 Profiles</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {profiles.filter(p => p.status === 'running').slice(0, 8).map(p => (
            <div
              key={p.id}
              className="bg-slate-950 p-3 rounded border border-slate-800 hover:border-cyan-500/40 transition flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded bg-slate-800 border border-slate-700 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-200 truncate">{p.characterName}</div>
                  <div className="text-[10px] font-mono text-cyan-400 truncate">{p.uid}</div>
                  <div className="text-[10px] text-slate-400 truncate">{p.currentActivity}</div>
                </div>
              </div>

              <button
                onClick={() => onOpenMiniBrowser(p)}
                className="p-1.5 bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 rounded transition shrink-0 ml-1"
                title="Mở Mini Browser"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
