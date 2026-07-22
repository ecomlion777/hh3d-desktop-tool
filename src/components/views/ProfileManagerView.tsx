/**
 * ProfileManagerView - Primary Interactive Profile Table
 * Displays profiles with complete columns, bulk actions, status filters, search, pagination & full modals.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Users,
  Play,
  Square,
  Monitor,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  AlertTriangle,
  KeyRound,
  FolderPlus,
  Network,
  Layers,
  FileJson,
  Download,
  UserPlus
} from 'lucide-react';
import { Profile, ProfileStatus, GroupItem, ProxyItem } from '../../types';

import { EditProfileModal } from '../modals/EditProfileModal';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { AssignGroupModal } from '../modals/AssignGroupModal';
import { AssignProxyModal } from '../modals/AssignProxyModal';
import { ToggleModulesModal } from '../modals/ToggleModulesModal';
import { ImportProfilesModal } from '../modals/ImportProfilesModal';

interface ProfileManagerViewProps {
  profiles: Profile[];
  groups: GroupItem[];
  proxies: ProxyItem[];
  selectedGroup: string | null;
  onSelectGroup: (groupName: string | null) => void;
  statusFilter: string | null;
  onSelectStatusFilter: (status: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleProfileRun: (id: string) => void;
  onStartSelectedProfiles: (ids: string[]) => void;
  onStopSelectedProfiles: (ids: string[]) => void;
  onDeleteSelectedProfiles: (ids: string[]) => void;
  onOpenMiniBrowser: (profile: Profile) => void;
  onOpenProfileSettings: (profile: Profile) => void;
  onOpenAddProfile: () => void;
  onUpdateProfile: (id: string, updatedData: Partial<Profile>) => Promise<void>;
  onAssignGroupForSelected: (ids: string[], groupName: string) => Promise<void>;
  onAssignProxyForSelected: (ids: string[], proxyId: string) => Promise<void>;
  onToggleModulesForSelected: (ids: string[], enabledModules: string[]) => Promise<void>;
  onImportProfilesFromJSON: (importedProfiles: Partial<Profile>[]) => Promise<void>;
}

// Status Badge Helper Component
const StatusBadge = React.memo<{ status: ProfileStatus }>(({ status }) => {
  switch (status) {
    case 'running':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Đang Chạy
        </span>
      );
    case 'waiting':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/80">
          <Clock className="w-3 h-3 text-amber-400" />
          Đang Chờ
        </span>
      );
    case 'stopped':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          <Square className="w-2.5 h-2.5 fill-current" />
          Đã Dừng
        </span>
      );
    case 'proxy_error':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800/80">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          Lỗi Proxy
        </span>
      );
    case 'login_required':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/80">
          <KeyRound className="w-3 h-3 text-purple-400" />
          Cần Đăng Nhập
        </span>
      );
    default:
      return null;
  }
});
StatusBadge.displayName = 'StatusBadge';

// Memoized Table Row Component
interface ProfileTableRowProps {
  profile: Profile;
  isChecked: boolean;
  onToggleSelectRow: (id: string) => void;
  onToggleProfileRun: (id: string) => void;
  onOpenMiniBrowser: (profile: Profile) => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteSingleProfile: (profile: Profile) => void;
}

const ProfileTableRow = React.memo<ProfileTableRowProps>(({
  profile: p,
  isChecked,
  onToggleSelectRow,
  onToggleProfileRun,
  onOpenMiniBrowser,
  onEditProfile,
  onDeleteSingleProfile
}) => {
  return (
    <tr
      className={`hover:bg-slate-800/80 transition ${
        isChecked ? 'bg-cyan-950/30' : ''
      }`}
    >
      {/* Checkbox */}
      <td className="p-3 text-center">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleSelectRow(p.id)}
          className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
        />
      </td>

      {/* STT */}
      <td className="p-3 text-center font-mono text-slate-500 text-[11px]">{p.stt}</td>

      {/* Avatar */}
      <td className="p-3 text-center">
        <img
          src={p.avatarUrl}
          alt=""
          className="w-7 h-7 rounded bg-slate-800 border border-slate-700 mx-auto"
        />
      </td>

      {/* Character Name */}
      <td className="p-3 font-bold text-slate-100">
        <div className="flex items-center space-x-1.5">
          <span>{p.characterName || p.displayName}</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono">
            Lv.{p.level || 70}
          </span>
        </div>
      </td>

      {/* UID */}
      <td className="p-3 font-mono text-cyan-400 font-semibold">{p.uid}</td>

      {/* Nhóm */}
      <td className="p-3">
        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
          {p.group}
        </span>
      </td>

      {/* Proxy */}
      <td className="p-3 font-mono text-slate-400 text-[11px]">{p.proxyAddress}</td>

      {/* IP */}
      <td className="p-3 font-mono text-emerald-400 text-[11px]">{p.currentIp}</td>

      {/* Status */}
      <td className="p-3">
        <StatusBadge status={p.status} />
      </td>

      {/* Current Activity */}
      <td className="p-3 text-slate-300 max-w-[180px] truncate" title={p.currentActivity}>
        {p.currentActivity}
      </td>

      {/* Next Run Time */}
      <td className="p-3 font-mono text-slate-400 text-[11px]">{p.nextRunTime}</td>

      {/* Action Buttons */}
      <td className="p-3 text-center">
        <div className="flex items-center justify-center space-x-1">
          {/* Start / Stop Toggle */}
          {p.status === 'running' ? (
            <button
              onClick={() => onToggleProfileRun(p.id)}
              className="p-1.5 bg-rose-950 hover:bg-rose-800 text-rose-300 border border-rose-800 rounded transition"
              title="Dừng profile"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => onToggleProfileRun(p.id)}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
              title="Bắt đầu chạy profile"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {/* Mini Browser */}
          <button
            onClick={() => onOpenMiniBrowser(p)}
            className="p-1.5 bg-slate-800 hover:bg-purple-600 hover:text-white text-purple-300 border border-slate-700 rounded transition"
            title="Mở Mini Browser"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          {/* Edit Settings */}
          <button
            onClick={() => onEditProfile(p)}
            className="p-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 border border-slate-700 rounded transition"
            title="Chỉnh sửa profile"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Delete Single */}
          <button
            onClick={() => onDeleteSingleProfile(p)}
            className="p-1.5 bg-slate-800 hover:bg-rose-900 hover:text-rose-200 text-slate-400 border border-slate-700 rounded transition"
            title="Xóa profile"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});
ProfileTableRow.displayName = 'ProfileTableRow';

export const ProfileManagerView: React.FC<ProfileManagerViewProps> = ({
  profiles,
  groups,
  proxies,
  selectedGroup,
  onSelectGroup,
  statusFilter,
  onSelectStatusFilter,
  searchQuery,
  onSearchChange,
  onToggleProfileRun,
  onStartSelectedProfiles,
  onStopSelectedProfiles,
  onDeleteSelectedProfiles,
  onOpenMiniBrowser,
  onOpenAddProfile,
  onUpdateProfile,
  onAssignGroupForSelected,
  onAssignProxyForSelected,
  onToggleModulesForSelected,
  onImportProfilesFromJSON
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals local state
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleteTargetNames, setDeleteTargetNames] = useState<string[]>([]);

  const [isAssignGroupOpen, setIsAssignGroupOpen] = useState(false);
  const [isAssignProxyOpen, setIsAssignProxyOpen] = useState(false);
  const [isToggleModulesOpen, setIsToggleModulesOpen] = useState(false);
  const [isImportJsonOpen, setIsImportJsonOpen] = useState(false);

  // Memoized Status Counts for Filter Badges
  const statusCounts = useMemo(() => {
    let running = 0;
    let waiting = 0;
    let stopped = 0;
    let proxyError = 0;
    let loginRequired = 0;

    for (let i = 0; i < profiles.length; i++) {
      const st = profiles[i].status;
      if (st === 'running') running++;
      else if (st === 'waiting') waiting++;
      else if (st === 'stopped') stopped++;
      else if (st === 'proxy_error') proxyError++;
      else if (st === 'login_required') loginRequired++;
    }

    return { total: profiles.length, running, waiting, stopped, proxyError, loginRequired };
  }, [profiles]);

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter(p => {
      // Group filter
      if (selectedGroup && p.group !== selectedGroup) return false;
      
      // Status filter
      if (statusFilter && p.status !== statusFilter) return false;

      // Search query
      if (q) {
        const matchName = (p.characterName || p.displayName || '').toLowerCase().includes(q);
        const matchUid = (p.uid || '').toLowerCase().includes(q);
        const matchProxy = (p.proxyAddress || '').toLowerCase().includes(q);
        const matchIp = (p.currentIp || '').toLowerCase().includes(q);
        const matchGroup = (p.group || '').toLowerCase().includes(q);
        if (!matchName && !matchUid && !matchProxy && !matchIp && !matchGroup) {
          return false;
        }
      }

      return true;
    });
  }, [profiles, selectedGroup, statusFilter, searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredProfiles.length / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  
  const paginatedProfiles = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredProfiles.slice(start, start + pageSize);
  }, [filteredProfiles, safePage, pageSize]);

  // Set lookup for selected IDs
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Checkbox handlers
  const isAllSelected = paginatedProfiles.length > 0 && paginatedProfiles.every(p => selectedSet.has(p.id));

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      const currentPageIds = new Set(paginatedProfiles.map(p => p.id));
      setSelectedIds(prev => prev.filter(id => !currentPageIds.has(id)));
    } else {
      const currentPageIds = paginatedProfiles.map(p => p.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
    }
  }, [isAllSelected, paginatedProfiles]);

  const handleToggleSelectRow = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllInFiltered = useCallback(() => {
    setSelectedIds(filteredProfiles.map(p => p.id));
  }, [filteredProfiles]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Delete modal triggers
  const triggerSingleDelete = useCallback((p: Profile) => {
    setDeleteTargetIds([p.id]);
    setDeleteTargetNames([`${p.characterName || p.displayName} (${p.uid})`]);
    setIsConfirmDeleteOpen(true);
  }, []);

  const triggerBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    const names = profiles
      .filter(p => selectedIds.includes(p.id))
      .map(p => `${p.characterName || p.displayName} (${p.uid})`);
    setDeleteTargetIds(selectedIds);
    setDeleteTargetNames(names);
    setIsConfirmDeleteOpen(true);
  }, [selectedIds, profiles]);

  const handleConfirmDelete = useCallback(() => {
    onDeleteSelectedProfiles(deleteTargetIds);
    setSelectedIds(prev => prev.filter(id => !deleteTargetIds.includes(id)));
    setDeleteTargetIds([]);
    setDeleteTargetNames([]);
  }, [deleteTargetIds, onDeleteSelectedProfiles]);

  // Export JSON handler
  const handleExportJSON = useCallback((selectedOnly: boolean) => {
    const targetProfiles = selectedOnly && selectedIds.length > 0
      ? profiles.filter(p => selectedIds.includes(p.id))
      : filteredProfiles;

    if (targetProfiles.length === 0) {
      alert('Không có profile nào để export!');
      return;
    }

    const exportData = targetProfiles.map(p => ({
      id: p.id,
      uid: p.uid,
      characterName: p.characterName || p.displayName,
      group: p.group,
      proxyId: p.proxyId,
      proxyAddress: p.proxyAddress,
      currentIp: p.currentIp,
      status: p.status,
      level: p.level,
      stamina: p.stamina,
      enabledModules: p.enabledModules,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hh3d_profiles_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedIds, profiles, filteredProfiles]);

  return (
    <div id="view-profile-manager" className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden select-none">
      
      {/* Top Filter & Toolbar Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            onClick={() => onSelectStatusFilter(null)}
            className={`px-3 py-1.5 rounded font-medium transition ${
              statusFilter === null
                ? 'bg-cyan-600 text-white font-semibold shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            Tất Cả ({statusCounts.total})
          </button>
          
          <button
            onClick={() => onSelectStatusFilter('running')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'running'
                ? 'bg-emerald-600 text-white font-semibold shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Running ({statusCounts.running})</span>
          </button>

          <button
            onClick={() => onSelectStatusFilter('waiting')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'waiting'
                ? 'bg-amber-600 text-white font-semibold shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Waiting ({statusCounts.waiting})</span>
          </button>

          <button
            onClick={() => onSelectStatusFilter('stopped')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'stopped'
                ? 'bg-slate-700 text-white font-semibold shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Stopped ({statusCounts.stopped})</span>
          </button>

          <button
            onClick={() => onSelectStatusFilter('proxy_error')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'proxy_error'
                ? 'bg-rose-600 text-white font-semibold shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Proxy Error ({statusCounts.proxyError})</span>
          </button>

          <button
            onClick={() => onSelectStatusFilter('login_required')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'login_required'
                ? 'bg-purple-600 text-white font-semibold shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Login Required ({statusCounts.loginRequired})</span>
          </button>
        </div>

        {/* Action Buttons: Add, Import, Export */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={onOpenAddProfile}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded transition flex items-center gap-1 shadow-md shadow-emerald-950/50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Profile</span>
          </button>

          <button
            onClick={() => setIsImportJsonOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-medium rounded transition flex items-center gap-1"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>

          <button
            onClick={() => handleExportJSON(selectedIds.length > 0)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-medium rounded transition flex items-center gap-1"
            title={selectedIds.length > 0 ? "Export các profile đã chọn" : "Export tất cả profile trong bộ lọc"}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
          </button>

          {/* Group Selector Dropdown */}
          <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800">
            <span className="text-slate-400 hidden sm:inline">Nhóm:</span>
            <select
              value={selectedGroup || ''}
              onChange={(e) => onSelectGroup(e.target.value || null)}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="">-- Tất cả nhóm --</option>
              {groups.map(g => (
                <option key={g.id} value={g.name}>{g.name} ({g.profileCount})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Controls Bar */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs gap-3 shrink-0">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-slate-300 font-medium mr-1">
            Đã chọn: <strong className="text-cyan-400 font-mono">{selectedIds.length}</strong> / {filteredProfiles.length} profiles
          </span>

          {selectedIds.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => onStartSelectedProfiles(selectedIds)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded transition flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Chạy ({selectedIds.length})</span>
              </button>

              <button
                onClick={() => onStopSelectedProfiles(selectedIds)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 rounded transition flex items-center gap-1"
              >
                <Square className="w-3 h-3 text-rose-400 fill-current" />
                <span>Dừng</span>
              </button>

              {/* Assign Group */}
              <button
                onClick={() => setIsAssignGroupOpen(true)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-200 text-slate-300 border border-slate-700 rounded transition flex items-center gap-1"
              >
                <FolderPlus className="w-3 h-3 text-cyan-400" />
                <span>Gán Nhóm</span>
              </button>

              {/* Assign Proxy */}
              <button
                onClick={() => setIsAssignProxyOpen(true)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-200 text-slate-300 border border-slate-700 rounded transition flex items-center gap-1"
              >
                <Network className="w-3 h-3 text-cyan-400" />
                <span>Gán Proxy</span>
              </button>

              {/* Toggle Modules */}
              <button
                onClick={() => setIsToggleModulesOpen(true)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 hover:text-cyan-200 text-slate-300 border border-slate-700 rounded transition flex items-center gap-1"
              >
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Bật/Tắt Module</span>
              </button>

              {/* Delete Trigger */}
              <button
                onClick={triggerBulkDelete}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 rounded transition flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Xóa ({selectedIds.length})</span>
              </button>

              <button
                onClick={handleClearSelection}
                className="text-slate-400 hover:text-slate-200 underline text-[11px] ml-1"
              >
                Bỏ chọn
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSelectAllInFiltered}
            className="text-cyan-400 hover:underline text-xs font-medium"
          >
            Chọn tất cả ({filteredProfiles.length})
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1200px]">
          {/* Table Header */}
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0 z-20 border-b border-slate-800 text-[11px]">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
              </th>
              <th className="p-3 w-12 text-center font-mono">STT</th>
              <th className="p-3 w-14 text-center">Avatar</th>
              <th className="p-3 font-semibold text-slate-200">Tên Nhân Vật</th>
              <th className="p-3 font-mono">UID</th>
              <th className="p-3">Nhóm</th>
              <th className="p-3 font-mono">Proxy</th>
              <th className="p-3 font-mono">IP Hiện Tại</th>
              <th className="p-3">Trạng Thái</th>
              <th className="p-3">Hoạt Động Đang Chạy</th>
              <th className="p-3 font-mono">Chạy Tiếp Theo</th>
              <th className="p-3 text-center w-36">Thao Tác</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-medium">
            {paginatedProfiles.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500 font-medium">
                  Không tìm thấy profile phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              paginatedProfiles.map((p) => (
                <ProfileTableRow
                  key={p.id}
                  profile={p}
                  isChecked={selectedSet.has(p.id)}
                  onToggleSelectRow={handleToggleSelectRow}
                  onToggleProfileRun={onToggleProfileRun}
                  onOpenMiniBrowser={onOpenMiniBrowser}
                  onEditProfile={(target) => setEditingProfile(target)}
                  onDeleteSingleProfile={triggerSingleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center space-x-3 text-slate-400">
          <span>
            Hiển thị <strong className="text-slate-200 font-mono">{paginatedProfiles.length}</strong> / <strong className="text-slate-200 font-mono">{filteredProfiles.length}</strong> kết quả
          </span>

          <div className="flex items-center space-x-1">
            <span>Hiển thị / trang:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Page Nav */}
        <div className="flex items-center space-x-2">
          <button
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-slate-300 font-semibold px-2">
            Trang {safePage} / {totalPages}
          </span>

          <button
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="p-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded border border-slate-800 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <EditProfileModal
        isOpen={Boolean(editingProfile)}
        onClose={() => setEditingProfile(null)}
        profile={editingProfile}
        groups={groups}
        proxies={proxies}
        existingProfiles={profiles}
        onSubmit={onUpdateProfile}
      />

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        targetCount={deleteTargetIds.length}
        profileNames={deleteTargetNames}
      />

      <AssignGroupModal
        isOpen={isAssignGroupOpen}
        onClose={() => setIsAssignGroupOpen(false)}
        selectedCount={selectedIds.length}
        groups={groups}
        onSubmit={async (groupName) => {
          await onAssignGroupForSelected(selectedIds, groupName);
        }}
      />

      <AssignProxyModal
        isOpen={isAssignProxyOpen}
        onClose={() => setIsAssignProxyOpen(false)}
        selectedCount={selectedIds.length}
        proxies={proxies}
        onSubmit={async (proxyId) => {
          await onAssignProxyForSelected(selectedIds, proxyId);
        }}
      />

      <ToggleModulesModal
        isOpen={isToggleModulesOpen}
        onClose={() => setIsToggleModulesOpen(false)}
        selectedCount={selectedIds.length}
        onSubmit={async (enabledModules) => {
          await onToggleModulesForSelected(selectedIds, enabledModules);
        }}
      />

      <ImportProfilesModal
        isOpen={isImportJsonOpen}
        onClose={() => setIsImportJsonOpen(false)}
        existingProfiles={profiles}
        onImportSuccess={onImportProfilesFromJSON}
      />

    </div>
  );
};
