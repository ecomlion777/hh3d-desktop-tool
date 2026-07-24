import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  KeyRound,
  Loader2,
  Network,
  Plus,
  Power,
  RotateCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react';
import type { Profile, ProxyItem, ProxyTestResult } from '../../types';
import { AssignProfilesToProxyModal } from '../modals/AssignProfilesToProxyModal';

interface ProxyManagerViewProps {
  proxies: ProxyItem[];
  profiles: Profile[];
  onTestProxy: (id: string) => Promise<ProxyTestResult>;
  onTestAllProxies: () => Promise<ProxyTestResult[]>;
  onOpenAddProxyModal: () => void;
  onEditProxy: (proxy: ProxyItem) => void;
  onDeleteProxies: (ids: string[]) => Promise<void>;
  onToggleEnabled: (proxy: ProxyItem) => Promise<void>;
  onAssignProfilesToProxy: (proxyId: string, profileIds: string[]) => Promise<void>;
  onError: (message: string) => void;
}

export const ProxyManagerView: React.FC<ProxyManagerViewProps> = ({
  proxies,
  profiles,
  onTestProxy,
  onTestAllProxies,
  onOpenAddProxyModal,
  onEditProxy,
  onDeleteProxies,
  onToggleEnabled,
  onAssignProfilesToProxy,
  onError
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [assignModalProxy, setAssignModalProxy] = useState<ProxyItem | null>(null);
  const [deleteCandidateIds, setDeleteCandidateIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return proxies;
    return proxies.filter(proxy => [
      proxy.name,
      proxy.protocol,
      proxy.host,
      String(proxy.port),
      proxy.maskedUsername || '',
      proxy.publicIp || ''
    ].some(value => value.toLowerCase().includes(query)));
  }, [proxies, filterText]);

  const allSelected = filtered.length > 0 && filtered.every(proxy => selectedIds.includes(proxy.id));
  const deleteCandidates = useMemo(
    () => proxies.filter(proxy => deleteCandidateIds.includes(proxy.id)),
    [deleteCandidateIds, proxies]
  );
  const affectedProfileCount = useMemo(
    () => deleteCandidates.reduce((total, proxy) => total + (proxy.assignedProfileCount || 0), 0),
    [deleteCandidates]
  );

  const handleTest = async (proxyId: string) => {
    try {
      setTestingIds(previous => new Set(previous).add(proxyId));
      await onTestProxy(proxyId);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setTestingIds(previous => {
        const next = new Set(previous);
        next.delete(proxyId);
        return next;
      });
    }
  };

  const handleTestAll = async () => {
    try {
      setIsTestingAll(true);
      await onTestAllProxies();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsTestingAll(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteCandidateIds.length === 0 || isDeleting) return;
    try {
      setIsDeleting(true);
      await onDeleteProxies(deleteCandidateIds);
      setSelectedIds(previous => previous.filter(id => !deleteCandidateIds.includes(id)));
      setDeleteCandidateIds([]);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const testBadge = (proxy: ProxyItem) => {
    const testing = testingIds.has(proxy.id) || proxy.testState === 'testing';
    if (testing) return <span className="inline-flex items-center gap-1 rounded border border-cyan-800 bg-cyan-950 px-2 py-0.5 text-cyan-300"><Loader2 className="h-3 w-3 animate-spin" /> Đang test</span>;
    if (proxy.testState === 'online') return <span className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Online</span>;
    if (proxy.testState === 'timeout') return <span className="inline-flex items-center gap-1 rounded border border-amber-800 bg-amber-950 px-2 py-0.5 text-amber-300"><Clock className="h-3 w-3" /> Timeout</span>;
    if (['offline', 'auth_error', 'configuration_error'].includes(proxy.testState)) return <span className="inline-flex items-center gap-1 rounded border border-rose-800 bg-rose-950 px-2 py-0.5 text-rose-300"><AlertTriangle className="h-3 w-3" /> {proxy.testState}</span>;
    return <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-400">Chưa test</span>;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-900 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center gap-3">
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-400"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold">Proxy Manager <span className="ml-2 rounded bg-amber-950 px-2 py-0.5 font-mono text-xs text-amber-300">{proxies.length}</span></h2>
            <p className="text-xs text-slate-400">Proxy thật theo persistent partition; proxy lỗi không tự chuyển sang Direct.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleTestAll} disabled={isTestingAll || proxies.length === 0} className="flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
            {isTestingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />} Test Tất Cả
          </button>
          <button onClick={onOpenAddProxyModal} className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"><Plus className="h-3.5 w-3.5 text-amber-400" /> Thêm / Import</button>
          {selectedIds.length > 0 && <button onClick={() => setDeleteCandidateIds(selectedIds)} className="flex items-center gap-1 rounded border border-rose-800 bg-rose-950 px-3 py-1.5 text-xs text-rose-200"><Trash2 className="h-3.5 w-3.5" /> Xóa ({selectedIds.length})</button>}
        </div>
      </div>

      <div className="border-b border-slate-800 p-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input value={filterText} onChange={event => setFilterText(event.target.value)} placeholder="Tìm tên, host, protocol, IP..." className="w-full rounded border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-amber-500" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[1280px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-950 text-[10px] uppercase text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="p-3"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : filtered.map(proxy => proxy.id))} /></th>
              <th className="p-3">Tên</th><th className="p-3">Protocol</th><th className="p-3">Endpoint</th><th className="p-3">Xác thực</th><th className="p-3">Profiles</th><th className="p-3">Test</th><th className="p-3">Public IP</th><th className="p-3">Latency</th><th className="p-3">Lần cuối</th><th className="p-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="p-10 text-center text-slate-500">Chưa có proxy hoặc không tìm thấy kết quả phù hợp.</td></tr>
            ) : filtered.map(proxy => (
              <tr key={proxy.id} className={`border-b border-slate-800/80 hover:bg-slate-800/40 ${proxy.enabled ? '' : 'opacity-60'}`}>
                <td className="p-3"><input type="checkbox" checked={selectedIds.includes(proxy.id)} onChange={() => setSelectedIds(previous => previous.includes(proxy.id) ? previous.filter(id => id !== proxy.id) : [...previous, proxy.id])} /></td>
                <td className="p-3"><div className="font-semibold text-slate-100">{proxy.name}</div><div className="mt-0.5 text-[10px] text-slate-500">{proxy.enabled ? 'Enabled' : 'Disabled'}</div></td>
                <td className="p-3"><span className="rounded border border-cyan-900 bg-cyan-950 px-2 py-0.5 font-mono text-cyan-300">{proxy.protocol.toUpperCase()}</span></td>
                <td className="p-3 font-mono text-slate-300">{proxy.host}:{proxy.port}</td>
                <td className="p-3">
                  {proxy.hasCredentials ? <div className="flex items-center gap-1 text-emerald-300"><KeyRound className="h-3.5 w-3.5" /> Credentials saved {proxy.maskedUsername ? `(${proxy.maskedUsername})` : ''}</div> : proxy.authRequired ? <div className="flex items-center gap-1 text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> Credentials missing</div> : <span className="text-slate-400">Không xác thực</span>}
                </td>
                <td className="p-3"><button onClick={() => setAssignModalProxy(proxy)} className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200"><Users className="h-3.5 w-3.5" /> {proxy.assignedProfileCount || 0}</button></td>
                <td className="p-3">{testBadge(proxy)}{proxy.testError && <div className="mt-1 max-w-[180px] truncate text-[10px] text-rose-300" title={proxy.testError}>{proxy.testError}</div>}</td>
                <td className="p-3 font-mono text-emerald-300">{proxy.publicIp || '--'}</td>
                <td className="p-3 font-mono">{proxy.latencyMs !== undefined ? `${proxy.latencyMs} ms` : '--'}</td>
                <td className="p-3 text-slate-400">{proxy.lastCheckedAt ? new Date(proxy.lastCheckedAt).toLocaleString('vi-VN') : '--'}</td>
                <td className="p-3"><div className="flex justify-center gap-1">
                  <button title="Test" onClick={() => handleTest(proxy.id)} disabled={testingIds.has(proxy.id)} className="rounded border border-slate-700 bg-slate-800 p-1.5 hover:bg-slate-700 disabled:opacity-50"><RotateCw className="h-3.5 w-3.5 text-cyan-400" /></button>
                  <button title="Sửa" onClick={() => onEditProxy(proxy)} className="rounded border border-slate-700 bg-slate-800 p-1.5 hover:bg-slate-700"><Edit3 className="h-3.5 w-3.5 text-amber-400" /></button>
                  <button title={proxy.enabled ? 'Tắt proxy' : 'Bật proxy'} onClick={async () => { try { await onToggleEnabled(proxy); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }} className="rounded border border-slate-700 bg-slate-800 p-1.5 hover:bg-slate-700"><Power className={`h-3.5 w-3.5 ${proxy.enabled ? 'text-emerald-400' : 'text-rose-400'}`} /></button>
                  <button title="Gán profile" onClick={() => setAssignModalProxy(proxy)} className="rounded border border-slate-700 bg-slate-800 p-1.5 hover:bg-slate-700"><Network className="h-3.5 w-3.5 text-purple-400" /></button>
                  <button title="Xóa" onClick={() => setDeleteCandidateIds([proxy.id])} className="rounded border border-rose-900 bg-rose-950 p-1.5 hover:bg-rose-900"><Trash2 className="h-3.5 w-3.5 text-rose-300" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignProfilesToProxyModal
        isOpen={Boolean(assignModalProxy)}
        proxy={assignModalProxy}
        profiles={profiles}
        onClose={() => setAssignModalProxy(null)}
        onSubmit={async (proxyId, profileIds) => {
          try {
            await onAssignProfilesToProxy(proxyId, profileIds);
          } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
            throw error;
          }
        }}
      />

      {deleteCandidateIds.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-rose-900 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
              <div className="flex items-center gap-2 text-rose-300"><AlertTriangle className="h-5 w-5" /><h3 className="text-sm font-bold">Xác nhận xóa proxy</h3></div>
              <button onClick={() => setDeleteCandidateIds([])} disabled={isDeleting} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 p-4 text-xs text-slate-300">
              <p>Bạn sắp xóa <strong className="text-rose-300">{deleteCandidateIds.length} proxy</strong>.</p>
              <p>{affectedProfileCount > 0 ? `${affectedProfileCount} profile đang dùng các proxy này sẽ được chuyển về Direct.` : 'Không có profile nào đang được gán các proxy này.'}</p>
              <p className="text-slate-400">Profile, cookie và session Mini Browser không bị xóa.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3">
              <button onClick={() => setDeleteCandidateIds([])} disabled={isDeleting} className="rounded bg-slate-800 px-4 py-1.5 text-xs hover:bg-slate-700 disabled:opacity-50">Hủy</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex items-center gap-1.5 rounded bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50">{isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Xóa proxy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
