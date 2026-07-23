/**
 * ToggleModulesModal - Enable or disable game modules in bulk for selected profiles
 */

import React, { useState } from 'react';
import { X, Layers, CheckCircle2 } from 'lucide-react';

interface ToggleModulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSubmit: (enabledModules: string[]) => Promise<void>;
}

const AVAILABLE_MODULES = [
  { code: 'daily_quest', label: 'Nhiệm Vụ Hàng Ngày', desc: 'Tự động làm nv daily' },
  { code: 'dungeon', label: 'Vượt Phụ Bản', desc: 'Chạy phó bản nguyên liệu/kinh nghiệm' },
  { code: 'boss_raid', label: 'Săn Boss Thế Giới', desc: 'Tham gia đánh Boss theo giờ' },
  { code: 'clear_inventory', label: 'Dọn Dẹp Túi Đồ', desc: 'Bán đồ rác, dọn rương' },
  { code: 'claim_mail', label: 'Nhận Thư & Quà', desc: 'Thu thập tất cả phần thưởng thư' }
];

export const ToggleModulesModal: React.FC<ToggleModulesModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onSubmit
}) => {
  const [enabledModules, setEnabledModules] = useState<string[]>(['daily_quest', 'dungeon']);

  if (!isOpen) return null;

  const handleToggle = (code: string) => {
    setEnabledModules(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(enabledModules);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Cấu Hình Module Hàng Loạt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <p className="text-slate-300">
            Cập nhật các module được bật cho <span className="text-cyan-400 font-bold">{selectedCount}</span> profile đã chọn:
          </p>

          <div className="space-y-1.5 bg-slate-950 p-3 rounded border border-slate-800 max-h-60 overflow-y-auto">
            {AVAILABLE_MODULES.map(m => {
              const isChecked = enabledModules.includes(m.code);
              return (
                <label
                  key={m.code}
                  className="flex items-center justify-between p-2 rounded hover:bg-slate-900 cursor-pointer transition border border-transparent hover:border-slate-800"
                >
                  <div>
                    <span className="font-semibold text-slate-200 block">{m.label}</span>
                    <span className="text-[10px] text-slate-500">{m.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(m.code)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
              );
            })}
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
              <span>Áp Dụng Module</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
