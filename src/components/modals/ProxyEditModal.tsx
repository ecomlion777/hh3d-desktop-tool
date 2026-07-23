/**
 * ProxyEditModal - Add Proxy (Single Manual Add & Bulk Import Tabs)
 */

import React, { useState, useMemo } from 'react';
import { X, ShieldCheck, CheckCircle2, Eye, EyeOff, Plus, FileText, AlertCircle } from 'lucide-react';
import { ProxyItem } from '../../types';
import { parseMultiLineProxies, parseProxyLine } from '../../utils/proxyParser';

interface ProxyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSingleProxy: (data: Partial<ProxyItem>) => Promise<void>;
  onSubmitBulkProxies: (lines: string[]) => Promise<void>;
}

export const ProxyEditModal: React.FC<ProxyEditModalProps> = ({
  isOpen,
  onClose,
  onSubmitSingleProxy,
  onSubmitBulkProxies
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Single Proxy Form State
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<'HTTP' | 'HTTPS' | 'SOCKS5' | 'SOCKS4'>('SOCKS5');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [location, setLocation] = useState('Việt Nam (Hà Nội)');

  // Bulk Import State
  const [rawText, setRawText] = useState('');

  // Real-time parsed list preview
  const parsedBulkItems = useMemo(() => {
    if (!rawText.trim()) return [];
    return parseMultiLineProxies(rawText);
  }, [rawText]);

  const rawLinesCount = useMemo(() => {
    return rawText.split('\n').filter(l => l.trim().length > 0).length;
  }, [rawText]);

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim()) {
      alert('Vui lòng nhập Host / IP của Proxy!');
      return;
    }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      alert('Cổng (Port) không hợp lệ (1 - 65535)!');
      return;
    }

    await onSubmitSingleProxy({
      name: name.trim() || undefined,
      protocol,
      host: host.trim(),
      port: portNum,
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      location: location.trim() || undefined
    });

    onClose();
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = rawText.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      alert('Vui lòng nhập ít nhất một dòng Proxy!');
      return;
    }
    if (parsedBulkItems.length === 0) {
      alert('Không nhận diện được dòng Proxy hợp lệ nào!');
      return;
    }

    await onSubmitBulkProxies(lines);
    setRawText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-xl overflow-hidden text-slate-200 flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-slate-100">Thêm Proxy Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === 'single'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Thủ Công (1 Proxy)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === 'bulk'
                ? 'border-amber-500 text-amber-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Import Hàng Loạt (Multi-line)</span>
          </button>
        </div>

        {/* Tab 1: Single Proxy Form */}
        {activeTab === 'single' && (
          <form onSubmit={handleSingleSubmit} className="p-4 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Tên Proxy (Tùy chọn)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ví dụ: Proxy Chạy Clone #1"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Giao Thức (Protocol)</label>
                <select
                  value={protocol}
                  onChange={e => setProtocol(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="SOCKS5">SOCKS5 (Khuyên dùng)</option>
                  <option value="HTTP">HTTP</option>
                  <option value="HTTPS">HTTPS</option>
                  <option value="SOCKS4">SOCKS4</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-slate-400 font-medium mb-1">IP / Host <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  required
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="103.142.10.150"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Cổng (Port) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  required
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  placeholder="8080"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Tài khoản (Username)</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Để trống nếu không có"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Mật khẩu (Password)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-3 pr-8 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Vị Trí / Quốc Gia</label>
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="Việt Nam (Hà Nội)">Việt Nam (Hà Nội)</option>
                <option value="Việt Nam (TP.HCM)">Việt Nam (TP.HCM)</option>
                <option value="Singapore">Singapore</option>
                <option value="Japan (Tokyo)">Japan (Tokyo)</option>
                <option value="Hong Kong">Hong Kong</option>
                <option value="USA (West)">USA (West)</option>
              </select>
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Thêm Proxy</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Bulk Import Form */}
        {activeTab === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="p-4 space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-400 font-medium">
                  Danh Sách Proxy (Mỗi dòng 1 Proxy)
                </label>
                {rawLinesCount > 0 && (
                  <span className="text-[11px] text-amber-400 font-mono">
                    Đã nhận diện: {parsedBulkItems.length} / {rawLinesCount} dòng
                  </span>
                )}
              </div>

              <textarea
                rows={7}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Hỗ trợ các định dạng:\n103.142.20.101:8080\n103.142.20.102:8080:username:password\nuser:pass@103.142.20.103:8080\nhttp://user:pass@103.142.20.104:8080\nsocks5://user:pass@103.142.20.105:8080`}
                className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-[11px] leading-relaxed"
              ></textarea>
            </div>

            {/* Supported Formats Info */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] space-y-1">
              <div className="font-semibold text-slate-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Các định dạng được tự động nhận diện:</span>
              </div>
              <ul className="text-slate-400 space-y-0.5 list-disc pl-4 font-mono text-[10px]">
                <li><code className="text-amber-300">ip:port</code></li>
                <li><code className="text-amber-300">ip:port:user:pass</code></li>
                <li><code className="text-amber-300">user:pass@ip:port</code></li>
                <li><code className="text-amber-300">http://user:pass@ip:port</code></li>
                <li><code className="text-amber-300">socks5://user:pass@ip:port</code></li>
              </ul>
            </div>

            {/* Live Parse Preview Sample */}
            {parsedBulkItems.length > 0 && (
              <div className="bg-slate-950 p-2 rounded border border-amber-900/50 max-h-24 overflow-y-auto">
                <div className="text-[10px] text-amber-400 font-bold mb-1">Xem trước mẫu ({parsedBulkItems.length} proxy):</div>
                <div className="space-y-1 font-mono text-[10px]">
                  {parsedBulkItems.slice(0, 4).map((p, i) => (
                    <div key={i} className="text-slate-300 flex items-center justify-between border-b border-slate-900 pb-0.5">
                      <span>[{p.protocol}] {p.ipPort}</span>
                      <span className="text-slate-500">{p.username ? `User: ${p.username} (Password hidden)` : 'Không user'}</span>
                    </div>
                  ))}
                  {parsedBulkItems.length > 4 && (
                    <div className="text-slate-500 text-[9px] italic">+ {parsedBulkItems.length - 4} proxy khác...</div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác Nhận Import ({parsedBulkItems.length})</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
