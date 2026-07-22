/**
 * CreateBatchModal - Create new Batch task from selected profiles or groups
 */

import React, { useState, useMemo } from 'react';
import { Layers, X, Check, Users, Shield, Cpu, PlayCircle, Clock, Search } from 'lucide-react';
import { Profile, GroupItem, BatchStatus } from '../../types';

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  groups: GroupItem[];
  preselectedProfileIds?: string[];
  onSubmit: (data: {
    name: string;
    profileIds: string[];
    concurrency: number;
    activityType: string;
    groupTarget: string;
    status: BatchStatus;
  }) => Promise<void>;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({
  isOpen,
  onClose,
  profiles,
  groups,
  preselectedProfileIds = [],
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [concurrency, setConcurrency] = useState<number>(40); // Default concurrency is 40
  const [activityType, setActivityType] = useState('Nhiệm Vụ Hàng Ngày');
  const [initialStatus, setInitialStatus] = useState<BatchStatus>('Ready');
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(preselectedProfileIds);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync preselected when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedProfileIds.length > 0) {
        setSelectedProfileIds(preselectedProfileIds);
      } else if (selectedProfileIds.length === 0) {
        // default select all
        setSelectedProfileIds(profiles.map(p => p.id));
      }
      if (!name) {
        setName(`Batch Tự Động ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
      }
    }
  }, [isOpen, preselectedProfileIds, profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (filterGroup !== 'all' && p.groupId !== filterGroup && p.group !== filterGroup) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.displayName?.toLowerCase().includes(q) || p.characterName?.toLowerCase().includes(q);
        const matchesUid = p.uid?.toLowerCase().includes(q);
        if (!matchesName && !matchesUid) return false;
      }
      return true;
    });
  }, [profiles, filterGroup, searchQuery]);

  const isAllFilteredSelected = filteredProfiles.length > 0 && filteredProfiles.every(p => selectedProfileIds.includes(p.id));

  const toggleSelectFilteredAll = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(filteredProfiles.map(p => p.id));
      setSelectedProfileIds(prev => prev.filter(id => !filteredSet.has(id)));
    } else {
      const newSet = new Set([...selectedProfileIds, ...filteredProfiles.map(p => p.id)]);
      setSelectedProfileIds(Array.from(newSet));
    }
  };

  const toggleProfile = (id: string) => {
    setSelectedProfileIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectByGroup = (groupIdOrName: string) => {
    const groupProfileIds = profiles
      .filter(p => p.groupId === groupIdOrName || p.group === groupIdOrName)
      .map(p => p.id);
    setSelectedProfileIds(groupProfileIds);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProfileIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 profile để tạo Batch!');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetGroupName = 'Nhiều Nhóm';
      if (filterGroup !== 'all') {
        const grp = groups.find(g => g.id === filterGroup || g.name === filterGroup);
        if (grp) targetGroupName = grp.name;
      } else if (selectedProfileIds.length === profiles.length) {
        targetGroupName = 'Tất Cả Profiles';
      }

      await onSubmit({
        name: name.trim() || `Batch ${selectedProfileIds.length} Profiles`,
        profileIds: selectedProfileIds,
        concurrency: Math.min(Math.max(Number(concurrency) || 40, 1), 50),
        activityType,
        groupTarget: targetGroupName,
        status: initialStatus
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full text-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Tạo Batch Task Mới</h3>
              <p className="text-xs text-slate-400">Tạo nhóm kịch bản mô phỏng chạy song song với cấu hình concurrency tùy chỉnh</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          
          {/* Batch Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tên Batch Task</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Batch Cày Phụ Bản Tầng 4 (Nhóm Main)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-purple-500 font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Concurrency Input (Default 40, Range 1 - 50) */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span>Concurrency (Luồng song song)</span>
                </label>
                <span className="font-mono text-sm font-bold text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                  {concurrency} luồng
                </span>
              </div>

              <input
                type="range"
                min={1}
                max={50}
                value={concurrency}
                onChange={e => setConcurrency(Number(e.target.value))}
                className="w-full accent-purple-500 bg-slate-800 h-2 rounded cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>1 luồng</span>
                <span className="text-purple-400 font-semibold">Mặc định: 40 luồng</span>
                <span>50 luồng</span>
              </div>
            </div>

            {/* Activity Type Selection */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <label className="text-slate-300 font-bold flex items-center gap-1.5 block">
                <PlayCircle className="w-4 h-4 text-cyan-400" />
                <span>Loại Kịch Bản Thực Thi</span>
              </label>

              <select
                value={activityType}
                onChange={e => setActivityType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
              >
                <option value="Nhiệm Vụ Hàng Ngày">Nhiệm Vụ Hàng Ngày (Daily Quest)</option>
                <option value="Săn Boss Phụ Bản Tầng 4">Săn Boss Phụ Bản Tầng 4</option>
                <option value="Cống Hiến Bang Hội">Cống Hiến Bang Hội (Guild Farm)</option>
                <option value="Clear Dọn Kho & Mua Bình Thể Lực">Clear Dọn Kho & Mua Bình Thể Lực</option>
                <option value="Thu Thập Rương Tài Nguyên">Thu Thập Rương Tài Nguyên</option>
                <option value="Ủy Thác Đào Khoáng">Ủy Thác Đào Khoáng</option>
              </select>

              <p className="text-[11px] text-slate-400">
                Lựa chọn luồng công việc sẽ tự động áp dụng cấu hình module mặc định.
              </p>
            </div>
          </div>

          {/* Initial Status Selection */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-200 block">Trạng Thái Ban Đầu</span>
              <span className="text-[11px] text-slate-400">Chọn Ready để có thể bấm Start ngay sau khi tạo</span>
            </div>

            <div className="flex items-center space-x-3 font-medium">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Ready"
                  checked={initialStatus === 'Ready'}
                  onChange={() => setInitialStatus('Ready')}
                  className="text-purple-600 focus:ring-0"
                />
                <span className="text-blue-400 font-semibold">Ready (Sẵn Sàng)</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Preparing"
                  checked={initialStatus === 'Preparing'}
                  onChange={() => setInitialStatus('Preparing')}
                  className="text-purple-600 focus:ring-0"
                />
                <span className="text-purple-400 font-semibold">Preparing (Đang Chuẩn Bị)</span>
              </label>
            </div>
          </div>

          {/* Profile Selection Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Danh Sách Profiles Trong Batch</span>
              </label>

              <span className="font-mono text-slate-300 font-semibold bg-slate-800 px-2.5 py-0.5 rounded">
                Đã chọn: <strong className="text-amber-400">{selectedProfileIds.length}</strong> / {profiles.length}
              </span>
            </div>

            {/* Quick group filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên nhân vật / UID..."
                    className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2 py-1 text-slate-200 text-xs focus:outline-none"
                  />
                </div>

                <select
                  value={filterGroup}
                  onChange={e => {
                    const val = e.target.value;
                    setFilterGroup(val);
                    if (val !== 'all') {
                      selectByGroup(val);
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                >
                  <option value="all">Tất cả Nhóm ({profiles.length})</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.profileCount})</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={toggleSelectFilteredAll}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition border border-slate-700 shrink-0"
              >
                {isAllFilteredSelected ? 'Bỏ chọn đang lọc' : 'Chọn toàn bộ đang lọc'}
              </button>
            </div>

            {/* Profiles Selection Checklist */}
            <div className="border border-slate-800 rounded-lg max-h-48 overflow-y-auto custom-scrollbar bg-slate-950 p-2 divide-y divide-slate-800/50">
              {filteredProfiles.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Không tìm thấy profile phù hợp
                </div>
              ) : (
                filteredProfiles.map(p => {
                  const isChecked = selectedProfileIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-1.5 hover:bg-slate-900 rounded cursor-pointer transition ${
                        isChecked ? 'bg-purple-950/20' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProfile(p.id)}
                          className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="font-bold text-slate-200">{p.displayName || p.characterName}</span>
                        <span className="font-mono text-slate-500 text-[11px]">({p.uid})</span>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="text-slate-400 font-mono">{p.group}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.status === 'running' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting || selectedProfileIds.length === 0}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Tạo Batch Task ({selectedProfileIds.length} profiles)</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
