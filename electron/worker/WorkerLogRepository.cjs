/**
 * HH3D Desktop Tool - Persistent worker log repository.
 */

class WorkerLogRepository {
  constructor(db, options = {}) {
    this.db = db;
    this.maxEntries = Number.isInteger(options.maxEntries)
      ? Math.max(100, options.maxEntries)
      : 2000;
  }

  async listLogs(limit = 1000) {
    const data = this.db.getData();
    const logs = Array.isArray(data.logs) ? data.logs : [];
    return logs.slice(0, Math.max(1, Math.min(Number(limit) || 1000, this.maxEntries)));
  }

  async append(entry) {
    const now = new Date().toISOString();
    const normalized = {
      id: entry.id || `log_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      timestamp: entry.timestamp || now,
      profileId: entry.profileId || undefined,
      profileUid: entry.profileUid || undefined,
      profileName: entry.profileName || undefined,
      moduleCode: entry.moduleCode || 'WORKER_CORE',
      source: entry.source || 'WORKER_CORE',
      level: ['info', 'warn', 'error', 'success'].includes(entry.level)
        ? entry.level
        : 'info',
      action: entry.action || 'WORKER_EVENT',
      message: String(entry.message || ''),
      httpStatus: Number.isInteger(entry.httpStatus) ? entry.httpStatus : undefined,
      durationMs: Number.isFinite(entry.durationMs) ? Math.round(entry.durationMs) : undefined,
      retryCount: Number.isInteger(entry.retryCount) ? entry.retryCount : undefined
    };

    return this.db.transaction(async data => {
      const logs = Array.isArray(data.logs) ? data.logs : [];
      const nextLogs = [normalized, ...logs].slice(0, this.maxEntries);
      return {
        nextData: { ...data, logs: nextLogs },
        result: normalized
      };
    });
  }

  async clear() {
    return this.db.transaction(async data => ({
      nextData: { ...data, logs: [] },
      result: true
    }));
  }
}

module.exports = WorkerLogRepository;
