import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Network,
  X
} from 'lucide-react';
import type { Profile, ProxyImportItem, ProxyItem } from '../../types';
import { parseMultiLineProxies } from '../../utils/proxyParser';

interface BulkOneToOneProxyModalProps {
  isOpen: boolean;
  selectedProfiles: Profile[];
  proxies: ProxyItem[];
  onClose: () => void;
  onSubmit: (profileIds: string[], proxyItems: ProxyImportItem[]) => Promise<unknown>;
}

interface UniqueProxyEntry {
  sourceLine: number;
  item: ProxyImportItem;
  duplicate: boolean;
}

function proxyIdentity(item: ProxyImportItem) {
  // Credentials are part of the identity because many providers reuse the same
  // gateway host/port while assigning a different exit IP by username/session.
  return [
    item.protocol,
    item.host.trim().toLowerCase(),
    item.port,
    item.username || '',
    item.password || ''
  ].join('|');
}

function publicEndpointIdentity(item: ProxyImportItem | ProxyItem) {
  return `${item.protocol}|${item.host.trim().toLowerCase()}|${item.port}`;
}

function formatProxyForPreview(item: ProxyImportItem) {
  const auth = item.username ? `${item.username}:••••@` : '';
  return `${item.protocol}://${auth}${item.host}:${item.port}`;
}

export const BulkOneToOneProxyModal: React.FC<BulkOneToOneProxyModalProps> = ({
  isOpen,
  selectedProfiles,
  proxies,
  onClose,
  onSubmit
}) => {
  const [proxyText, setProxyText] = useState('');
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedResults = useMemo(() => parseMultiLineProxies(proxyText), [proxyText]);

  const uniqueEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: UniqueProxyEntry[] = [];

    for (const result of parsedResults) {
      if (!result.valid || !result.item) continue;
      const identity = proxyIdentity(result.item);
      const duplicate = seen.has(identity);
      if (!duplicate) seen.add(identity);
      entries.push({
        sourceLine: result.sourceLine,
        item: result.item,
        duplicate
      });
    }

    return entries;
  }, [parsedResults]);

  const validUniqueEntries = useMemo(
    () => uniqueEntries.filter(entry => !entry.duplicate),
    [uniqueEntries]
  );

  const invalidResults = useMemo(
    () => parsedResults.filter(result => !result.valid),
    [parsedResults]
  );

  const duplicateCount = uniqueEntries.filter(entry => entry.duplicate).length;
  const maxAssignable = Math.min(selectedProfiles.length, validUniqueEntries.length);
  const usedCount = Math.min(Math.max(assignmentCount, 0), maxAssignable);
  const untouchedProfileCount = Math.max(0, selectedProfiles.length - usedCount);
  const unusedProxyCount = Math.max(0, validUniqueEntries.length - usedCount);

  const existingUnauthEndpointSet = useMemo(() => {
    return new Set(
      proxies
        .filter(proxy => !proxy.authRequired)
        .map(proxy => publicEndpointIdentity(proxy))
    );
  }, [proxies]);

  const reusedExistingCount = useMemo(() => {
    return validUniqueEntries
      .slice(0, usedCount)
      .filter(entry => (
        !entry.item.authRequired &&
        existingUnauthEndpointSet.has(publicEndpointIdentity(entry.item))
      ))
      .length;
  }, [validUniqueEntries, usedCount, existingUnauthEndpointSet]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
  }, [isOpen]);

  useEffect(() => {
    if (maxAssignable === 0) {
      setAssignmentCount(0);
      return;
    }

    setAssignmentCount(previous => {
      if (previous <= 0 || previous > maxAssignable) return maxAssignable;
      return previous;
    });
  }, [maxAssignable]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (selectedProfiles.length === 0) {
      setErrorMsg('Hãy chọn ít nhất một profile trước khi đặt proxy.');
      return;
    }
    if (usedCount <= 0) {
      setErrorMsg('Chưa có proxy hợp lệ để gán.');
      return;
    }

    const profileIds = selectedProfiles.slice(0, usedCount).map(profile => profile.id);
    const proxyItems = validUniqueEntries.slice(0, usedCount).map(entry => entry.item);

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(profileIds, proxyItems);
      onClose();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-cyan-800/70 bg-slate-900 text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-cyan-700 bg-cyan-950 p-2 text-cyan-300">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Đặt Proxy nhanh theo thứ tự 1-1</h3>
              <p className="text-[11px] text-slate-400">
                Dán danh sách proxy giống GPM Login: dòng 1 → profile 1, dòng 2 → profile 2.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-slate-800 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-0 flex-col bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-white">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  Danh sách proxy
                </label>
                <span className="text-[10px] text-slate-500">Tối đa 500 dòng/lần</span>
              </div>

              <textarea
                value={proxyText}
                onChange={event => {
                  setProxyText(event.target.value);
                  setErrorMsg(null);
                }}
                disabled={isSubmitting}
                spellCheck={false}
                placeholder={[
                  '103.166.184.5:25536:new:new',
                  '103.166.184.5:27406:new:new',
                  'http://103.82.24.174:19840',
                  'socks5://user:pass@103.82.24.174:31298'
                ].join('\n')}
                className="min-h-[330px] flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-60"
              />

              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] leading-5 text-slate-400">
                <div className="font-semibold text-slate-300">Định dạng hỗ trợ</div>
                <div>IP:Port</div>
                <div>IP:Port:User:Pass</div>
                <div>protocol://IP:Port</div>
                <div>protocol://User:Pass@IP:Port</div>
                <div className="mt-1 text-cyan-300">Không ghi protocol thì mặc định là HTTP.</div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col bg-slate-900">
              <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 sm:grid-cols-4">
                <div className="bg-slate-950 px-4 py-2 text-xs">
                  <span className="text-slate-500">Đã chọn:</span>{' '}
                  <strong className="text-white">{selectedProfiles.length} profile</strong>
                </div>
                <div className="bg-slate-950 px-4 py-2 text-xs">
                  <span className="text-slate-500">Proxy hợp lệ:</span>{' '}
                  <strong className="text-emerald-300">{validUniqueEntries.length}</strong>
                </div>
                <div className="bg-slate-950 px-4 py-2 text-xs">
                  <span className="text-slate-500">Dòng lỗi:</span>{' '}
                  <strong className={invalidResults.length ? 'text-rose-300' : 'text-slate-300'}>{invalidResults.length}</strong>
                </div>
                <div className="bg-slate-950 px-4 py-2 text-xs">
                  <span className="text-slate-500">Dòng trùng:</span>{' '}
                  <strong className={duplicateCount ? 'text-amber-300' : 'text-slate-300'}>{duplicateCount}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3">
                <label className="text-xs font-semibold text-slate-300">Số lượng cần gán:</label>
                <input
                  type="number"
                  min={maxAssignable > 0 ? 1 : 0}
                  max={maxAssignable}
                  value={assignmentCount}
                  onChange={event => {
                    const next = Number(event.target.value);
                    setAssignmentCount(Number.isFinite(next) ? Math.max(0, Math.min(maxAssignable, Math.floor(next))) : 0);
                    setErrorMsg(null);
                  }}
                  disabled={isSubmitting || maxAssignable === 0}
                  className="w-24 rounded border border-cyan-800 bg-slate-950 px-3 py-1.5 text-center font-mono text-sm font-bold text-cyan-200 outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-500">
                  Tối đa {maxAssignable}. Chỉ {usedCount} profile đầu trong danh sách đã chọn được thay đổi.
                </span>
              </div>

              {(untouchedProfileCount > 0 || unusedProxyCount > 0 || invalidResults.length > 0 || duplicateCount > 0) && (
                <div className="flex items-start gap-2 border-b border-amber-800 bg-amber-950/50 px-4 py-2.5 text-[11px] text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    {untouchedProfileCount > 0 && <div>{untouchedProfileCount} profile còn lại giữ nguyên proxy hiện tại hoặc Direct.</div>}
                    {unusedProxyCount > 0 && <div>{unusedProxyCount} proxy hợp lệ dư sẽ không được import.</div>}
                    {invalidResults.length > 0 && <div>{invalidResults.length} dòng lỗi bị bỏ qua.</div>}
                    {duplicateCount > 0 && <div>{duplicateCount} dòng proxy trùng hoàn toàn bị bỏ qua.</div>}
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-800">
                      <th className="w-14 p-3 text-center">STT</th>
                      <th className="p-3">Profile</th>
                      <th className="p-3">Proxy sẽ gán</th>
                      <th className="w-28 p-3 text-center">Nguồn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {selectedProfiles.slice(0, usedCount).map((profile, index) => {
                      const entry = validUniqueEntries[index];
                      const isExisting = entry && !entry.item.authRequired && existingUnauthEndpointSet.has(publicEndpointIdentity(entry.item));
                      return (
                        <tr key={profile.id} className="hover:bg-slate-800/40">
                          <td className="p-3 text-center font-mono text-slate-500">{index + 1}</td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-100">{profile.characterName || profile.displayName}</div>
                            <div className="font-mono text-[10px] text-cyan-400">{profile.uid}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-200">
                            {entry ? formatProxyForPreview(entry.item) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {isExisting ? (
                              <span className="rounded bg-blue-950 px-2 py-1 text-blue-300">Dùng lại</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-950 px-2 py-1 text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> Import mới
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {usedCount === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-500">
                          Chọn profile và dán danh sách proxy để xem trước mapping 1-1.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950 px-5 py-3">
            <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-400">
              <Network className="h-3.5 w-3.5 text-cyan-400" />
              Một lần bấm sẽ import proxy mới và gán theo thứ tự. Profile không nằm trong số lượng đã chọn không bị thay đổi và vẫn chạy bình thường.
              {reusedExistingCount > 0 && <span className="text-blue-300">{reusedExistingCount} proxy không auth sẽ được dùng lại.</span>}
            </div>
            {errorMsg && (
              <div className="mb-3 rounded border border-rose-800 bg-rose-950/60 p-2 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || usedCount <= 0}
                className="inline-flex items-center gap-2 rounded bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                {isSubmitting ? 'Đang import và gán...' : `Áp dụng cho ${usedCount} profile`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
