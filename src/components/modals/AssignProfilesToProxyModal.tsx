/**
 * AssignProfilesToProxyModal - Replace the complete set of profiles assigned to a proxy.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Network, Search, X } from 'lucide-react';
import type { Profile, ProxyItem } from '../../types';

interface AssignProfilesToProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  proxy: ProxyItem | null;
  profiles: Profile[];
  onSubmit: (proxyId: string, profileIds: string[]) => Promise<void>;
}

export const AssignProfilesToProxyModal: React.FC<AssignProfilesToProxyModalProps> = ({
  isOpen,
  onClose,
  proxy,
  profiles,
  onSubmit
}) => {
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !proxy) return;
    setSelectedProfileIds(
      profiles.filter(profile => profile.proxyId === proxy.id).map(profile => profile.id)
    );
    setSearchQuery('');
    setErrorMsg(null);
    setIsSubmitting(false);
  }, [isOpen, proxy, profiles]);

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter(profile =>
      profile.characterName?.toLowerCase().includes(query) ||
      profile.displayName?.toLowerCase().includes(query) ||
      profile.uid?.toLowerCase().includes(query) ||
      profile.group?.toLowerCase().includes(query)
    );
  }, [profiles, searchQuery]);

  const activeRunningCount = useMemo(
    () => profiles.filter(profile => selectedProfileIds.includes(profile.id) && profile.status === 'running').length,
    [profiles, selectedProfileIds]
  );

  const newlyAssignedCount = useMemo(() => {
    if (!proxy) return 0;
    return selectedProfileIds.filter(id => profiles.find(profile => profile.id === id)?.proxyId !== proxy.id).length;
  }, [profiles, proxy, selectedProfileIds]);

  const handleToggleProfile = (profileId: string) => {
    if (isSubmitting) return;
    setSelectedProfileIds(previous =>
      previous.includes(profileId)
        ? previous.filter(id => id !== profileId)
        : [...previous, profileId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (isSubmitting) return;
    const filteredIds = filteredProfiles.map(profile => profile.id);
    const allSelected = filteredIds.every(id => selectedProfileIds.includes(id));
    setSelectedProfileIds(previous =>
      allSelected
        ? previous.filter(id => !filteredIds.includes(id))
        : Array.from(new Set([...previous, ...filteredIds]))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!proxy || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(proxy.id, selectedProfileIds);
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !proxy) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
          <div className="flex items-center space-x-2">
            <Network className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Gán Profiles Cho Proxy</h3>
              <p className="font-mono text-[11px] text-slate-400">
                {proxy.name} ({proxy.protocol}://{proxy.host}:{proxy.port})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!proxy.enabled && (
          <div className="flex items-center gap-2 border-b border-rose-800 bg-rose-950/70 px-4 py-2 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Proxy đang tắt. Bạn chỉ có thể bỏ bớt profile đang gán; không thể gán thêm profile mới.
          </div>
        )}

        {activeRunningCount > 0 && (
          <div className="flex items-center gap-2 border-b border-amber-800 bg-amber-950/70 px-4 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {activeRunningCount} profile đang chạy sẽ bị đóng Mini Browser trước khi cấu hình mạng thay đổi. Ứng dụng không tự mở lại.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Tìm UID, tên nhân vật, nhóm..."
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-amber-500 disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                disabled={isSubmitting}
                className="shrink-0 rounded bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Chọn / Bỏ chọn tất cả ({filteredProfiles.length})
              </button>
            </div>

            <div className="min-h-[260px] flex-1 space-y-1 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-2">
              {filteredProfiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">Không tìm thấy profile phù hợp</div>
              ) : filteredProfiles.map(profile => {
                const isSelected = selectedProfileIds.includes(profile.id);
                const isAlreadyAssigned = profile.proxyId === proxy.id;
                const cannotNewAssign = !proxy.enabled && !isAlreadyAssigned;

                return (
                  <label
                    key={profile.id}
                    className={`flex items-center justify-between rounded border p-2 text-xs transition ${
                      cannotNewAssign
                        ? 'cursor-not-allowed border-transparent opacity-45'
                        : isSelected
                          ? 'cursor-pointer border-amber-800/50 bg-amber-950/30 text-slate-100'
                          : 'cursor-pointer border-transparent text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isSubmitting || cannotNewAssign}
                        onChange={() => handleToggleProfile(profile.id)}
                        className="cursor-pointer rounded border-slate-700 text-amber-500 focus:ring-0 disabled:cursor-not-allowed"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                          <span>{profile.characterName || profile.displayName}</span>
                          <span className="font-mono text-[10px] text-slate-500">({profile.uid})</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          Nhóm: {profile.group || 'Chưa Phân Nhóm'}
                          {profile.proxyId && profile.proxyId !== proxy.id ? ' • Đang dùng proxy khác' : ''}
                        </div>
                      </div>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                      profile.status === 'running'
                        ? 'border border-emerald-800 bg-emerald-950 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {profile.status === 'running' ? 'Đang chạy' : profile.status}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Được gán sau khi lưu: <strong className="text-amber-400">{selectedProfileIds.length}</strong></span>
              <span>Gán mới: <strong className="text-cyan-400">{newlyAssignedCount}</strong></span>
            </div>

            {errorMsg && (
              <div className="rounded border border-rose-800 bg-rose-950/60 p-2 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 border-t border-slate-800 bg-slate-950 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded bg-amber-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang áp dụng...' : 'Lưu Gán Profiles'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
