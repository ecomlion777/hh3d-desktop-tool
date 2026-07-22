/**
 * ImportProfilesModal - Import Profiles from JSON
 */

import React, { useState } from 'react';
import { X, FileJson, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Profile } from '../../types';

interface ImportProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProfiles: Profile[];
  onImportSuccess: (importedProfiles: Partial<Profile>[]) => Promise<void>;
}

export const ImportProfilesModal: React.FC<ImportProfilesModalProps> = ({
  isOpen,
  onClose,
  existingProfiles,
  onImportSuccess
}) => {
  if (!isOpen) return null;

  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const raw = jsonText.trim();
    if (!raw) {
      setErrorMsg('Vui lòng dán nội dung JSON hoặc tải lên file .json!');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      setErrorMsg(`Cú pháp JSON không hợp lệ: ${err.message}`);
      return;
    }

    const items: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.profiles)
      ? parsed.profiles
      : [parsed];

    if (items.length === 0) {
      setErrorMsg('Không tìm thấy dữ liệu profile nào trong JSON!');
      return;
    }

    // Existing internal IDs & UIDs set for validation
    const existingIds = new Set(existingProfiles.map(p => p.id));
    const seenImportIds = new Set<string>();

    const validatedProfiles: Partial<Profile>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemIndex = i + 1;

      // 1. Validate UID not empty
      const uidVal = (item.uid || item.UID || '').toString().trim();
      if (!uidVal) {
        setErrorMsg(`Lỗi ở phần tử thứ ${itemIndex}: UID không được để trống!`);
        return;
      }

      // 2. Validate internal ID duplicate
      const idVal = (item.id || item.ID || '').toString().trim();
      if (idVal) {
        if (existingIds.has(idVal)) {
          setErrorMsg(`Lỗi ở phần tử thứ ${itemIndex}: Internal ID "${idVal}" đã tồn tại trong hệ thống!`);
          return;
        }
        if (seenImportIds.has(idVal)) {
          setErrorMsg(`Lỗi ở phần tử thứ ${itemIndex}: Internal ID "${idVal}" bị trùng lặp trong file JSON!`);
          return;
        }
        seenImportIds.add(idVal);
      }

      const charName = item.characterName || item.displayName || item.name || `Imported_${uidVal}`;

      validatedProfiles.push({
        id: idVal || undefined,
        uid: uidVal,
        displayName: charName,
        characterName: charName,
        group: item.group || item.groupName || 'Nhóm Chính (Main)',
        proxyId: item.proxyId || 'proxy_1',
        proxyAddress: item.proxyAddress || item.proxy || '103.142.10.100:8080',
        currentIp: item.currentIp || item.ip || '103.142.10.100',
        status: item.status || 'stopped',
        currentActivity: item.currentActivity || 'Nhập từ JSON',
        level: Number(item.level) || 70,
        stamina: Number(item.stamina) || 100,
        enabledModules: Array.isArray(item.enabledModules) ? item.enabledModules : ['daily_quest', 'dungeon'],
        notes: item.notes || ''
      });
    }

    try {
      await onImportSuccess(validatedProfiles);
      setSuccessMsg(`Đã import thành công ${validatedProfiles.length} profile!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi khi lưu profiles nhập từ JSON.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileJson className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Import Profile Từ JSON</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="block text-slate-400 font-medium">
              Tải file .json hoặc dán nội dung bên dưới:
            </label>
            <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-700 flex items-center gap-1 transition">
              <Upload className="w-3 h-3" />
              <span>Chọn File JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={8}
            value={jsonText}
            onChange={e => {
              setJsonText(e.target.value);
              setErrorMsg(null);
            }}
            placeholder={`[\n  {\n    "uid": "HH3D-10088",\n    "displayName": "ThiênLong_99",\n    "group": "Nhóm Chính (Main)",\n    "level": 75\n  }\n]`}
            className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
          ></textarea>

          <p className="text-[10px] text-slate-500">
            * Yêu cầu bắt buộc: Mỗi profile phải có trường <code className="text-emerald-400 font-mono">uid</code> (không để trống).
            Nếu truyền <code className="text-emerald-400 font-mono">id</code>, internal ID không được trùng với profile hiện có.
          </p>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleProcessImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition flex items-center gap-1.5 shadow-lg shadow-emerald-900/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Thực Hiện Import</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
