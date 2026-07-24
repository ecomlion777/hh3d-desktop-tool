/**
 * HH3D Desktop Tool - Persistent batch repository for worker execution.
 */

const { validateBatchInput } = require('./workerValidation.cjs');

class BatchRepository {
  constructor(db) {
    this.db = db;
  }

  async list() {
    const data = this.db.getData();
    return Array.isArray(data.batches) ? data.batches : [];
  }

  async getById(batchId) {
    const batches = await this.list();
    return batches.find(batch => batch.id === batchId) || null;
  }

  async create(input) {
    const normalized = validateBatchInput(input);
    const now = new Date().toISOString();
    const batch = {
      id: `batch_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      name: normalized.name,
      title: normalized.name,
      profileIds: normalized.profileIds,
      concurrency: normalized.concurrency,
      status: 'Ready',
      totalProfiles: normalized.profileIds.length,
      readyCount: normalized.profileIds.length,
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
      failureCount: 0,
      activityType: normalized.activityType,
      groupTarget: normalized.groupTarget,
      createdAt: now,
      startedAt: '',
      completedAt: ''
    };

    return this.db.transaction(async data => ({
      nextData: {
        ...data,
        batches: [batch, ...(Array.isArray(data.batches) ? data.batches : [])]
      },
      result: batch
    }));
  }

  async update(batchId, changes = {}) {
    return this.db.transaction(async data => {
      const batches = Array.isArray(data.batches) ? data.batches : [];
      const existing = batches.find(batch => batch.id === batchId);
      if (!existing) return { nextData: data, result: null };

      let normalizedProfiles = existing.profileIds;
      if (changes.profileIds !== undefined) {
        normalizedProfiles = validateBatchInput({
          name: changes.name || existing.name,
          profileIds: changes.profileIds,
          concurrency: changes.concurrency ?? existing.concurrency,
          activityType: changes.activityType || existing.activityType,
          groupTarget: changes.groupTarget || existing.groupTarget
        }).profileIds;
      }

      const updated = {
        ...existing,
        ...changes,
        id: existing.id,
        name: String(changes.name ?? existing.name).trim() || existing.name,
        title: String(changes.name ?? existing.title ?? existing.name).trim() || existing.name,
        profileIds: normalizedProfiles,
        totalProfiles: normalizedProfiles.length,
        concurrency: Math.min(Math.max(Number(changes.concurrency ?? existing.concurrency) || 40, 1), 50)
      };

      return {
        nextData: {
          ...data,
          batches: batches.map(batch => batch.id === batchId ? updated : batch)
        },
        result: updated
      };
    });
  }

  async delete(batchId) {
    return this.db.transaction(async data => {
      const batches = Array.isArray(data.batches) ? data.batches : [];
      const next = batches.filter(batch => batch.id !== batchId);
      return {
        nextData: { ...data, batches: next },
        result: next.length !== batches.length
      };
    });
  }

  async setRuntime(batchId, changes) {
    return this.update(batchId, changes);
  }

  async reset(batchId) {
    const batch = await this.getById(batchId);
    if (!batch) return false;
    await this.update(batchId, {
      status: 'Ready',
      readyCount: batch.totalProfiles,
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
      failureCount: 0,
      startedAt: '',
      completedAt: ''
    });
    return true;
  }
}

module.exports = BatchRepository;
