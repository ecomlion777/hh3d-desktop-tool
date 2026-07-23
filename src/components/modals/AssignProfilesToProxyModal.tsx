/**
 * AssignProfilesToProxyModal - Assign multiple profiles to a specific proxy
 */

import React, { useEffect, useMemo, useState } from 'react';
import { X, Network, Search, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { ProxyItem, Profile } from '../../types';

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
  // Initialize with profile IDs that currently use this proxy
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  useEffect(() => {
    if (isOpen && proxy) {
      setSelectedProfileIds(profiles.filter(profile => profile.proxyId === proxy.id).map(profile => profile.id));
      setSearchQuery('');
    }
  }, [isOpen, proxy, profiles]);

  // Filter profiles based on search query
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(p => 
      p.characterName?.toLowerCase().includes(q) ||
      p.uid?.toLowerCase().includes(q) ||
      p.group?.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  const handleToggleProfile = (id: string) => {
    setSelectedProfileIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredProfiles.map(p => p.id);
    const allSelected = filteredIds.every(id => selectedProfileIds.includes(id));
    if (allSelected) {
      setSelectedProfileIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedProfileIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Count active running profiles among selected
  const activeRunningCount = useMemo(() => {
    return profiles.filter(p => selectedProfileIds.includes(p.id) && p.status === 'running').length;
  }, [profiles, selectedProfileIds]);

  if (!isOpen || !proxy) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(proxy.id, selectedProfileIds);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-xl overflow-hidden text-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-slate-100">Gán Profiles Cho Proxy</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {proxy.name} ({proxy.ipPort}) - {proxy.location || 'Chưa định vị'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-Active Proxy Warning */}
        {activeRunningCount > 1 && (
          <div className="bg-amber-950/80 border-b border-amber-800 px-4 py-2 flex items-center gap-2 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Cảnh báo IP:</strong> Có <strong>{activeRunningCount} profile đang Active</strong> được gán cùng Proxy này. Việc chạy đồng thời nhiều game client trên 1 IP có thể làm giảm tốc độ hoặc bị giới hạn bởi game server.
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-hidden flex flex-col space-y-3">
          
          {/* Controls bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm UID, tên nhân vật, nhóm..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition shrink-0"
            >
              Chọn / Bỏ chọn tất cả ({filteredProfiles.length})
            </button>
          </div>

          {/* Profiles list */}
          <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-slate-950 p-2 space-y-1">
            {filteredProfiles.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Không tìm thấy profile phù hợp
              </div>
            ) : (
              filteredProfiles.map(p => {
                const isSelected = selectedProfileIds.includes(p.id);
                const isRunning = p.status === 'running';

                return (
                  <label
                    key={p.id}
                    onClick={() => handleToggleProfile(p.id)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition text-xs select-none ${
                      isSelected ? 'bg-amber-950/30 border border-amber-800/50 text-slate-100' : 'hover:bg-slate-900 border border-transparent text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>{p.characterName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({p.uid})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Nhóm: {p.group}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isRunning ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                          Đang chạy
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                          {p.status}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Tổng số profile được gán: <strong className="text-amber-400">{selectedProfileIds.length}</strong></span>
            {activeRunningCount > 0 && (
              <span className="text-emerald-400">({activeRunningCount} đang running)</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium text-xs transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded font-medium text-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lưu Gán Profiles</span>
          </button>
        </div>
      </div>
    </div>
  );
};
