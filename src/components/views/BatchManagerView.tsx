/**
 * BatchManagerView - Scheduled & Parallel Batch Tasks Execution Manager
 */

import React, { useState } from 'react';
import {
  Layers,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  Users,
  Sliders,
  Check,
  Activity,
  Filter
} from 'lucide-react';
import { BatchTask, Profile, GroupItem, BatchStatus } from '../../types';
import { CreateBatchModal } from '../modals/CreateBatchModal';

interface BatchManagerViewProps {
  batches: BatchTask[];
  profiles: Profile[];
  groups: GroupItem[];
  onStartBatch: (id: string) => Promise<void>;
  onStopBatch: (id: string) => Promise<void>;
  onResetBatch: (id: string) => Promise<void>;
  onCreateBatch: (data: {
    name: string;
    profileIds: string[];
    concurrency?: number;
    activityType?: string;
    groupTarget?: string;
    status?: BatchStatus;
  }) => Promise<any>;
  onUpdateBatch: (id: string, data: Partial<BatchTask>) => Promise<any>;
  onDeleteBatch: (id: string) => Promise<void>;
  onToggleBatch: (id: string) => void;
}

export const BatchManagerView: React.FC<BatchManagerViewProps> = ({
  batches,
  profiles,
  groups,
  onStartBatch,
  onStopBatch,
  onResetBatch,
  onCreateBatch,
  onUpdateBatch,
  onDeleteBatch
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingConcurrencyBatchId, setEditingConcurrencyBatchId] = useState<string | null>(null);
  const [editingConcurrencyValue, setEditingConcurrencyValue] = useState<number>(40);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // Status Badge Helper
  const renderStatusBadge = (status: BatchStatus) => {
    switch (status) {
      case 'Preparing':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/80 flex items-center gap-1">
            <Clock className="w-3 h-3 text-purple-400" />
            <span>Preparing (Đang Chuẩn Bị)</span>
          </span>
        );
      case 'Ready':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/80 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Ready (Sẵn Sàng)</span>
          </span>
        );
      case 'Running':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/90 flex items-center gap-1 animate-pulse shadow-sm shadow-emerald-900">
            <Activity className="w-3 h-3 text-emerald-400 animate-spin" />
            <span>Running (Đang Thực Thi)</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950/80 text-teal-300 border border-teal-800/80 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-400" />
            <span>Completed (Hoàn Thành)</span>
          </span>
        );
      case 'PartiallyFailed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Partially Failed (Lỗi Một Phần)</span>
          </span>
        );
      case 'Cancelled':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>Cancelled (Đã Hủy / Tạm Dừng)</span>
          </span>
        );
    }
  };

  // Filtered Batches
  const filteredBatches = batches.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  // Global Metrics
  const totalBatches = batches.length;
  const runningCount = batches.filter(b => b.status === 'Running').length;
  const completedCount = batches.filter(b => b.status === 'Completed').length;
  const totalProfilesInBatches = batches.reduce((acc, b) => acc + (b.totalProfiles || 0), 0);

  const handleSaveConcurrency = async (batchId: string) => {
    const validValue = Math.min(Math.max(editingConcurrencyValue, 1), 50);
    await onUpdateBatch(batchId, { concurrency: validValue });
    setEditingConcurrencyBatchId(null);
  };

  const handleDeleteConfirm = async () => {
    if (deletingBatchId) {
      await onDeleteBatch(deletingBatchId);
      setDeletingBatchId(null);
    }
  };

  return (
    <div id="view-batch-manager" className="p-4 space-y-4 overflow-y-auto custom-scrollbar h-full text-slate-200">
      
      {/* Header Banner */}
      <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <span>Batch Manager (Quản Lý Tiến Trình Hàng Loạt)</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 rounded-full font-bold">
                Worker Core Engine
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Cấu hình Worker Core thực thi song song (Mặc định 40 luồng, điều chỉnh 1-50). Theo dõi hàng đợi, worker đang chạy và lỗi session/proxy theo thời gian thực.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-2 border border-purple-400/30"
        >
          <Sparkles className="w-4 h-4" />
          <span>+ Tạo Batch Task Mới</span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Tổng Batch Tasks</span>
            <span className="text-xl font-mono font-bold text-slate-100">{totalBatches}</span>
          </div>
          <Layers className="w-7 h-7 text-purple-400/50" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Đang Thực Thi (Running)</span>
            <span className="text-xl font-mono font-bold text-emerald-400">{runningCount}</span>
          </div>
          <Activity className="w-7 h-7 text-emerald-400/50" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Đã Hoàn Thành</span>
            <span className="text-xl font-mono font-bold text-teal-400">{completedCount}</span>
          </div>
          <CheckCircle2 className="w-7 h-7 text-teal-400/50" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Tổng Profiles Đã Gán</span>
            <span className="text-xl font-mono font-bold text-amber-400">{totalProfilesInBatches}</span>
          </div>
          <Users className="w-7 h-7 text-amber-400/50" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-300">Lọc Trạng Thái:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
          >
            <option value="all">Tất cả ({batches.length})</option>
            <option value="Ready">Ready (Sẵn Sàng)</option>
            <option value="Running">Running (Đang Chạy)</option>
            <option value="Completed">Completed (Hoàn Thành)</option>
            <option value="PartiallyFailed">Partially Failed (Lỗi 1 Phần)</option>
            <option value="Cancelled">Cancelled (Đã Hủy/Dừng)</option>
            <option value="Preparing">Preparing (Chuẩn Bị)</option>
          </select>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          Hiển thị <strong>{filteredBatches.length}</strong> / {batches.length} batch tasks
        </span>
      </div>

      {/* Batch Cards Grid */}
      {filteredBatches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-300 text-sm">Không có Batch Task nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Chưa có batch task nào phù hợp với bộ lọc hiện tại. Nhấn nút bên dưới để tạo batch task mới.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition"
          >
            + Tạo Batch Task Ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBatches.map(batch => {
            const isRunning = batch.status === 'Running';
            const total = batch.totalProfiles || 1;
            const processed = (batch.successCount || 0) + (batch.failedCount || 0);
            const progressPct = Math.min(Math.round((processed / total) * 100), 100);

            return (
              <div
                key={batch.id}
                className={`bg-slate-900 border rounded-xl p-4 space-y-3.5 transition shadow-md relative overflow-hidden ${
                  isRunning
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Status & Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-sm text-cyan-300 leading-snug">
                        {batch.name || batch.title}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                      <span>Mục tiêu: <strong className="text-slate-200">{batch.groupTarget}</strong></span>
                      <span>•</span>
                      <span>Loại: <strong className="text-purple-300">{batch.activityType}</strong></span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {renderStatusBadge(batch.status)}
                  </div>
                </div>

                {/* Progress Bar & Main Metrics */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/90 space-y-2">
                  
                  {/* Progress Header */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 font-medium">Tiến Độ Worker</span>
                    <span className="font-bold text-cyan-400">{progressPct}%</span>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((batch.successCount || 0) / total) * 100)}%` }}
                      title={`Thành công: ${batch.successCount}`}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((batch.failedCount || 0) / total) * 100)}%` }}
                      title={`Thất bại: ${batch.failedCount}`}
                    />
                    <div
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((batch.runningCount || 0) / total) * 100)}%` }}
                      title={`Đang chạy: ${batch.runningCount}`}
                    />
                  </div>

                  {/* 5 Required Metrics Breakdown */}
                  <div className="grid grid-cols-5 gap-1 pt-1 text-center font-mono text-[11px] divide-x divide-slate-800/80">
                    <div className="px-1">
                      <span className="text-[10px] text-slate-500 block uppercase">Tổng</span>
                      <span className="font-bold text-slate-200">{batch.totalProfiles}</span>
                    </div>

                    <div className="px-1">
                      <span className="text-[10px] text-blue-400 block uppercase">Ready</span>
                      <span className="font-bold text-blue-300">{batch.readyCount ?? 0}</span>
                    </div>

                    <div className="px-1">
                      <span className="text-[10px] text-emerald-400 block uppercase">Running</span>
                      <span className="font-bold text-emerald-300">{batch.runningCount ?? 0}</span>
                    </div>

                    <div className="px-1">
                      <span className="text-[10px] text-teal-400 block uppercase">Success</span>
                      <span className="font-bold text-teal-300">{batch.successCount ?? 0}</span>
                    </div>

                    <div className="px-1">
                      <span className="text-[10px] text-rose-400 block uppercase">Failed</span>
                      <span className="font-bold text-rose-300">{batch.failedCount ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Concurrency Settings & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                  
                  {/* Concurrency Inline Control */}
                  <div className="flex items-center space-x-1.5 font-mono">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-slate-400">Concurrency:</span>

                    {editingConcurrencyBatchId === batch.id ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={editingConcurrencyValue}
                          onChange={e => setEditingConcurrencyValue(Number(e.target.value))}
                          className="w-12 bg-slate-950 border border-purple-500 rounded px-1 py-0.5 text-slate-100 font-bold text-xs text-center focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveConcurrency(batch.id)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
                          title="Lưu Concurrency"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingConcurrencyBatchId(batch.id);
                          setEditingConcurrencyValue(batch.concurrency || 40);
                        }}
                        disabled={isRunning}
                        className="font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950 border border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1 transition"
                        title="Bấm để chỉnh sửa luồng (1-50)"
                      >
                        <span>{batch.concurrency || 40} luồng</span>
                        {!isRunning && <Sliders className="w-3 h-3 text-slate-400" />}
                      </button>
                    )}
                  </div>

                  {/* Controls: Start / Stop / Reset / Delete */}
                  <div className="flex items-center space-x-2">
                    
                    {/* Start / Stop Button */}
                    {isRunning ? (
                      <button
                        onClick={() => onStopBatch(batch.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow"
                        title="Dừng toàn bộ Worker trong Batch"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Batch</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartBatch(batch.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow"
                        title="Khởi chạy Worker Core cho Batch"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Batch</span>
                      </button>
                    )}

                    {/* Reset Button */}
                    <button
                      onClick={() => onResetBatch(batch.id)}
                      disabled={isRunning}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg transition border border-slate-700"
                      title="Đặt lại về trạng thái Ready"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeletingBatchId(batch.id)}
                      disabled={isRunning}
                      className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 text-rose-300 rounded-lg transition border border-rose-800/60"
                      title="Xóa Batch Task này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Create Batch Modal */}
      <CreateBatchModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        profiles={profiles}
        groups={groups}
        onSubmit={async (data) => {
          await onCreateBatch(data);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deletingBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 text-slate-200 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-sm text-slate-100">Xác Nhận Xóa Batch Task</h3>
            </div>
            <p className="text-xs text-slate-300">
              Bạn có chắc chắn muốn xóa Batch Task này? Thao tác này chỉ xóa cấu hình mô phỏng và không ảnh hưởng tới dữ liệu profile.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDeletingBatchId(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition"
              >
                Xóa Batch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
