/**
 * ActivitySettingsView - Phase 07 Module Framework catalog and Worker settings.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Sliders,
  Save,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  Construction,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import {
  ActivityConfig,
  ModuleCatalogItem,
  ModuleRuntimeStatus,
  ModuleRunResult,
  Profile
} from '../../types';

interface ActivitySettingsViewProps {
  config: ActivityConfig;
  profiles: Profile[];
  moduleCatalog: ModuleCatalogItem[];
  moduleRuntimeStatuses: Record<string, ModuleRuntimeStatus>;
  onSaveConfig: (config: ActivityConfig) => Promise<void> | void;
  onRunModule: (profileId: string, moduleCode: string) => Promise<ModuleRunResult>;
}

export const ActivitySettingsView: React.FC<ActivitySettingsViewProps> = ({
  config,
  profiles,
  moduleCatalog,
  moduleRuntimeStatuses,
  onSaveConfig,
  onRunModule
}) => {
  const [form, setForm] = useState<ActivityConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [moduleError, setModuleError] = useState<string | null>(null);

  useEffect(() => setForm({ ...config }), [config]);
  useEffect(() => {
    if (!selectedProfileId || !profiles.some(profile => profile.id === selectedProfileId)) {
      setSelectedProfileId(profiles[0]?.id || '');
    }
  }, [profiles, selectedProfileId]);

  const sortedModules = useMemo(
    () => [...moduleCatalog].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [moduleCatalog]
  );
  const readyCount = sortedModules.filter(module => module.runnable).length;
  const plannedCount = sortedModules.filter(module => module.implementationState === 'planned').length;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    try {
      setIsSaving(true);
      await onSaveConfig(form);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunModule = async (module: ModuleCatalogItem) => {
    if (!selectedProfileId || !module.runnable || !module.triggers.includes('manual')) return;
    setModuleError(null);
    try {
      await onRunModule(selectedProfileId, module.code);
    } catch (error: any) {
      setModuleError(error?.message || `Không thể chạy module ${module.label}.`);
    }
  };

  return (
    <div id="view-activity-settings" className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full text-slate-200">
      <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100">Phase 08 — Module Điểm Danh</h2>
            <p className="text-xs text-slate-400">Module Framework cùng module game thật đầu tiên: Điểm Danh</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded border border-emerald-800 bg-emerald-950 text-emerald-300">Sẵn sàng: {readyCount}</span>
          <span className="px-2.5 py-1 rounded border border-amber-800 bg-amber-950 text-amber-300">Đang chờ port: {plannedCount}</span>
        </div>
      </div>

      {moduleError && (
        <div className="rounded border border-rose-800 bg-rose-950/70 px-3 py-2 text-xs text-rose-200">{moduleError}</div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-cyan-400 text-[11px] uppercase tracking-wider">Danh Mục Module</h3>
            <p className="text-[10px] text-slate-500 mt-1">Điểm Danh đã được chuyển sang API Worker. Các module còn ghi Planned chưa gửi request game.</p>
          </div>
          <select
            value={selectedProfileId}
            onChange={event => setSelectedProfileId(event.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 min-w-[260px]"
          >
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>{profile.displayName || profile.characterName} — {profile.uid}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {sortedModules.map(module => {
            const runtime = moduleRuntimeStatuses[`${selectedProfileId}:${module.code}`];
            const running = runtime?.state === 'running';
            const canRun = module.runnable && module.triggers.includes('manual') && Boolean(selectedProfileId);
            return (
              <div key={module.code} className="rounded border border-slate-800 bg-slate-950/80 p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-100">{module.label}</span>
                      {module.runnable
                        ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        : <Construction className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{module.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">v{module.version}</span>
                </div>

                {(runtime?.summary || runtime?.error) && (
                  <div className={`text-[10px] leading-relaxed ${runtime.error ? 'text-rose-400' : 'text-slate-400'}`}>
                    {runtime.error || runtime.summary}
                  </div>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <div className="text-[9px] uppercase tracking-wide">
                    {runtime ? (
                      <span className={runtime.state === 'error' ? 'text-rose-400' : runtime.state === 'success' ? 'text-emerald-400' : 'text-cyan-400'}>
                        {runtime.state}{runtime.durationMs != null ? ` • ${runtime.durationMs}ms` : ''}
                      </span>
                    ) : (
                      <span className={module.runnable ? 'text-emerald-400' : 'text-amber-400'}>
                        {module.runnable ? 'Ready' : 'Planned'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canRun || running}
                    onClick={() => handleRunModule(module)}
                    className="px-2.5 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    {running ? 'Đang chạy' : 'Chạy thử'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400">
            Worker Queue
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-300">Độ trễ retry (giây):</span>
                <span className="font-mono text-cyan-400 font-bold">{form.delayBetweenActions}s</span>
              </div>
              <input type="range" min={1} max={15} value={form.delayBetweenActions} onChange={event => setForm({ ...form, delayBetweenActions: Number(event.target.value) })} className="w-full accent-cyan-500 cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-300">Profile đồng thời:</span>
                <span className="font-mono text-emerald-400 font-bold">{form.maxConcurrentProfiles}</span>
              </div>
              <input type="range" min={1} max={50} value={form.maxConcurrentProfiles} onChange={event => setForm({ ...form, maxConcurrentProfiles: Number(event.target.value) })} className="w-full accent-emerald-500 cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400">
            Trạng Thái Framework
          </h3>
          <div className="space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-cyan-400" /> Worker Core sử dụng ModuleRunner</div>
            <div className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Chỉ module `ready` có handler mới được chạy</div>
            <div className="flex items-center gap-2"><Construction className="w-3.5 h-3.5 text-amber-400" /> Điểm Danh đã chạy thật; module `planned` vẫn không gọi API</div>
          </div>
          <button type="submit" disabled={isSaving} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition shadow flex items-center justify-center gap-2 disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Worker'}</span>
          </button>
          {savedSuccess && (
            <div className="px-3 py-2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình.
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
