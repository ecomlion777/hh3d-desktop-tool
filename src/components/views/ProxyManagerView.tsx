/**
 * ProxyManagerView - Complete Proxy Management Interface
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Search,
  Users,
  Eye,
  EyeOff,
  Clock,
  HelpCircle,
  Loader2,
  Key,
  Network
} from 'lucide-react';
import { ProxyItem, Profile } from '../../types';
import { AssignProfilesToProxyModal } from '../modals/AssignProfilesToProxyModal';

interface ProxyManagerViewProps {
  proxies: ProxyItem[];
  profiles: Profile[];
  onTestProxy: (id: string) => void;
  onTestAllProxies: () => void;
  onOpenAddProxyModal: () => void;
  onDeleteProxies: (ids: string[]) => void;
  onAssignProfilesToProxy: (proxyId: string, profileIds: string[]) => Promise<void>;
}

export const ProxyManagerView: React.FC<ProxyManagerViewProps> = ({
  proxies,
  profiles,
  onTestProxy,
  onTestAllProxies,
  onOpenAddProxyModal,
  onDeleteProxies,
  onAssignProfilesToProxy
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'slow' | 'offline' | 'unknown' | 'warning'>('all');
  
  // State for toggling password visibility per proxy
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});

  // State for AssignProfilesToProxyModal
  const [assignModalProxy, setAssignModalProxy] = useState<ProxyItem | null>(null);

  const togglePasswordVisibility = (proxyId: string) => {
    setVisiblePasswordIds(prev => ({
      ...prev,
      [proxyId]: !prev[proxyId]
    }));
  };

  // Compute active running profiles per proxy
  const activeRunningCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    profiles.forEach(p => {
      if (p.proxyId && p.status === 'running') {
        map[p.proxyId] = (map[p.proxyId] || 0) + 1;
      }
    });
    return map;
  }, [profiles]);

  // Compute total profiles per proxy
  const totalAssignedCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    profiles.forEach(p => {
      if (p.proxyId) {
        map[p.proxyId] = (map[p.proxyId] || 0) + 1;
      }
    });
    return map;
  }, [profiles]);

  // Status counts for filter pills
  const counts = useMemo(() => {
    let online = 0;
    let slow = 0;
    let offline = 0;
    let unknown = 0;
    let warning = 0;

    proxies.forEach(px => {
      const activeRunningCount = activeRunningCountsMap[px.id] || 0;
      if (activeRunningCount > 1) {
        warning++;
      }

      if (px.status === 'online' || (px.status === 'active' && px.latencyMs > 0 && px.latencyMs < 150)) {
        online++;
      } else if (px.status === 'slow' || (px.status === 'active' && px.latencyMs >= 150)) {
        slow++;
      } else if (px.status === 'offline' || px.status === 'error') {
        offline++;
      } else if (px.status === 'checking' || px.status === 'testing') {
        // counted in checking
      } else {
        unknown++;
      }
    });

    return { online, slow, offline, unknown, warning };
  }, [proxies, activeRunningCountsMap]);

  // Filter proxies
  const filtered = useMemo(() => {
    return proxies.filter(px => {
      // 1. Text filter
      if (filterText.trim()) {
        const q = filterText.toLowerCase();
        const matchesName = px.name?.toLowerCase().includes(q);
        const matchesIp = px.ipPort?.toLowerCase().includes(q) || px.host?.toLowerCase().includes(q);
        const matchesLoc = px.location?.toLowerCase().includes(q);
        const matchesUser = px.username?.toLowerCase().includes(q);
        if (!matchesName && !matchesIp && !matchesLoc && !matchesUser) return false;
      }

      // 2. Status filter
      if (statusFilter === 'all') return true;

      const activeRunningCount = activeRunningCountsMap[px.id] || 0;
      if (statusFilter === 'warning') {
        return activeRunningCount > 1;
      }

      if (statusFilter === 'online') {
        return px.status === 'online' || (px.status === 'active' && px.latencyMs > 0 && px.latencyMs < 150);
      }
      if (statusFilter === 'slow') {
        return px.status === 'slow' || (px.status === 'active' && px.latencyMs >= 150);
      }
      if (statusFilter === 'offline') {
        return px.status === 'offline' || px.status === 'error';
      }
      if (statusFilter === 'unknown') {
        return px.status === 'unknown' || (px.status !== 'online' && px.status !== 'active' && px.status !== 'slow' && px.status !== 'offline' && px.status !== 'error' && px.status !== 'checking' && px.status !== 'testing');
      }

      return true;
    });
  }, [proxies, filterText, statusFilter, activeRunningCountsMap]);

  const isAllSelected = filtered.length > 0 && filtered.every(px => selectedIds.includes(px.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(px => px.id));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div id="view-proxy-manager" className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden select-none">
      
      {/* Top Header Controls */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>Proxy Manager</span>
              <span className="text-xs font-mono font-normal text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                {proxies.length} Proxies Loaded
              </span>
            </h2>
            <p className="text-xs text-slate-400">Quản lý, phân bổ IP độc lập và kiểm tra latency kết nối cho từng profile game</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onTestAllProxies}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Kiểm Tra Tốc Độ Tất Cả</span>
          </button>

          <button
            onClick={onOpenAddProxyModal}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Thêm / Import Proxy</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                if (confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} proxy đã chọn?`)) {
                  onDeleteProxies(selectedIds);
                  setSelectedIds([]);
                }
              }}
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded text-xs font-medium transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter bar & status pills */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Lọc IP, Port, Vị trí, User..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === 'all' ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tất cả ({proxies.length})
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                statusFilter === 'online' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Online ({counts.online})
            </button>
            <button
              onClick={() => setStatusFilter('slow')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                statusFilter === 'slow' ? 'bg-amber-950 text-amber-300 font-bold border border-amber-800' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Slow ({counts.slow})
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                statusFilter === 'offline' ? 'bg-rose-950 text-rose-300 font-bold border border-rose-800' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Offline ({counts.offline})
            </button>
            <button
              onClick={() => setStatusFilter('unknown')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                statusFilter === 'unknown' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chưa test ({counts.unknown})
            </button>
            {counts.warning > 0 && (
              <button
                onClick={() => setStatusFilter('warning')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                  statusFilter === 'warning' ? 'bg-amber-950 text-amber-300 font-bold border border-amber-700' : 'text-amber-400 hover:bg-amber-950/40'
                }`}
              >
                ⚠️ Trùng IP Running ({counts.warning})
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Hiển thị: <strong className="text-amber-400">{filtered.length}</strong> / {proxies.length} Proxy
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1000px]">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800 text-[11px]">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-amber-600 focus:ring-0 w-3.5 h-3.5"
                />
              </th>
              <th className="p-3 font-semibold">Tên Proxy</th>
              <th className="p-3 font-mono">IP : Port</th>
              <th className="p-3 font-mono">Giao Thức</th>
              <th className="p-3">Trạng Thái</th>
              <th className="p-3 font-mono">Ping (Latency)</th>
              <th className="p-3">Vị Trí Vùng</th>
              <th className="p-3 font-mono">Tài Khoản / Mật Khẩu</th>
              <th className="p-3 font-mono text-center">Profile Gán</th>
              <th className="p-3 text-center">Thao Tác</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500 text-xs">
                  Không tìm thấy proxy phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              filtered.map((px) => {
                const assignedCount = totalAssignedCountsMap[px.id] || px.assignedProfilesCount || 0;
                const activeRunningCount = activeRunningCountsMap[px.id] || px.activeRunningProfilesCount || 0;
                const isWarningActive = activeRunningCount > 1;

                const isPasswordVisible = visiblePasswordIds[px.id] || false;
                const plainPassword = px.password || (px.passwordEncrypted ? 'secret_password' : '');

                return (
                  <tr 
                    key={px.id} 
                    className={`hover:bg-slate-800/80 transition ${
                      isWarningActive ? 'bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(px.id)}
                        onChange={() => toggleRow(px.id)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-600 focus:ring-0 w-3.5 h-3.5"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{px.name}</span>
                        {isWarningActive && (
                          <span 
                            title={`Cảnh báo: Có ${activeRunningCount} profile đang chạy đồng thời trên proxy này!`}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-bold flex items-center gap-1 shrink-0"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Trùng {activeRunningCount} Active IP</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-amber-300 font-semibold">{px.ipPort || `${px.host}:${px.port}`}</td>
                    <td className="p-3 font-mono text-slate-400 text-[11px]">{px.protocol}</td>

                    {/* Status column with Unknown, Checking, Online, Slow, Offline */}
                    <td className="p-3">
                      {px.status === 'online' || (px.status === 'active' && px.latencyMs > 0 && px.latencyMs < 150) ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Online</span>
                        </span>
                      ) : px.status === 'slow' || (px.status === 'active' && px.latencyMs >= 150) ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Slow</span>
                        </span>
                      ) : px.status === 'checking' || px.status === 'testing' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse">
                          <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                          <span>Checking...</span>
                        </span>
                      ) : px.status === 'offline' || px.status === 'error' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>Offline</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <HelpCircle className="w-3 h-3 text-slate-500" />
                          <span>Unknown</span>
                        </span>
                      )}
                    </td>

                    {/* Ping column */}
                    <td className="p-3 font-mono font-bold">
                      {px.status === 'checking' || px.status === 'testing' ? (
                        <span className="text-cyan-400 text-[11px] italic">Đang đo...</span>
                      ) : px.latencyMs > 0 || (px.ping && px.ping > 0) ? (
                        <span className={(px.latencyMs || px.ping || 0) < 150 ? 'text-emerald-400' : 'text-amber-400'}>
                          {px.latencyMs || px.ping} ms
                        </span>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>

                    <td className="p-3 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{px.location || 'Chưa định vị'}</span>
                      </div>
                    </td>

                    {/* Username & Masked Password column */}
                    <td className="p-3 font-mono text-[11px]">
                      {px.username ? (
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <span className="text-slate-200">{px.username}</span>
                          <span className="text-slate-600">:</span>
                          <span className="text-amber-400 font-semibold">
                            {isPasswordVisible ? (plainPassword || '••••••••') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(px.id)}
                            className="p-0.5 text-slate-500 hover:text-slate-300 transition rounded"
                            title={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {isPasswordVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Không có xác thực</span>
                      )}
                    </td>

                    {/* Profile count & Assign action */}
                    <td className="p-3 font-mono text-center">
                      <button
                        onClick={() => setAssignModalProxy(px)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 transition text-xs"
                      >
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span><strong>{assignedCount}</strong> profiles</span>
                        {activeRunningCount > 0 && (
                          <span className="text-[10px] text-emerald-400 font-bold">({activeRunningCount} running)</span>
                        )}
                      </button>
                    </td>

                    {/* Actions column */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => onTestProxy(px.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3 text-amber-400" />
                          <span>Test Speed</span>
                        </button>

                        <button
                          onClick={() => setAssignModalProxy(px)}
                          className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded text-xs transition flex items-center gap-1"
                        >
                          <Network className="w-3 h-3 text-amber-400" />
                          <span>Gán Profile</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Profiles Modal */}
      <AssignProfilesToProxyModal
        isOpen={!!assignModalProxy}
        onClose={() => setAssignModalProxy(null)}
        proxy={assignModalProxy}
        profiles={profiles}
        onSubmit={onAssignProfilesToProxy}
      />
    </div>
  );
};
