/**
 * AssignGroupModal - Assign group to selected profiles
 */

import React, { useState } from 'react';
import { X, FolderPlus, CheckCircle2 } from 'lucide-react';
import { GroupItem } from '../../types';

interface AssignGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  groups: GroupItem[];
  onSubmit: (groupName: string) => Promise<void>;
}

export const AssignGroupModal: React.FC<AssignGroupModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  groups,
  onSubmit
}) => {
  if (!isOpen) return null;

  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.name || 'Nhóm Chính (Main)');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(selectedGroup);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Gán Nhóm Hàng Loạt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <p className="text-slate-300">
            Chọn nhóm để gán cho <span className="text-cyan-400 font-bold">{selectedCount}</span> profile đã chọn:
          </p>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Chọn Nhóm Đích</label>
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            >
              {groups.map(g => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Cập Nhật Nhóm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
