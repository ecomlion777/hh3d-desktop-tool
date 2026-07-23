/**
 * AppHeader - Desktop Top Bar with Quick Action Tools
 */

import React from 'react';
import {
  UserPlus,
  FolderPlus,
  Play,
  Square,
  RotateCw,
  Monitor,
  ShieldCheck,
  Settings,
  Search,
  Minus,
  Square as SquareFrame,
  X,
  Cpu,
  Zap
} from 'lucide-react';
import { ViewTab } from '../../types';
import { appBridge } from '../../services/appBridgeService';

interface AppHeaderProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenAddProfile: () => void;
  onOpenAddGroup: () => void;
  onRunSelectedGroup: () => void;
  onStopSelectedGroup: () => void;
  onRefreshData: () => void;
  onOpenMiniBrowser: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  runningProfilesCount: number;
  totalProfilesCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddProfile,
  onOpenAddGroup,
  onRunSelectedGroup,
  onStopSelectedGroup,
  onRefreshData,
  onOpenMiniBrowser,
  searchQuery,
  onSearchChange,
  runningProfilesCount,
  totalProfilesCount
}) => {
  return (
    <header id="app-header" className="bg-slate-900 border-b border-slate-800 text-slate-200 select-none flex flex-col shrink-0">
      {/* Window Title Bar */}
      <div className="h-8 bg-slate-950/80 px-3 flex items-center justify-between text-xs border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-[10px]">
            H
          </div>
          <span className="font-semibold text-slate-300">HH3D Desktop Tool v2.5.0</span>
          <span className="text-slate-500">|</span>
          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {typeof window !== 'undefined' && (window as any).desktopBridge ? 'Electron IPC Bridge' : 'Mock IPC Bridge'}
          </span>
          <span className="text-slate-500 text-[11px] hidden md:inline">
            Active: {runningProfilesCount}/{totalProfilesCount} Profiles
          </span>
        </div>

        {/* Window controls */}
        <div className="flex items-center space-x-1">
          <button
            title="Minimize"
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            title="Maximize"
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <SquareFrame className="w-3 h-3" />
          </button>
          <button
            title="Close"
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-red-200 hover:bg-red-600/80 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 bg-slate-900">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            id="btn-add-profile"
            onClick={onOpenAddProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium shadow-sm transition active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Profile</span>
          </button>

          <button
            id="btn-add-group"
            onClick={onOpenAddGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition active:scale-95"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Thêm Nhóm</span>
          </button>

          <div className="h-5 w-px bg-slate-800 mx-0.5 hidden sm:block"></div>

          <button
            id="btn-run-group"
            onClick={onRunSelectedGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium shadow-sm transition active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Chạy Nhóm</span>
          </button>

          <button
            id="btn-stop-group"
            onClick={onStopSelectedGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 border border-slate-700 rounded text-xs font-medium transition active:scale-95"
          >
            <Square className="w-3.5 h-3.5 text-rose-400 fill-current" />
            <span>Dừng Nhóm</span>
          </button>

          <button
            id="btn-refresh"
            onClick={onRefreshData}
            title="Làm mới dữ liệu"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition active:scale-95"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden lg:inline">Làm mới</span>
          </button>

          <div className="h-5 w-px bg-slate-800 mx-0.5 hidden sm:block"></div>

          <button
            id="btn-mini-browser"
            onClick={onOpenMiniBrowser}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition active:scale-95 ${
              currentTab === 'profiles'
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-purple-400" />
            <span>Mini Browser</span>
          </button>

          <button
            id="btn-proxy-manager"
            onClick={() => onSelectTab('proxies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition active:scale-95 ${
              currentTab === 'proxies'
                ? 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Proxy Manager</span>
          </button>

          <button
            id="btn-settings"
            onClick={() => onSelectTab('general_settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition active:scale-95 ${
              currentTab === 'general_settings'
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Cài Đặt</span>
          </button>
        </div>

        {/* Right Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            id="input-global-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo Tên, UID, Proxy, IP..."
            className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
