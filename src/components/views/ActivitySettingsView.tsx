/**
 * ActivitySettingsView - Game Task Script Configuration
 */

import React, { useState } from 'react';
import { Sliders, Save, CheckCircle2, ShieldAlert, Cpu, Code } from 'lucide-react';
import { ActivityConfig } from '../../types';

interface ActivitySettingsViewProps {
  config: ActivityConfig;
  onSaveConfig: (config: ActivityConfig) => void;
}

export const ActivitySettingsView: React.FC<ActivitySettingsViewProps> = ({
  config,
  onSaveConfig
}) => {
  const [form, setForm] = useState<ActivityConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div id="view-activity-settings" className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full text-slate-200">
      
      {/* Title */}
      <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100">Cấu Hình Kịch Bản Hoạt Động (Activity Rules)</h2>
            <p className="text-xs text-slate-400">Tùy chỉnh luồng tự động cày cấp, phụ bản và xử lý sự cố đứt kết nối</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Đã Lưu Cấu Hình!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        
        {/* Left Column - Automation Toggles */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400">
            Tự Động Nhiệm Vụ Game
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Tự động làm Nhiệm Vụ Hàng Ngày</span>
                <span className="text-[11px] text-slate-400">Tự động nhận thưởng bái phỏng và cống hiến</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoDailyQuest}
                onChange={e => setForm({ ...form, autoDailyQuest: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Tự động vượt Phụ Bản Thể Lực</span>
                <span className="text-[11px] text-slate-400">Tự xả sạch thể lực vào Ma Vương & Vô Song Phụ Bản</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoDungeon}
                onChange={e => setForm({ ...form, autoDungeon: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Tự động Săn Boss Thế Giới</span>
                <span className="text-[11px] text-slate-400">Tự tìm bãi Boss khi đến giờ thông báo</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoBossRaid}
                onChange={e => setForm({ ...form, autoBossRaid: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Tự động dọn dẹp Túi Đồ & Bán Rác</span>
                <span className="text-[11px] text-slate-400">Tránh đầy túi khi treo máy farm nguyên liệu</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoClearInventory}
                onChange={e => setForm({ ...form, autoClearInventory: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>
          </div>
        </div>

        {/* Right Column - System Execution & Delay Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2 text-cyan-400">
            Tốc Độ Luồng & Xử Lý Sự Cố
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-300">Độ trễ giữa các thao tác (giây):</span>
                <span className="font-mono text-cyan-400 font-bold">{form.delayBetweenActions}s</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                value={form.delayBetweenActions}
                onChange={e => setForm({ ...form, delayBetweenActions: Number(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">Tránh bị game phát hiện thao tác bất thường</p>
            </div>

            <div>
              <div className="flex justify-between font-medium mb-1">
                <span className="text-slate-300">Giới hạn số profile đồng thời max:</span>
                <span className="font-mono text-emerald-400 font-bold">{form.maxConcurrentProfiles} profiles</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={form.maxConcurrentProfiles}
                onChange={e => setForm({ ...form, maxConcurrentProfiles: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-200 block">Tự đăng nhập lại khi đứt kết nối</span>
                <span className="text-[11px] text-slate-400">Auto Re-login session nếu bị out game</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoReloginOnDisconnect}
                onChange={e => setForm({ ...form, autoReloginOnDisconnect: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
              />
            </label>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Tên file Preset Script (Lua/JSON)</label>
              <input
                type="text"
                value={form.scriptPreset}
                onChange={e => setForm({ ...form, scriptPreset: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition shadow flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Tất Cả Cấu Hình</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};
