/**
 * MiniBrowserModal - Interactive Mini Browser Details & IPC Control
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RotateCw,
  Shield,
  Terminal,
  ExternalLink,
  Sparkles,
  Trash2,
  Maximize2,
  AlertTriangle
} from 'lucide-react';
import { Profile } from '../../types';
import { MiniBrowserStatus } from '../../types/electron';
import { appBridge } from '../../services/appBridgeService';

interface MiniBrowserModalProps {
  profile: Profile | null;
  onClose: () => void;
}

export const MiniBrowserModal: React.FC<MiniBrowserModalProps> = ({
  profile,
  onClose
}) => {
  // ALL hooks MUST run unconditionally before any return guard
  const [activeTab, setActiveTab] = useState<'viewport' | 'logs'>('viewport');
  const [browserStatus, setBrowserStatus] = useState<MiniBrowserStatus | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<string[]>([]);

  const profileId = profile?.id;

  const fetchStatus = useCallback(async () => {
    if (profileId && appBridge.getMiniBrowserStatus) {
      try {
        const status = await appBridge.getMiniBrowserStatus(profileId);
        setBrowserStatus(status);
      } catch (e) {
        console.error('Error fetching mini browser status:', e);
      }
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;

    fetchStatus();

    setLocalLogs([
      `[SYS] Initialized MiniBrowser details for Profile ID: ${profileId}`,
      `[TARGET] Target site: https://hoathinh3d.co/`
    ]);

    const unsub = appBridge.onMiniBrowserStatusChanged ? appBridge.onMiniBrowserStatusChanged(status => {
      if (status.profileId === profileId) {
        setBrowserStatus(status);
        setLocalLogs(prev => [...prev, `[ELECTRON_EVENT] State: ${status.state} | URL: ${status.currentUrl || 'hoathinh3d.co'}`]);
      }
    }) : undefined;

    return () => {
      if (unsub) unsub();
    };
  }, [fetchStatus, profileId]);

  // Conditional guard MUST appear AFTER all hooks
  if (!profile) return null;

  const isNativeOpen = browserStatus?.isOpen;
  const currentState = browserStatus?.state || 'closed';

  const handleOpenOrFocusNativeBrowser = async () => {
    setIsActionLoading(true);
    try {
      if (isNativeOpen) {
        if (appBridge.focusMiniBrowser) {
          await appBridge.focusMiniBrowser(profile.id);
          setLocalLogs(prev => [...prev, `[IPC] Focus native window for profile ${profile.id}`]);
        }
      } else {
        await appBridge.openMiniBrowser(profile.id);
        setLocalLogs(prev => [...prev, `[IPC] Opened native window for profile ${profile.id}`]);
      }
      await fetchStatus();
    } catch (err: any) {
      setLocalLogs(prev => [...prev, `[ERROR] ${err?.message || err}`]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCloseNativeBrowser = async () => {
    if (!appBridge.closeMiniBrowser) return;
    setIsActionLoading(true);
    try {
      await appBridge.closeMiniBrowser(profile.id);
      setLocalLogs(prev => [...prev, `[IPC] Sent closeMiniBrowser for profile ${profile.id}`]);
      await fetchStatus();
    } catch (err: any) {
      setLocalLogs(prev => [...prev, `[ERROR] ${err?.message || err}`]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReloadNativeBrowser = async () => {
    if (!appBridge.reloadMiniBrowser) return;
    try {
      await appBridge.reloadMiniBrowser(profile.id);
      setLocalLogs(prev => [...prev, `[IPC] Reloaded native window for profile ${profile.id}`]);
    } catch (err: any) {
      setLocalLogs(prev => [...prev, `[ERROR] ${err?.message || err}`]);
    }
  };

  const handleConfirmClearSession = async () => {
    if (!appBridge.clearMiniBrowserSession) return;
    setIsClearing(true);
    setClearError(null);
    try {
      const res = await appBridge.clearMiniBrowserSession(profile.id);
      setLocalLogs(prev => [...prev, `[CLEAR_SESSION] ${res.message}`]);
      await fetchStatus();
      setIsClearing(false);
      setShowClearConfirm(false);
    } catch (err: any) {
      setIsClearing(false);
      setClearError(err?.message || 'Không thể xóa session trình duyệt.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl h-[640px] flex flex-col overflow-hidden text-slate-200 relative">
        
        {/* Top Window Bar */}
        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer" onClick={onClose}></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>

            <div className="h-4 w-px bg-slate-800 mx-1"></div>

            <span className="font-semibold text-xs text-slate-100 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isNativeOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              Mini Browser: {profile.displayName || profile.characterName}
            </span>
            <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded">
              UID: {profile.uid}
            </span>
            {isNativeOpen && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded">
                ● Cửa Sổ Đang Mở
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Address & Partition Bar */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs gap-3 shrink-0">
          <div className="flex items-center space-x-2 flex-1 bg-slate-950 px-3 py-1 rounded border border-slate-800 font-mono text-[11px] text-slate-400 truncate">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-400">Partition:</span>
            <span className="text-slate-200 truncate">{browserStatus?.partition || 'Đang lấy partition...'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenOrFocusNativeBrowser}
              disabled={isActionLoading}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded text-xs transition flex items-center gap-1.5 shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isNativeOpen ? 'Focus Native Window' : 'Mở Native Window'}</span>
            </button>

            {isNativeOpen && (
              <>
                <button
                  onClick={handleReloadNativeBrowser}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                  title="Reload Native Browser"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCloseNativeBrowser}
                  className="p-1.5 bg-slate-800 hover:bg-rose-900 text-rose-300 rounded border border-slate-700 transition"
                  title="Đóng Native Browser Window"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
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
            <span>Thông Tin Trình Duyệt</span>
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
            <span>IPC Logs</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-950 flex flex-col">
          {activeTab === 'viewport' ? (
            <div className="flex-1 flex flex-col md:flex-row h-full">
              {/* Left Display Area */}
              <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center relative border-r border-slate-800/80">
                <div className="w-full max-w-lg bg-slate-900 rounded-lg border border-slate-800 p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-300 font-bold">
                        HH3D
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-100">
                          {profile.displayName || profile.characterName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          UID: {profile.uid}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold uppercase ${
                      currentState === 'open' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      currentState === 'loading' || currentState === 'opening' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      currentState === 'error' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {currentState}
                    </span>
                  </div>

                  {browserStatus?.error && (
                    <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <div className="font-semibold">Lỗi Trình Duyệt</div>
                        <div>{browserStatus.error}</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Trạng Thái Window:</span>
                      <span className={isNativeOpen ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {isNativeOpen ? 'Đang Mở' : 'Đã Đóng'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">URL Hiện Tại:</span>
                      <span className="text-cyan-300 truncate max-w-[220px]" title={browserStatus?.currentUrl}>
                        {browserStatus?.currentUrl || 'https://hoathinh3d.co/'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Tiêu Đề Trang:</span>
                      <span className="text-slate-200 truncate max-w-[220px]" title={browserStatus?.title}>
                        {browserStatus?.title || profile.characterName}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Lần Cuối Mở:</span>
                      <span className="text-slate-300">
                        {browserStatus?.openedAt ? new Date(browserStatus.openedAt).toLocaleTimeString('vi-VN') : 'Chưa mở'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleOpenOrFocusNativeBrowser}
                      disabled={isActionLoading}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded transition flex items-center justify-center gap-2 text-xs shadow-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{isNativeOpen ? 'Focus Cửa Sổ Trình Duyệt' : 'Mở Cửa Sổ Trình Duyệt Chromium'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Control Side Panel */}
              <div className="w-full md:w-80 bg-slate-900 p-4 border-t md:border-t-0 md:border-l border-slate-800 text-xs space-y-4 overflow-y-auto">
                <h3 className="font-bold text-slate-200 uppercase text-[11px] tracking-wider border-b border-slate-800 pb-2">
                  Quản Lý Trình Duyệt & Session
                </h3>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">Electron Partition:</div>
                    <div className="font-mono text-cyan-400 text-[10px] break-all">
                      {browserStatus?.partition || 'Đang cập nhật...'}
                    </div>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Mỗi profile sử dụng một session Chromium cách ly hoàn toàn (cookies, localStorage, IndexedDB, cache).
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  {isNativeOpen && (
                    <>
                      <button
                        onClick={handleOpenOrFocusNativeBrowser}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition flex items-center justify-center gap-2"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Bring Window to Front</span>
                      </button>

                      <button
                        onClick={handleReloadNativeBrowser}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition flex items-center justify-center gap-2"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tải Lại Trang (Reload)</span>
                      </button>

                      <button
                        onClick={handleCloseNativeBrowser}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition flex items-center justify-center gap-2"
                      >
                        <X className="w-3.5 h-3.5 text-rose-400" />
                        <span>Đóng Cửa Sổ Trình Duyệt</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setClearError(null);
                      setShowClearConfirm(true);
                    }}
                    disabled={isActionLoading}
                    className="w-full py-2 bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 font-medium transition flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Xóa Session & Clear Cache</span>
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
            </div>
          )}
        </div>

        {/* Clear Session Confirmation Modal Overlay */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-rose-800 rounded-lg p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 bg-rose-950 border border-rose-800 rounded text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">Xác Nhận Xóa Session Profile</h4>
                  <p className="text-xs text-slate-400">Profile: {profile.displayName || profile.characterName}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Thao tác này sẽ đóng Mini Browser và xóa toàn bộ dữ liệu session (cookie, local storage, cache).
              </p>

              {clearError && (
                <div className="p-2.5 bg-rose-950 border border-rose-800 text-rose-300 rounded text-xs font-mono">
                  {clearError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => {
                    if (!isClearing) {
                      setShowClearConfirm(false);
                      setClearError(null);
                    }
                  }}
                  disabled={isClearing}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded text-xs font-medium transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleConfirmClearSession}
                  disabled={isClearing}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {isClearing ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang Xóa...</span>
                    </>
                  ) : (
                    <span>Xác Nhận Xóa</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
