/**
 * MiniBrowserModal - Interactive Mini Browser Simulator
 * Simulates electron webview / character live view for selected account.
 */

import React, { useState } from 'react';
import {
  X,
  RotateCw,
  Play,
  Square,
  Shield,
  Terminal,
  Maximize2,
  ExternalLink,
  Camera,
  KeyRound,
  CheckCircle2,
  Zap,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { Profile } from '../../types';

interface MiniBrowserModalProps {
  profile: Profile | null;
  onClose: () => void;
  onToggleRun: (id: string) => void;
}

export const MiniBrowserModal: React.FC<MiniBrowserModalProps> = ({
  profile,
  onClose,
  onToggleRun
}) => {
  if (!profile) return null;

  const [activeTab, setActiveTab] = useState<'viewport' | 'logs' | 'network' | 'settings'>('viewport');
  const [consoleInput, setConsoleInput] = useState<string>('');
  const [localLogs, setLocalLogs] = useState<string[]>([
    `[SYS] Initialized MiniBrowser Webview for UID: ${profile.uid}`,
    `[PROXY] Connected through SOCKS5 ${profile.proxyAddress} (IP: ${profile.currentIp})`,
    `[AUTH] Token verified for Character: ${profile.characterName}`,
    `[GAME] Loaded Map 85 - Thần Ma Sơn Trang`,
    `[ACTION] Current Activity: ${profile.currentActivity}`
  ]);

  const handleSendConsole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;
    setLocalLogs(prev => [...prev, `[USER_CMD] > ${consoleInput}`, `[EXEC] Executed command on client thread ${profile.stt}`]);
    setConsoleInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl h-[650px] flex flex-col overflow-hidden text-slate-200">
        
        {/* Top Window Bar */}
        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer" onClick={onClose}></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>

            <div className="h-4 w-px bg-slate-800 mx-1"></div>

            <span className="font-semibold text-xs text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
              Mini Browser: {profile.characterName} (Level {profile.level})
            </span>
            <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded">
              UID: {profile.uid}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onToggleRun(profile.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                profile.status === 'running'
                  ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {profile.status === 'running' ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Dừng Bot</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Chạy Bot</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Address & Status Bar */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs gap-3 shrink-0">
          <div className="flex items-center space-x-2 flex-1 bg-slate-950 px-3 py-1 rounded border border-slate-800 font-mono text-[11px] text-slate-400 truncate">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-400">hh3d://game-instance/</span>
            <span className="text-slate-200 truncate">{profile.uid}</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 truncate">Proxy: {profile.proxyAddress}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLocalLogs(prev => [...prev, `[ACTION] Refreshed Game Webview at ${new Date().toLocaleTimeString('vi-VN')}`])}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              title="Làm mới Webview"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => alert(`Đã lưu ảnh màn hình game cho UID ${profile.uid}`)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              title="Chụp ảnh màn hình"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Browser Tabs */}
        <div className="bg-slate-950 px-4 flex items-center border-b border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('viewport')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition ${
              activeTab === 'viewport'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Màn Hình Game Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition ${
              activeTab === 'logs'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console & Logs</span>
          </button>
        </div>

        {/* Main Content Viewport */}
        <div className="flex-1 overflow-hidden relative bg-slate-950 flex flex-col">
          {activeTab === 'viewport' ? (
            <div className="flex-1 flex flex-col md:flex-row h-full">
              {/* Game Screen Simulation Box */}
              <div className="flex-1 bg-slate-950 p-4 flex flex-col items-center justify-center relative border-r border-slate-800/80">
                {/* Simulated Game Graphics Window */}
                <div className="w-full max-w-lg aspect-video bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-lg border border-cyan-500/30 p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                  {/* Subtle Grid Background */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:16px_16px]"></div>

                  {/* Character HUD */}
                  <div className="relative z-10 flex items-center justify-between bg-slate-950/80 p-2.5 rounded border border-slate-800 backdrop-blur-xs">
                    <div className="flex items-center space-x-3">
                      <img
                        src={profile.avatarUrl}
                        alt={profile.characterName}
                        className="w-10 h-10 rounded-lg bg-slate-800 border border-cyan-500/40"
                      />
                      <div>
                        <div className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                          {profile.characterName}
                          <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
                            Lv.{profile.level}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>Nhóm: {profile.group}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        profile.status === 'running'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {profile.status === 'running' ? '● ĐANG BỐT' : 'DỪNG BỐT'}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Action Center Simulation */}
                  <div className="relative z-10 my-auto text-center space-y-2 py-4">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-bounce">
                      <Activity className="w-8 h-8" />
                    </div>
                    <div className="text-sm font-semibold text-slate-100">
                      Hoạt động: <span className="text-amber-300">{profile.currentActivity}</span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Đã tối ưu hóa luồng dữ liệu thông qua SOCKS5 Proxy ({profile.currentIp}). Tốc độ phản hồi 38ms.
                    </p>
                  </div>

                  {/* Stamina / HP Bar */}
                  <div className="relative z-10 space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Thể Lực (Stamina)</span>
                      <span className="text-cyan-300">{profile.stamina}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${profile.stamina}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Info Panel */}
              <div className="w-full md:w-80 bg-slate-900 p-4 border-t md:border-t-0 md:border-l border-slate-800 text-xs space-y-4 overflow-y-auto">
                <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                  Thông Tin Nhân Vật
                </h3>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Tên Nhân Vật:</span>
                    <span className="font-semibold text-slate-200">{profile.characterName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">UID Game:</span>
                    <span className="font-mono text-cyan-400">{profile.uid}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Đẳng Cấp:</span>
                    <span className="font-mono text-amber-300">Cấp {profile.level}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Nhóm Quản Lý:</span>
                    <span className="text-slate-200">{profile.group}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Proxy Đang Dùng:</span>
                    <span className="font-mono text-slate-300 text-[11px]">{profile.proxyAddress}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">IP Hiện Tại:</span>
                    <span className="font-mono text-emerald-400">{profile.currentIp}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Lần Cuối Hoạt Động:</span>
                    <span className="font-mono text-slate-300">{profile.lastActive}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => {
                      setLocalLogs(prev => [...prev, `[AUTH_RETRY] Manual re-login triggered for ${profile.uid}`]);
                      alert('Đã gửi lệnh Đăng Nhập Lại (Re-login) đến tiến trình Electron bot!');
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                    <span>Đăng Nhập Lại Session</span>
                  </button>

                  <button
                    onClick={() => {
                      setLocalLogs(prev => [...prev, `[CACHE_CLEAR] Cleared local cache for ${profile.uid}`]);
                      alert('Đã xóa bộ nhớ tạm (Cache) thành công!');
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition flex items-center justify-center gap-2"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Xóa Cache Webview</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Logs Tab */
            <div className="flex-1 flex flex-col p-4 bg-slate-950 font-mono text-xs">
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded p-3 overflow-y-auto space-y-1.5 text-slate-300 custom-scrollbar">
                {localLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed border-b border-slate-800/40 pb-1">
                    {log}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendConsole} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={consoleInput}
                  onChange={e => setConsoleInput(e.target.value)}
                  placeholder="Nhập lệnh console (ví dụ: reload_script, set_speed 2, clear_inv)..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium text-xs transition"
                >
                  Gửi Lệnh
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
