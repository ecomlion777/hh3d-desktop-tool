/**
 * EditProfileModal - Edit Single Game Profile
 */

import React, { useState, useEffect } from 'react';
import { X, Settings, Save, AlertCircle } from 'lucide-react';
import { Profile, GroupItem, ProxyItem } from '../../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  groups: GroupItem[];
  proxies: ProxyItem[];
  existingProfiles: Profile[];
  onSubmit: (id: string, updatedData: Partial<Profile>) => Promise<void>;
}


export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  groups,
  proxies,
  existingProfiles,
  onSubmit
}) => {
  const [characterName, setCharacterName] = useState('');
  const [uid, setUid] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedProxyId, setSelectedProxyId] = useState('');
  const [level, setLevel] = useState<number>(70);
  const [stamina, setStamina] = useState<number>(100);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setCharacterName(profile.characterName || profile.displayName || '');
      setUid(profile.uid || '');
      
      const initGroupId = profile.groupId || groups.find(g => g.name === profile.group)?.id || groups[0]?.id || '';
      setSelectedGroupId(initGroupId);

      setSelectedProxyId(profile.proxyId || '');
      setLevel(profile.level || 70);
      setStamina(profile.stamina || 100);
      setNotes(profile.notes || '');
      setErrorMsg(null);
    }
  }, [profile, groups, proxies]);

  if (!isOpen || !profile) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    // Validate UID not empty
    const cleanUid = uid.trim();
    if (!cleanUid) {
      setErrorMsg('UID Game không được để trống!');
      return;
    }

    // Validate Character Name non empty
    const cleanName = characterName.trim();
    if (!cleanName) {
      setErrorMsg('Tên nhân vật không được để trống!');
      return;
    }

    // Find proxy address
    const px = proxies.find(p => p.id === selectedProxyId);
    const pxAddress = px ? `${px.host}:${px.port}` : 'Không dùng Proxy';
    const pxIp = '';

    const targetGroup = groups.find(g => g.id === selectedGroupId);

    try {
      setIsSubmitting(true);
      await onSubmit(profile.id, {
        characterName: cleanName,
        displayName: cleanName,
        uid: cleanUid,
        groupId: selectedGroupId,
        group: targetGroup ? targetGroup.name : 'Chưa Phân Nhóm',
        proxyId: selectedProxyId,
        proxyAddress: pxAddress,
        currentIp: pxIp,
        level: Number(level) || 1,
        stamina: Number(stamina) || 0,
        notes: notes.trim()
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi cập nhật profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Chỉnh Sửa Profile: <span className="text-cyan-400 font-mono">{profile.uid}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Internal ID Read-only display */}
          <div className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-500">Internal ID:</span>
            <span className="text-slate-300 font-semibold">{profile.id}</span>
          </div>

          {/* Name & UID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Tên Nhân Vật *</label>
              <input
                type="text"
                required
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">UID Game *</label>
              <input
                type="text"
                required
                value={uid}
                onChange={e => setUid(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Group & Proxy */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Nhóm Profile</label>
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
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
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="">Không dùng Proxy (Direct)</option>
                    {proxies.filter(px => px.enabled || px.id === profile.proxyId).map(px => (
                  <option key={px.id} value={px.id}>
                    {px.name} ({px.protocol}://{px.host}:{px.port}){px.enabled ? '' : ' — Đang tắt'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Level & Stamina */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Cấp Độ (Level)</label>
              <input
                type="number"
                min={1}
                max={200}
                value={level}
                onChange={e => setLevel(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Thể Lực (Stamina)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={stamina}
                onChange={e => setStamina(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>


          <div className="rounded border border-cyan-900/70 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-200">
            Module được quản lý bằng nút <strong>Module</strong> trong Profile Manager để bảo đảm đồng bộ với Module Framework.
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Ghi Chú</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú riêng cho tài khoản này..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            ></textarea>
          </div>

          {/* Footer Buttons */}
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
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
