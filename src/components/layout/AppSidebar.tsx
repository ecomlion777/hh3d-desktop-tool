/**
 * AppSidebar - Left Navigation Sidebar & Group Manager Panel
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  Layers,
  Sliders,
  Terminal,
  Settings,
  Folder,
  FolderPlus,
  Activity,
  Cpu,
  HardDrive,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { ViewTab, GroupItem, SystemStats } from '../../types';

interface AppSidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  groups: GroupItem[];
  selectedGroup: string | null;
  onSelectGroup: (groupName: string | null) => void;
  onOpenAddGroup: () => void;
  systemStats: SystemStats;
  totalProfilesCount: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  groups,
  selectedGroup,
  onSelectGroup,
  onOpenAddGroup,
  systemStats,
  totalProfilesCount
}) => {
  const mainNavItems = [
    { id: 'dashboard' as ViewTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profiles' as ViewTab, label: 'Profile Manager', icon: Users, badge: totalProfilesCount },
    { id: 'proxies' as ViewTab, label: 'Proxy Manager', icon: Shield },
    { id: 'batches' as ViewTab, label: 'Batch Manager', icon: Layers },
    { id: 'activity_settings' as ViewTab, label: 'Activity Settings', icon: Sliders },
    { id: 'logs' as ViewTab, label: 'Nhật Ký Logs', icon: Terminal },
    { id: 'general_settings' as ViewTab, label: 'General Settings', icon: Settings },
  ];

  return (
    <aside id="app-sidebar" className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col shrink-0 select-none h-full overflow-hidden">
      {/* Sidebar Header Title */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">HH3D DESKTOP</h2>
            <p className="text-[10px] text-slate-400">Multi-Account Suite</p>
          </div>
        </div>
      </div>

      {/* Main Navigation Section */}
      <div className="px-2 py-3 border-b border-slate-800/80 space-y-0.5">
        <div className="px-2 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          MENU CHÍNH
        </div>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition ${
                isActive
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                  isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Groups List Section */}
      <div className="flex-1 px-2 py-3 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="px-2 mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            NHÓM PROFILE ({groups.length})
          </span>
          <button
            onClick={onOpenAddGroup}
            title="Thêm Nhóm Mới"
            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* All Groups Button */}
        <button
          onClick={() => {
            onSelectGroup(null);
            if (currentTab !== 'profiles') onSelectTab('profiles');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 mb-1 rounded text-xs font-medium transition ${
            selectedGroup === null && currentTab === 'profiles'
              ? 'bg-slate-800 text-white font-semibold border border-slate-700'
              : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            <span>Tất cả các nhóm</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">({totalProfilesCount})</span>
        </button>

        <div className="space-y-0.5">
          {groups.map((group) => {
            const isGroupSelected = selectedGroup === group.name && currentTab === 'profiles';
            return (
              <button
                key={group.id}
                onClick={() => {
                  onSelectGroup(group.name);
                  if (currentTab !== 'profiles') onSelectTab('profiles');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition ${
                  isGroupSelected
                    ? 'bg-slate-800/90 text-slate-100 font-semibold border-l-2'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
                style={{ borderLeftColor: isGroupSelected ? group.color : 'transparent' }}
              >
                <div className="flex items-center space-x-2 min-w-0 pr-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  ></span>
                  <span className="truncate text-left">{group.name}</span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  {group.runningCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title={`${group.runningCount} đang chạy`}></span>
                  )}
                  <span className="text-[10px] font-mono text-slate-500">
                    {group.runningCount}/{group.profileCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resource Performance Monitor Footer */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 text-slate-400 space-y-2">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>HỆ THỐNG DESKTOP</span>
          <Activity className="w-3 h-3 text-cyan-400" />
        </div>

        {/* CPU usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-slate-400">
              <Cpu className="w-3 h-3 text-emerald-400" />
              CPU Load
            </span>
            <span className="font-mono text-slate-200 font-medium">{systemStats.cpuUsage}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                systemStats.cpuUsage > 80 ? 'bg-rose-500' : systemStats.cpuUsage > 50 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${systemStats.cpuUsage}%` }}
            ></div>
          </div>
        </div>

        {/* RAM usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-slate-400">
              <HardDrive className="w-3 h-3 text-cyan-400" />
              RAM
            </span>
            <span className="font-mono text-slate-200 font-medium">
              {systemStats.ramUsageGb} / {systemStats.ramTotalGb} GB
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${(systemStats.ramUsageGb / systemStats.ramTotalGb) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </aside>
  );
};
