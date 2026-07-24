/**
 * GeneralSettingsView - App Settings, IPC Bridge Toggles, Storage Info & Backup
 */

import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Download, HardDrive, Info, FolderCheck, Database, FileCode, ShieldCheck, KeyRound } from 'lucide-react';
import { GeneralAppSettings, DesktopVersions, DesktopStorageInfo, ProxyStorageInfo, WorkerSummary } from '../../types';
import { appBridge } from '../../services/appBridgeService';

interface GeneralSettingsViewProps {
  settings: GeneralAppSettings;
  onSaveSettings: (settings: GeneralAppSettings) => void;
}

export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  settings,
  onSaveSettings
}) => {
  const [form, setForm] = useState<GeneralAppSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [versions, setVersions] = useState<DesktopVersions>({
    appVersion: '2.5.0',
    electronVersion: '39.8.10',
    chromiumVersion: '132.0.0.0',
    nodeVersion: '22.0.0'
  });
  const [isElectronEnv, setIsElectronEnv] = useState(false);

  const [storageInfo, setStorageInfo] = useState<DesktopStorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState<boolean>(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const [openWindowsCount, setOpenWindowsCount] = useState<number>(0);
  const [proxyStorageInfo, setProxyStorageInfo] = useState<ProxyStorageInfo | null>(null);
  const [proxyStorageError, setProxyStorageError] = useState<string | null>(null);
  const [workerSummary, setWorkerSummary] = useState<WorkerSummary | null>(null);
  const [workerSummaryError, setWorkerSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const statusMap = new Map<string, any>();

    const updateCount = () => {
      const openCount = Array.from(statusMap.values()).filter(
        (s: any) => s.isOpen || s.state === 'open' || s.state === 'loading' || s.state === 'opening'
      ).length;
      setOpenWindowsCount(openCount);
    };

    const fetchInitial = async () => {
      if (appBridge.listMiniBrowserStatuses) {
        try {
          const statuses = await appBridge.listMiniBrowserStatuses();
          if (statuses) {
            statuses.forEach(s => statusMap.set(s.profileId, s));
            updateCount();
          }
        } catch (err) {
          console.warn('Could not fetch mini browser statuses:', err);
        }
      }
    };

    fetchInitial();

    const unsub = appBridge.onMiniBrowserStatusChanged ? appBridge.onMiniBrowserStatusChanged(status => {
      statusMap.set(status.profileId, status);
      updateCount();
    }) : undefined;

    return () => {
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    const refreshProxyStorage = async () => {
      if (!appBridge.getProxyStorageInfo) return;
      try {
        setProxyStorageInfo(await appBridge.getProxyStorageInfo());
        setProxyStorageError(null);
      } catch (error) {
        setProxyStorageError(error instanceof Error ? error.message : String(error));
      }
    };

    refreshProxyStorage();
    const unsubscribe = appBridge.onProxiesChanged
      ? appBridge.onProxiesChanged(() => { void refreshProxyStorage(); })
      : undefined;

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    const refreshWorkerSummary = async () => {
      if (!appBridge.getWorkerSummary) return;
      try {
        setWorkerSummary(await appBridge.getWorkerSummary());
        setWorkerSummaryError(null);
      } catch (error) {
        setWorkerSummaryError(error instanceof Error ? error.message : String(error));
      }
    };

    void refreshWorkerSummary();
    const unsubscribe = appBridge.onWorkerSummaryChanged
      ? appBridge.onWorkerSummaryChanged(summary => {
          setWorkerSummary(summary);
          setWorkerSummaryError(null);
        })
      : undefined;

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    if (appBridge.getVersions) {
      appBridge.getVersions().then(v => {
        if (v) {
          setVersions(v);
          if (v.electronVersion && !v.electronVersion.includes('Simulated')) {
            setIsElectronEnv(true);
          }
        }
      }).catch(err => {
        console.warn('Could not fetch desktop versions:', err);
      });
    }

    if (appBridge.getStorageInfo) {
      setStorageLoading(true);
      appBridge.getStorageInfo()
        .then(info => {
          setStorageInfo(info);
          setStorageError(null);
          const dir = info?.dataDirectory || info?.dataDir;
          if (info && dir && dir !== 'Web LocalStorage (Browser Simulator)') {
            setIsElectronEnv(true);
          }
        })
        .catch(err => {
          console.error('Failed to load storage info:', err);
          setStorageError(err.message || 'Không thể đọc thông tin Local JSON Storage.');
        })
        .finally(() => {
          setStorageLoading(false);
        });
    } else {
      setStorageLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    if (isElectronEnv && storageInfo) {
      alert(
        `[Local JSON Storage - Phase 03A]\n\nDữ liệu thật của ứng dụng Electron đang được lưu trữ tự động tại:\n\n` +
        `Thư mục: ${storageInfo.dataDirectory}\n` +
        `Tên file: ${storageInfo.dataFile}\n\n` +
        `Mọi thay đổi profile/nhóm được ghi tự động tức thì xuống đĩa đĩa đĩa.`
      );
      return;
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      profiles: localStorage.getItem('hh3d_desktop_profiles_v1'),
      proxies: localStorage.getItem('hh3d_desktop_proxies_v1'),
      groups: localStorage.getItem('hh3d_desktop_groups_v1')
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HH3D_Desktop_Tool_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="view-general-settings" className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full text-slate-200">
      
      {/* Title */}
      <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-800 text-slate-300 border border-slate-700 rounded">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100">Cài Đặt Hệ Thống Tổng Quan (General Settings)</h2>
            <p className="text-xs text-slate-400">Cấu hình kết nối Electron IPC Adapter, giới hạn luồng CPU và sao lưu dữ liệu</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Đã Lưu Cài Đặt!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        
        {/* Left Card: IPC & Engine Adapter */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400">
            Cấu Hình Electron IPC Bridge Adapter
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Chế Độ Chạy Service (Service Abstraction Mode)</label>
              <select
                value={form.ipcMode}
                onChange={e => setForm({ ...form, ipcMode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-medium focus:outline-none focus:border-cyan-500"
              >
                <option value="mock">Simulated Web Mock IPC Bridge (Đang dùng trong Preview Browser)</option>
                <option value="electron_bridge">Native Electron IPC Renderer Bridge (Electron App Build)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Lớp Service Abstraction (`desktopBridge.ts`) cho phép đổi trực tiếp giữa Mock dữ liệu và Electron IPC mà không cần sửa giao diện React.
              </p>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Giới Hạn Luồng Tiến Trình Con (Max Worker Threads)</label>
              <input
                type="number"
                min={5}
                max={100}
                value={form.maxThreads}
                onChange={e => setForm({ ...form, maxThreads: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Thời Gian Timeout Proxy (Giây)</label>
              <input
                type="number"
                min={3}
                max={60}
                value={form.proxyTimeout}
                onChange={e => setForm({ ...form, proxyTimeout: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Right Card: Preferences & Backup */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400">
            Tùy Chọn Ứng Dụng & Sao Lưu Data
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Thu nhỏ xuống Khay Hệ Thống (System Tray)</span>
                <span className="text-[11px] text-slate-400">Giữ ứng dụng chạy ẩn dưới thanh Taskbar</span>
              </div>
              <input
                type="checkbox"
                checked={form.minimizeToTray}
                onChange={e => setForm({ ...form, minimizeToTray: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Khởi động cùng Windows/macOS</span>
                <span className="text-[11px] text-slate-400">Tự khởi chạy Tool khi bật máy tính</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoStartWithSystem}
                onChange={e => setForm({ ...form, autoStartWithSystem: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 block">Sao Lưu / Khôi Phục Cơ Sở Dữ Liệu Local</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Xuất File Backup (.JSON)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition shadow flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Tất Cả Cài Đặt</span>
            </button>
          </div>
        </div>

        {/* Local Storage Card (Phase 03A) */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <span>Cơ Sở Dữ Liệu JSON Cục Bộ (Local JSON Storage - Phase 03A)</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${isElectronEnv ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
              {isElectronEnv ? 'Electron Main Process File Storage' : 'Web Browser Simulator Mode (localStorage)'}
            </span>
          </h3>

          {storageLoading ? (
            <div className="p-4 text-center text-slate-400 animate-pulse">Đang tải thông tin Local Storage...</div>
          ) : storageError ? (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded text-red-300 font-mono text-[11px]">
              Lỗi Local Storage: {storageError}
            </div>
          ) : storageInfo ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1 mb-1">
                    <FolderCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Data Directory</span>
                  </span>
                  <span className="font-mono text-xs text-slate-300 break-all">{storageInfo.dataDirectory}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1 mb-1">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Data File</span>
                  </span>
                  <span className="font-mono text-xs text-slate-300 break-all">{storageInfo.dataFile}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Schema Version</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-cyan-400">v{storageInfo.schemaVersion}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Profile Count</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-emerald-400">{storageInfo.profileCount} Profiles</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Group Count</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-blue-400">{storageInfo.groupCount} Groups</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-400 text-[11px] space-y-1">
              <p className="font-medium text-slate-300">Đang chạy ở chế độ Web Preview Browser (Simulated Storage)</p>
              <p className="text-slate-500">
                Khi khởi chạy dưới dạng ứng dụng Electron Desktop Shell (`npm run electron:dev` hoặc `npm run electron:start`), dữ liệu profile và nhóm được ghi an toàn xuống file <code className="text-cyan-400">app-data.json</code>. Xem đường dẫn chính xác tại mục <code className="text-cyan-400">Data directory</code> phía trên.
              </p>
            </div>
          )}
        </div>

        {/* API Worker Core Card (Phase 06A) */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>API Worker Core Runtime (Phase 06A)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              Persistent Session + Assigned Proxy
            </span>
          </h3>

          {workerSummaryError ? (
            <div className="rounded border border-rose-800 bg-rose-950/40 p-3 text-[11px] text-rose-300">
              {workerSummaryError}
            </div>
          ) : workerSummary ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Concurrency</span>
                <strong className="font-mono text-cyan-400">{workerSummary.maxConcurrency}</strong>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Active</span>
                <strong className="font-mono text-emerald-400">{workerSummary.activeCount}</strong>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Queued</span>
                <strong className="font-mono text-amber-400">{workerSummary.queuedCount}</strong>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Running</span>
                <strong className="font-mono text-emerald-300">{workerSummary.runningCount}</strong>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Errors</span>
                <strong className="font-mono text-rose-400">{workerSummary.errorCount}</strong>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Tracked</span>
                <strong className="font-mono text-purple-400">{workerSummary.totalTracked}</strong>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">Worker Core chỉ khả dụng trong Electron Desktop.</div>
          )}

          <p className="text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded border border-slate-800/80">
            Phase 06A chỉ kiểm tra session/network bằng Chromium Session. Chưa chạy module game và không tự gửi request lặp lại khi khởi động.
          </p>
        </div>

        {/* Mini Browser Session Card (Phase 04A) */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-purple-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-purple-400" />
              <span>Trạng Thái Trình Duyệt Mini Browser (Mini Browser Session - Phase 04A)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
              Deterministic Partition per Profile
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Session Isolation</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-emerald-400">Enabled</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Số Cửa Sổ Đang Mở</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-emerald-400">{openWindowsCount} Cửa Sổ Mini Browser</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Target URL</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-cyan-400 truncate block" title="https://hoathinh3d.co/">https://hoathinh3d.co/</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Định Dạng Partition Mode</span>
              <span className="font-mono text-[11px] text-purple-300 truncate block" title="persist:hh3d-profile-<safeSlug>-<idHash>">
                persist:hh3d-profile-&lt;slug&gt;-&lt;hash&gt;
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded border border-slate-800/80">
            Note: Cookies and browser session data are not stored in app-data.json.
          </p>
        </div>

        {/* Proxy Storage Card (Phase 05A) */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Proxy Storage & Credential Encryption (Phase 05A)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">Per-profile Session Proxy</span>
          </h3>

          {proxyStorageError ? (
            <div className="rounded border border-rose-800 bg-rose-950/40 p-3 text-[11px] text-rose-300">{proxyStorageError}</div>
          ) : proxyStorageInfo ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-slate-950 p-3 rounded border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">Schema</span><strong className="font-mono text-amber-400">v{proxyStorageInfo.schemaVersion}</strong></div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">Proxy Count</span><strong className="font-mono text-cyan-400">{proxyStorageInfo.proxyCount}</strong></div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">Profiles Assigned</span><strong className="font-mono text-purple-400">{proxyStorageInfo.assignedProfileCount}</strong></div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">Encryption</span><strong className={proxyStorageInfo.encryptionAvailable ? 'text-emerald-400' : 'text-rose-400'}>{proxyStorageInfo.encryptionAvailable ? 'Available' : 'Unavailable'}</strong></div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">Secret File</span><strong className={proxyStorageInfo.secretFileExists ? 'text-emerald-400' : 'text-slate-400'}>{proxyStorageInfo.secretFileExists ? 'Present' : 'Not created'}</strong></div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">Proxy Storage chỉ khả dụng trong Electron Desktop.</div>
          )}

          <p className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px] text-slate-400">
            <KeyRound className="h-3.5 w-3.5 text-amber-400" /> Proxy password không bao giờ được lưu trong app-data.json hoặc trả về React renderer.
          </p>
        </div>

        {/* Full Width Card: App & System Info */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Thông Tin Môi Trường & Phiên Bản (System & Runtime Versions)</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${isElectronEnv ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              {isElectronEnv ? 'Electron Desktop Environment' : 'Web Browser Simulator Mode'}
            </span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">App Version</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-cyan-400">v{versions.appVersion}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Electron Version</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-slate-200">{versions.electronVersion}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Chromium Version</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-slate-200">{versions.chromiumVersion}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Node.js Version</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-slate-200">{versions.nodeVersion}</span>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};
