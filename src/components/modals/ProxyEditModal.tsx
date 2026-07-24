import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, FileUp, KeyRound, Network, X } from 'lucide-react';
import type {
  ProxyCreateInput,
  ProxyImportItem,
  ProxyItem,
  ProxyProtocol,
  ProxyUpdateInput
} from '../../types';
import { parseMultiLineProxies } from '../../utils/proxyParser';

interface ProxyEditModalProps {
  isOpen: boolean;
  proxy?: ProxyItem | null;
  onClose: () => void;
  onSubmit: (data: ProxyCreateInput | ProxyUpdateInput) => Promise<void>;
  onImport: (items: ProxyImportItem[]) => Promise<void>;
}

export const ProxyEditModal: React.FC<ProxyEditModalProps> = ({
  isOpen,
  proxy,
  onClose,
  onSubmit,
  onImport
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<ProxyProtocol>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [enabled, setEnabled] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clearCredentials, setClearCredentials] = useState(false);
  const [notes, setNotes] = useState('');
  const [rawText, setRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode('single');
    setName(proxy?.name || '');
    setProtocol(proxy?.protocol || 'http');
    setHost(proxy?.host || '');
    setPort(String(proxy?.port || 8080));
    setEnabled(proxy?.enabled !== false);
    setAuthRequired(Boolean(proxy?.authRequired));
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setClearCredentials(false);
    setNotes(proxy?.notes || '');
    setRawText('');
    setErrorMsg(null);
  }, [isOpen, proxy]);

  const parsedLines = useMemo(() => parseMultiLineProxies(rawText), [rawText]);
  const validItems = useMemo(
    () => parsedLines.filter(line => line.valid && line.item).map(line => line.item!) as ProxyImportItem[],
    [parsedLines]
  );
  const invalidLines = useMemo(() => parsedLines.filter(line => !line.valid), [parsedLines]);

  if (!isOpen) return null;

  const handleSingleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const portNumber = Number(port);
    if (!name.trim() || !host.trim() || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      setErrorMsg('Vui lòng nhập tên, host và port hợp lệ.');
      return;
    }

    if (!proxy && authRequired && (!username.trim() || !password)) {
      setErrorMsg('Proxy xác thực mới cần đầy đủ username và password.');
      return;
    }

    const base = {
      name: name.trim(),
      protocol,
      host: host.trim(),
      port: portNumber,
      enabled,
      authRequired: clearCredentials ? false : authRequired,
      notes: notes.trim()
    };

    const payload: ProxyCreateInput | ProxyUpdateInput = proxy
      ? {
          ...base,
          username: username.trim() || undefined,
          password: password || undefined,
          clearCredentials
        }
      : {
          ...base,
          username: authRequired ? username.trim() : undefined,
          password: authRequired ? password : undefined
        };

    try {
      setIsSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (validItems.length === 0) {
      setErrorMsg('Không có dòng proxy hợp lệ để import.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onImport(validItems);
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">{proxy ? 'Chỉnh Sửa Proxy' : 'Thêm / Import Proxy'}</h3>
              <p className="text-[11px] text-slate-400">Mật khẩu chỉ được gửi tới Electron Main để mã hóa bằng hệ điều hành.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!proxy && (
          <div className="flex border-b border-slate-800 bg-slate-950 px-4">
            <button onClick={() => setMode('single')} className={`px-4 py-2 text-xs font-semibold ${mode === 'single' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-slate-400'}`}>
              Thêm Một Proxy
            </button>
            <button onClick={() => setMode('bulk')} className={`px-4 py-2 text-xs font-semibold ${mode === 'bulk' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-slate-400'}`}>
              Import Hàng Loạt
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="m-4 flex items-start gap-2 rounded border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {(proxy || mode === 'single') ? (
          <form onSubmit={handleSingleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto p-4 text-xs">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-slate-400">Tên Proxy</span>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 outline-none focus:border-amber-500" />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Protocol</span>
                <select value={protocol} onChange={e => setProtocol(e.target.value as ProxyProtocol)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 outline-none focus:border-amber-500">
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks4">SOCKS4</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Host</span>
                <input value={host} onChange={e => setHost(e.target.value)} placeholder="127.0.0.1" className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono outline-none focus:border-amber-500" />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Port</span>
                <input type="number" min={1} max={65535} value={port} onChange={e => setPort(e.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono outline-none focus:border-amber-500" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 p-3">
                <div>
                  <span className="block font-semibold">Bật proxy</span>
                  <span className="text-[10px] text-slate-500">Proxy bị tắt không thể gán hoặc mở Mini Browser.</span>
                </div>
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 p-3">
                <div>
                  <span className="block font-semibold">Có xác thực</span>
                  <span className="text-[10px] text-slate-500">Credential được mã hóa ngoài app-data.json.</span>
                </div>
                <input type="checkbox" checked={authRequired} disabled={clearCredentials} onChange={e => setAuthRequired(e.target.checked)} />
              </label>
            </div>

            {authRequired && !clearCredentials && (
              <div className="grid grid-cols-1 gap-3 rounded border border-amber-900/60 bg-amber-950/20 p-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="flex items-center gap-1 text-amber-300"><KeyRound className="h-3.5 w-3.5" /> Username</span>
                  <input value={username} onChange={e => setUsername(e.target.value)} placeholder={proxy?.maskedUsername || 'username'} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono outline-none focus:border-amber-500" />
                </label>
                <label className="space-y-1">
                  <span className="text-amber-300">Password {proxy && '(để trống để giữ nguyên)'}</span>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 pr-9 font-mono outline-none focus:border-amber-500" />
                    <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-2 top-2 text-slate-500 hover:text-slate-200">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              </div>
            )}

            {proxy?.hasCredentials && (
              <label className="flex items-center gap-2 text-rose-300">
                <input type="checkbox" checked={clearCredentials} onChange={e => setClearCredentials(e.target.checked)} />
                <span>Xóa credential đã lưu và chuyển proxy sang không xác thực</span>
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-slate-400">Ghi chú</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 outline-none focus:border-amber-500" />
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700">Hủy</button>
              <button type="submit" disabled={isSubmitting} className="flex items-center gap-1 rounded bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> {isSubmitting ? 'Đang lưu...' : 'Lưu Proxy'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="max-h-[75vh] space-y-3 overflow-y-auto p-4 text-xs">
            <label className="block space-y-1">
              <span className="flex items-center gap-1 text-slate-300"><FileUp className="h-4 w-4 text-amber-400" /> Mỗi dòng một proxy, tối đa 500 dòng</span>
              <textarea
                rows={10}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={'host:port\nhost:port:username:password\nprotocol://host:port\nprotocol://username:password@host:port'}
                className="w-full rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] outline-none focus:border-amber-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-emerald-800 bg-emerald-950/30 p-3 text-emerald-300">Hợp lệ: <strong>{validItems.length}</strong></div>
              <div className="rounded border border-rose-800 bg-rose-950/30 p-3 text-rose-300">Không hợp lệ: <strong>{invalidLines.length}</strong></div>
            </div>
            {invalidLines.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] text-rose-300">
                {invalidLines.slice(0, 20).map(line => <div key={line.sourceLine}>Dòng {line.sourceLine}: {line.error}</div>)}
              </div>
            )}
            <p className="text-[10px] text-slate-500">Preview không hiển thị password. Import không tự động test proxy.</p>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded bg-slate-800 px-4 py-2">Hủy</button>
              <button type="submit" disabled={isSubmitting || validItems.length === 0} className="rounded bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                {isSubmitting ? 'Đang import...' : `Import ${validItems.length} Proxy`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
