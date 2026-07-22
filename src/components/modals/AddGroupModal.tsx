/**
 * AddGroupModal - Create or Edit Profile Group
 */

import React, { useState } from 'react';
import { X, FolderPlus, CheckCircle2 } from 'lucide-react';

interface AddGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; color: string }) => void;
}

const PRESET_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#64748b'];

export const AddGroupModal: React.FC<AddGroupModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      alert('Vui lòng nhập tên nhóm!');
      return;
    }
    onSubmit({
      name: groupName.trim(),
      description: description.trim(),
      color
    });
    setGroupName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Thêm Nhóm Profile Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Tên Nhóm *</label>
            <input
              type="text"
              required
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Ví dụ: Nhóm Farm Phụ Bản 03"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Mô Tả Nhóm</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ví dụ: Dành cho dàn clone cày bạc & ép đá"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-2">Màu Nhận Diện Nhóm</label>
            <div className="flex items-center space-x-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-80 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                ></button>
              ))}
            </div>
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
              <span>Tạo Nhóm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
