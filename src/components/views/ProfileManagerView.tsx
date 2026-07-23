/**
 * ProfileManagerView - Primary Interactive Profile Table
 * Displays profiles with complete columns, bulk actions, status filters, search, pagination & full modals.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  UserPlus,
  Info
} from 'lucide-react';
import { Profile, ProfileStatus, GroupItem, ProxyItem } from '../../types';
import { MiniBrowserStatus } from '../../types/electron';

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
  onOpenMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  onFocusMiniBrowser?: (profileId: string) => Promise<boolean>;
  onMiniBrowserError?: (message: string) => void;
  onOpenMiniBrowserDetails?: (profile: Profile) => void;
  onOpenProfileSettings: (profile: Profile) => void;
  onOpenAddProfile: () => void;
  onUpdateProfile: (id: string, updatedData: Partial<Profile>) => Promise<Profile>;
  onAssignGroupForSelected: (ids: string[], groupName: string) => Promise<void>;
  onAssignProxyForSelected: (ids: string[], proxyId: string) => Promise<void>;
  onToggleModulesForSelected: (ids: string[], enabledModules: string[]) => Promise<void>;
  onImportProfilesFromJSON: (importedProfiles: Partial<Profile>[]) => Promise<void>;
  miniBrowserStatuses?: Record<string, MiniBrowserStatus>;
  onSelectionChange?: (selectedIds: string[]) => void;
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
  miniBrowserStatus?: MiniBrowserStatus;
  onToggleSelectRow: (id: string) => void;
  onToggleProfileRun: (id: string) => void;
  onOpenMiniBrowser: (profileId: string) => Promise<MiniBrowserStatus>;
  onFocusMiniBrowser?: (profileId: string) => Promise<boolean>;
  onMiniBrowserError?: (message: string) => void;
  onOpenMiniBrowserDetails?: (profile: Profile) => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteSingleProfile: (profile: Profile) => void;
}

const ProfileTableRow = React.memo<ProfileTableRowProps>(({
  profile: p,
  isChecked,
  miniBrowserStatus,
  onToggleSelectRow,
  onToggleProfileRun,
  onOpenMiniBrowser,
  onFocusMiniBrowser,
  onMiniBrowserError,
  onOpenMiniBrowserDetails,
  onEditProfile,
  onDeleteSingleProfile
}) => {
  const mbState = miniBrowserStatus?.state || 'closed';
  const isOpenOrLoading = mbState === 'opening' || mbState === 'loading' || mbState === 'open';

  let tooltipText = 'Mở Mini Browser';
  if (mbState === 'opening' || mbState === 'loading') {
    tooltipText = 'Đang tải Mini Browser';
  } else if (mbState === 'open') {
    tooltipText = 'Mini Browser đang mở – bấm để focus';
  } else if (mbState === 'error') {
    tooltipText = 'Lỗi Mini Browser';
  }

  const handleMiniBrowserClick = async () => {
    try {
      if (isOpenOrLoading && onFocusMiniBrowser) {
        const focused = await onFocusMiniBrowser(p.id);
        if (!focused) {
          await onOpenMiniBrowser(p.id);
        }
      } else {
        await onOpenMiniBrowser(p.id);
      }
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error(`Mini Browser error for profile ${p.id}:`, error);
      if (onMiniBrowserError) {
        onMiniBrowserError(msg);
      }
    }
  };

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

          {/* Mini Browser Direct Button */}
          <button
            onClick={handleMiniBrowserClick}
            className={`p-1.5 rounded transition border ${
              mbState === 'open'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                : mbState === 'opening' || mbState === 'loading'
                ? 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900 animate-pulse'
                : mbState === 'error'
                ? 'bg-rose-950 text-rose-300 border-rose-700 hover:bg-rose-900'
                : 'bg-slate-800 hover:bg-purple-600 hover:text-white text-purple-300 border-slate-700'
            }`}
            title={tooltipText}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          {/* Mini Browser Details Modal Button */}
          {onOpenMiniBrowserDetails && (
            <button
              onClick={() => onOpenMiniBrowserDetails(p)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 border border-slate-700 rounded transition"
              title="Xem Chi Tiết Session Mini Browser"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}

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
  onFocusMiniBrowser,
  onMiniBrowserError,
  onOpenMiniBrowserDetails,
  onOpenAddProfile,
  onUpdateProfile,
  onAssignGroupForSelected,
  onAssignProxyForSelected,
  onToggleModulesForSelected,
  onImportProfilesFromJSON,
  miniBrowserStatuses = {},
  onSelectionChange
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Notify parent component when selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

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
    const selectedProfiles = profiles.filter(p => selectedIds.includes(p.id));
    setDeleteTargetIds(selectedIds);
    setDeleteTargetNames(selectedProfiles.map(p => `${p.characterName || p.displayName} (${p.uid})`));
    setIsConfirmDeleteOpen(true);
  }, [selectedIds, profiles]);

  const handleConfirmDelete = async () => {
    await onDeleteSelectedProfiles(deleteTargetIds);
    setSelectedIds(prev => prev.filter(id => !deleteTargetIds.includes(id)));
    setIsConfirmDeleteOpen(false);
  };

  return (
    <div id="view-profile-manager" className="flex-1 flex flex-col bg-slate-900 overflow-hidden text-slate-200">
      
      {/* Top Filter & Toolbar Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        {/* Left Status Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => onSelectStatusFilter(null)}
            className={`px-2.5 py-1 rounded font-medium border transition ${
              statusFilter === null
                ? 'bg-slate-800 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Tất cả ({statusCounts.total})
          </button>

          <button
            onClick={() => onSelectStatusFilter('running')}
            className={`px-2.5 py-1 rounded font-medium border transition flex items-center gap-1.5 ${
              statusFilter === 'running'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-400'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Đang Chạy ({statusCounts.running})
          </button>

          <button
            onClick={() => onSelectStatusFilter('waiting')}
            className={`px-2.5 py-1 rounded font-medium border transition flex items-center gap-1.5 ${
              statusFilter === 'waiting'
                ? 'bg-amber-950 text-amber-300 border-amber-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-400'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-400" />
            Đang Chờ ({statusCounts.waiting})
          </button>

          <button
            onClick={() => onSelectStatusFilter('stopped')}
            className={`px-2.5 py-1 rounded font-medium border transition ${
              statusFilter === 'stopped'
                ? 'bg-slate-800 text-slate-200 border-slate-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Đã Dừng ({statusCounts.stopped})
          </button>

          <button
            onClick={() => onSelectStatusFilter('proxy_error')}
            className={`px-2.5 py-1 rounded font-medium border transition flex items-center gap-1.5 ${
              statusFilter === 'proxy_error'
                ? 'bg-rose-950 text-rose-300 border-rose-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-rose-400'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Lỗi Proxy ({statusCounts.proxyError})
          </button>
        </div>

        {/* Right Action Quick Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsImportJsonOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs font-medium transition"
            title="Nhập Profiles từ JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Import JSON</span>
          </button>

          <button
            onClick={onOpenAddProfile}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Mới</span>
          </button>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-cyan-950/60 border-b border-cyan-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150 shrink-0">
          <div className="flex items-center space-x-2 font-medium text-cyan-300">
            <span>Đã chọn <strong className="text-white font-bold">{selectedIds.length}</strong> profile</span>
            <button
              onClick={handleClearSelection}
              className="text-[11px] underline hover:text-white text-cyan-400 ml-2"
            >
              Bỏ chọn tất cả
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => onStartSelectedProfiles(selectedIds)}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium shadow-sm transition"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Chạy</span>
            </button>

            <button
              onClick={() => onStopSelectedProfiles(selectedIds)}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded font-medium transition"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Dừng</span>
            </button>

            <button
              onClick={() => setIsAssignGroupOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-medium transition"
            >
              <FolderPlus className="w-3 h-3 text-cyan-400" />
              <span>Gán Nhóm</span>
            </button>

            <button
              onClick={() => setIsAssignProxyOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-medium transition"
            >
              <Network className="w-3 h-3 text-amber-400" />
              <span>Gán Proxy</span>
            </button>

            <button
              onClick={() => setIsToggleModulesOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-medium transition"
            >
              <Layers className="w-3 h-3 text-purple-400" />
              <span>Module</span>
            </button>

            <button
              onClick={triggerBulkDelete}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 rounded font-medium transition"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Xóa</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
              </th>
              <th className="p-3 text-center w-12">STT</th>
              <th className="p-3 text-center w-12">Ảnh</th>
              <th className="p-3 min-w-[140px]">Tên Nhân Vật</th>
              <th className="p-3 min-w-[110px]">UID</th>
              <th className="p-3 min-w-[100px]">Nhóm</th>
              <th className="p-3 min-w-[140px]">Proxy</th>
              <th className="p-3 min-w-[120px]">IP Hiện Tại</th>
              <th className="p-3 min-w-[120px]">Trạng Thái</th>
              <th className="p-3 min-w-[160px]">Hoạt Động Hiện Tại</th>
              <th className="p-3 min-w-[110px]">Lần Chạy Tiếp</th>
              <th className="p-3 text-center w-36">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {paginatedProfiles.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-12 text-center text-slate-500">
                  <Users className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-50" />
                  <p className="font-semibold text-slate-400">Không tìm thấy profile nào phù hợp</p>
                  <p className="text-xs text-slate-600 mt-1">Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc nhóm/trạng thái</p>
                </td>
              </tr>
            ) : (
              paginatedProfiles.map(p => (
                <ProfileTableRow
                  key={p.id}
                  profile={p}
                  isChecked={selectedSet.has(p.id)}
                  miniBrowserStatus={miniBrowserStatuses[p.id]}
                  onToggleSelectRow={handleToggleSelectRow}
                  onToggleProfileRun={onToggleProfileRun}
                  onOpenMiniBrowser={onOpenMiniBrowser}
                  onFocusMiniBrowser={onFocusMiniBrowser}
                  onMiniBrowserError={onMiniBrowserError}
                  onOpenMiniBrowserDetails={onOpenMiniBrowserDetails}
                  onEditProfile={setEditingProfile}
                  onDeleteSingleProfile={triggerSingleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
        <div className="flex items-center space-x-3">
          <span>Hiển thị <strong>{paginatedProfiles.length}</strong> / <strong>{filteredProfiles.length}</strong> profiles</span>
          <div className="flex items-center space-x-1.5">
            <span>Hiển thị mỗi trang:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Pagination Page Controls */}
        <div className="flex items-center space-x-2">
          <span className="mr-2">Trang {safePage} / {totalPages}</span>
          <button
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <EditProfileModal
        isOpen={Boolean(editingProfile)}
        profile={editingProfile}
        groups={groups}
        proxies={proxies}
        existingProfiles={profiles}
        onClose={() => setEditingProfile(null)}
        onSubmit={async (id, data) => {
          await onUpdateProfile(id, data);
        }}
      />

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        targetCount={deleteTargetIds.length}
        profileNames={deleteTargetNames}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <AssignGroupModal
        isOpen={isAssignGroupOpen}
        selectedCount={selectedIds.length}
        groups={groups}
        onClose={() => setIsAssignGroupOpen(false)}
        onSubmit={async (groupName) => {
          await onAssignGroupForSelected(selectedIds, groupName);
        }}
      />

      <AssignProxyModal
        isOpen={isAssignProxyOpen}
        selectedCount={selectedIds.length}
        proxies={proxies}
        onClose={() => setIsAssignProxyOpen(false)}
        onSubmit={async (proxyId) => {
          await onAssignProxyForSelected(selectedIds, proxyId);
        }}
      />

      <ToggleModulesModal
        isOpen={isToggleModulesOpen}
        selectedCount={selectedIds.length}
        onClose={() => setIsToggleModulesOpen(false)}
        onSubmit={async (modules) => {
          await onToggleModulesForSelected(selectedIds, modules);
        }}
      />

      <ImportProfilesModal
        isOpen={isImportJsonOpen}
        existingProfiles={profiles}
        onClose={() => setIsImportJsonOpen(false)}
        onImportSuccess={async (imported) => {
          await onImportProfilesFromJSON(imported);
        }}
      />

    </div>
  );
};
