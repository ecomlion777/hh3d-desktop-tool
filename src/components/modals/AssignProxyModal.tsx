/**
 * AssignProxyModal - Assign one enabled proxy (or Direct mode) to selected profiles.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Network, X } from 'lucide-react';
import type { ProxyItem } from '../../types';

interface AssignProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  proxies: ProxyItem[];
  onSubmit: (proxyId: string) => Promise<void>;
}

export const AssignProxyModal: React.FC<AssignProxyModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  proxies,
  onSubmit
}) => {
  const enabledProxies = useMemo(
    () => proxies.filter(proxy => proxy.enabled),
    [proxies]
  );
  const [selectedProxyId, setSelectedProxyId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsSubmitting(false);
    if (selectedProxyId && !enabledProxies.some(proxy => proxy.id === selectedProxyId)) {
      setSelectedProxyId('');
    }
  }, [isOpen, enabledProxies, selectedProxyId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(selectedProxyId);
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
          <div className="flex items-center space-x-2">
            <Network className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100">Gán Proxy Hàng Loạt</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 text-xs">
          <p className="text-slate-300">
            Chọn cấu hình mạng cho <span className="font-bold text-cyan-400">{selectedCount}</span> profile đã chọn.
          </p>

          <div>
            <label className="mb-1 block font-medium text-slate-400">Chọn Proxy</label>
            <select
              value={selectedProxyId}
              onChange={event => setSelectedProxyId(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-60"
            >
              <option value="">Không dùng Proxy (Direct)</option>
              {enabledProxies.map(proxy => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.name} ({proxy.protocol}://{proxy.host}:{proxy.port})
                </option>
              ))}
            </select>
          </div>

          {selectedProxyId && (
            <div className="flex gap-2 rounded border border-amber-900/70 bg-amber-950/40 p-2 text-[11px] text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Nếu Mini Browser đang mở, ứng dụng sẽ đóng cửa sổ đó trước khi đổi cấu hình mạng và sẽ không tự mở lại.</span>
            </div>
          )}

          {enabledProxies.length === 0 && (
            <p className="rounded border border-slate-700 bg-slate-950 p-2 text-[11px] text-slate-400">
              Chưa có proxy đang bật. Bạn vẫn có thể chọn Direct để bỏ gán proxy.
            </p>
          )}

          {errorMsg && (
            <div className="rounded border border-rose-800 bg-rose-950/60 p-2 text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded bg-slate-800 px-4 py-2 font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedCount <= 0}
              className="flex items-center gap-1.5 rounded bg-cyan-600 px-4 py-2 font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? 'Đang áp dụng...' : 'Gán Proxy'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
