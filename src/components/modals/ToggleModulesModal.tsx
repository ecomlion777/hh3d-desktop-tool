/**
 * ToggleModulesModal - Phase 07 catalog-driven bulk module configuration.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { X, Layers, CheckCircle2, LockKeyhole, Construction } from 'lucide-react';
import { ModuleCatalogItem } from '../../types';

interface ToggleModulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  modules: ModuleCatalogItem[];
  initialEnabledModules: string[];
  onSubmit: (enabledModules: string[]) => Promise<void>;
}

export const ToggleModulesModal: React.FC<ToggleModulesModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  modules,
  initialEnabledModules,
  onSubmit
}) => {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const catalogCodes = new Set(modules.map(module => module.code));
    setEnabledModules(Array.from(new Set(initialEnabledModules.filter(code => catalogCodes.has(code)))));
    setErrorMsg(null);
  }, [isOpen, initialEnabledModules]);

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [modules]
  );

  if (!isOpen) return null;

  const handleToggle = (module: ModuleCatalogItem) => {
    if (module.required) return;
    setEnabledModules(prev => (
      prev.includes(module.code)
        ? prev.filter(code => code !== module.code)
        : [...prev, module.code]
    ));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    try {
      setIsSubmitting(true);
      await onSubmit(enabledModules);
      onClose();
    } catch (error: any) {
      setErrorMsg(error?.message || 'Không thể cập nhật module cho profile đã chọn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden text-slate-200">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Cấu Hình Module Hàng Loạt</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <p className="text-slate-300">
            Thay thế danh sách module của <span className="text-cyan-400 font-bold">{selectedCount}</span> profile đã chọn.
          </p>

          {errorMsg && (
            <div className="rounded border border-rose-800 bg-rose-950/70 px-3 py-2 text-rose-200">{errorMsg}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-950 p-3 rounded border border-slate-800 max-h-[430px] overflow-y-auto custom-scrollbar">
            {sortedModules.map(module => {
              const checked = module.required || enabledModules.includes(module.code);
              const planned = module.implementationState === 'planned';
              return (
                <label
                  key={module.code}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded border transition ${
                    module.required
                      ? 'bg-cyan-950/20 border-cyan-900/70 cursor-not-allowed'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200">{module.label}</span>
                      {module.required && <LockKeyhole className="w-3 h-3 text-cyan-400" />}
                      {planned && <Construction className="w-3 h-3 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{module.description}</span>
                    <span className={`inline-block mt-1 text-[9px] uppercase tracking-wide ${
                      module.runnable ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {module.runnable ? 'Sẵn sàng' : 'Khung chờ chuyển code'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={module.required}
                    onChange={() => handleToggle(module)}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                </label>
              );
            })}
          </div>

          <p className="text-[10px] text-amber-300/80">
            Module trạng thái “Khung chờ chuyển code” được lưu cấu hình nhưng chưa gửi request game trong Phase 07.
          </p>

          <div className="pt-2 flex justify-end space-x-2">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition disabled:opacity-50">
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition flex items-center gap-1.5 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Áp Dụng Module'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
