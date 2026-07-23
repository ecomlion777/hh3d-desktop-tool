/**
 * AddProfileModal - Add Single or Bulk Game Profiles
 */

import React, { useState, useEffect } from 'react';
import { X, UserPlus, FileText, CheckCircle2, Shield, AlertCircle } from 'lucide-react';
import { Profile, GroupItem, ProxyItem } from '../../types';

interface AddProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupItem[];
  proxies: ProxyItem[];
  existingProfiles?: Profile[];
  onSubmitSingle: (data: { characterName: string; uid: string; group: string; groupId?: string; proxyId: string }) => Promise<void>;
  onSubmitBulk: (rawLines: string[], group: string, proxyId: string, groupId?: string) => Promise<void>;
}

export const AddProfileModal: React.FC<AddProfileModalProps> = ({
  isOpen,
  onClose,
  groups,
  proxies,
  existingProfiles = [],
  onSubmitSingle,
  onSubmitBulk
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [characterName, setCharacterName] = useState('');
  const [uid, setUid] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || '');
  const [selectedProxyId, setSelectedProxyId] = useState(proxies[0]?.id || '');
  const [bulkText, setBulkText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (!selectedGroupId || !groups.some(g => g.id === selectedGroupId)) {
        setSelectedGroupId(groups[0]?.id || '');
      }
      if (!selectedProxyId || !proxies.some(p => p.id === selectedProxyId)) {
        setSelectedProxyId(proxies[0]?.id || '');
      }
    }
  }, [isOpen, groups, proxies]);

  if (!isOpen) return null;

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const cleanUid = uid.trim();
    if (!cleanUid) {
      setErrorMsg('UID Game không được để trống!');
      return;
    }

    const cleanName = characterName.trim();
    if (!cleanName) {
      setErrorMsg('Tên nhân vật không được để trống!');
      return;
    }

    const targetGroup = groups.find(g => g.id === selectedGroupId);

    try {
      setIsSubmitting(true);
      await onSubmitSingle({
        characterName: cleanName,
        uid: cleanUid,
        groupId: selectedGroupId,
        group: targetGroup ? targetGroup.name : (groups[0]?.name || 'Nhóm Chính (Main)'),
        proxyId: selectedProxyId
      });
      onClose();
    } catch (error: any) {
      setErrorMsg(error?.message || 'Không thể thêm profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setErrorMsg('Vui lòng nhập ít nhất một tài khoản!');
      return;
    }

    // Validate that each line has a non-empty UID part
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('|');
      const uidPart = (parts[0] || '').trim();
      if (!uidPart) {
        setErrorMsg(`Lỗi dòng ${i + 1}: UID không được để trống!`);
        return;
      }
    }

    const targetGroup = groups.find(g => g.id === selectedGroupId);

    try {
      setIsSubmitting(true);
      await onSubmitBulk(
        lines,
        targetGroup ? targetGroup.name : (groups[0]?.name || 'Nhóm Chính (Main)'),
        selectedProxyId,
        selectedGroupId
      );
      onClose();
    } catch (error: any) {
      setErrorMsg(error?.message || 'Không thể nhập hàng loạt profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Thêm Profile Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 text-xs">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`py-2 px-4 border-b-2 font-medium transition ${
              mode === 'single'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Thêm 1 Profile
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`py-2 px-4 border-b-2 font-medium transition ${
              mode === 'bulk'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Nhập Hàng Loạt (Bulk)
          </button>
        </div>

        {/* Form Body */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="p-4 space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Tên Nhân Vật *</label>
              <input
                type="text"
                required
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                placeholder="Ví dụ: ThiênSứ_HH3D_99"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">UID Game *</label>
              <input
                type="text"
                required
                value={uid}
                onChange={e => setUid(e.target.value)}
                placeholder="Ví dụ: HH3D-99881"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Chọn Nhóm</label>
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Gán Proxy</label>
                <select
                  value={selectedProxyId}
                  onChange={e => setSelectedProxyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                >
                  {proxies.map(px => (
                    <option key={px.id} value={px.id}>{px.name} ({px.ipPort})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang Lưu...' : 'Thêm Profile'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="p-4 space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">
                Danh sách UID | Tên Nhân Vật (Mỗi dòng một tài khoản)
              </label>
              <textarea
                rows={6}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={`HH3D-10001|ThầnLong_01\nHH3D-10002|ThầnLong_02\nHH3D-10003|ThầnLong_03`}
                className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
              ></textarea>
              <p className="text-[10px] text-slate-500 mt-1">Định dạng: UID|Tên_Nhân_Vật hoặc chỉ UID mỗi dòng</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Chọn Nhóm Gán Nhập</label>
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Gán Proxy Xoay Vòng</label>
                <select
                  value={selectedProxyId}
                  onChange={e => setSelectedProxyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                >
                  {proxies.map(px => (
                    <option key={px.id} value={px.id}>{px.name} ({px.ipPort})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang Nhập...' : 'Nhập Hàng Loạt'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
