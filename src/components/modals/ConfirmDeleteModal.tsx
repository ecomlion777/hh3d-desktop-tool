/**
 * ConfirmDeleteModal - Confirmation Modal Before Deleting Profiles
 */

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetCount: number;
  profileNames?: string[];
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetCount,
  profileNames = []
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-rose-950/80 px-4 py-3 border-b border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-sm text-slate-100">Xác Nhận Xóa Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-rose-900/40 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-300 font-medium leading-relaxed">
            Bạn có chắc chắn muốn xóa <span className="text-rose-400 font-bold">{targetCount}</span> profile khỏi hệ thống không?
          </p>

          <p className="text-slate-400 text-[11px]">
            Hành động này sẽ xóa dữ liệu khỏi danh sách quản lý. Thao tác này <span className="text-rose-300 font-semibold">không thể hoàn tác</span>!
          </p>

          {profileNames.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded p-2.5 max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-400">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">
                Danh sách profile sẽ xóa:
              </span>
              {profileNames.slice(0, 5).map((name, idx) => (
                <div key={idx} className="truncate text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  {name}
                </div>
              ))}
              {profileNames.length > 5 && (
                <div className="text-slate-500 italic pl-3">
                  ...và {profileNames.length - 5} profile khác
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition text-xs"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xác Nhận Xóa</span>
          </button>
        </div>

      </div>
    </div>
  );
};
