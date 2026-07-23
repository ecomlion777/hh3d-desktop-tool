/**
 * GeneralSettingsView - App Settings, IPC Bridge Toggles & Backup
 */

import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Radio, HardDrive, Download, Upload, Shield, Cpu, Info } from 'lucide-react';
import { GeneralAppSettings, DesktopVersions } from '../../types';

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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.desktopBridge?.getVersions) {
      window.desktopBridge.getVersions().then(v => {
        if (v) {
          setVersions(v);
          setIsElectronEnv(true);
        }
      }).catch(err => {
        console.warn('Could not fetch desktop versions:', err);
      });
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportBackup = () => {
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
