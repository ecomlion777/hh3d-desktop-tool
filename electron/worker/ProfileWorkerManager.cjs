/**
 * HH3D Desktop Tool - Phase 06A API Worker Core.
 *
 * Workers run in Electron main and use the same persistent Chromium session as
 * the profile Mini Browser. Phase 06A only performs a reviewed session/network
 * readiness check; game-specific modules are added in later phases.
 */

const {
  WORKER_IPC_CHANNELS,
  WORKER_HEALTHCHECK_URL
} = require('./workerConstants.cjs');
const {
  validateProfileId,
  validateProfileIds
} = require('./workerValidation.cjs');

class ProfileWorkerManager {
  constructor(options) {
    this.profileRepo = options.profileRepo;
    this.httpClient = options.httpClient;
    this.logRepository = options.logRepository;
    this.batchRepository = options.batchRepository;
    this.settingsRepository = options.settingsRepository;
    this.broadcastCallback = options.broadcastCallback || (() => {});

    this.queue = [];
    this.activeWorkers = new Map();
    this.statuses = new Map();
    this.pumpScheduled = false;
  }

  async init() {
    // Runtime workers are never auto-restored after app restart. Normalize stale
    // display states left by a previous process without touching sessions/cookies.
    const profiles = await this.profileRepo.listProfiles();
    for (const profile of profiles) {
      if (profile.status === 'running' || profile.status === 'waiting') {
        await this.profileRepo.updateProfile(profile.id, {
          status: 'stopped',
          currentActivity: 'Worker Core đã dừng khi ứng dụng khởi động lại',
          nextRunTime: '--:--'
        });
      }
    }
    await this.broadcastProfilesChanged();
    this.broadcastSummary();
  }

  getMaxConcurrency(override) {
    const settings = this.settingsRepository.getWorkerSettings();
    const value = Number(override ?? settings.maxConcurrency);
    return Math.min(Math.max(Number.isFinite(value) ? Math.trunc(value) : 40, 1), 50);
  }

  createStatus(profileId, changes = {}) {
    const previous = this.statuses.get(profileId);
    const now = new Date().toISOString();
    return {
      profileId,
      state: 'stopped',
      taskCode: 'session_check',
      batchId: undefined,
      queuedAt: undefined,
      startedAt: undefined,
      lastHeartbeatAt: undefined,
      stoppedAt: undefined,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      lastHttpStatus: undefined,
      lastDurationMs: undefined,
      error: undefined,
      updatedAt: now,
      ...previous,
      ...changes,
      updatedAt: now
    };
  }

  setStatus(profileId, changes = {}) {
    const status = this.createStatus(profileId, changes);
    this.statuses.set(profileId, status);
    this.broadcast(WORKER_IPC_CHANNELS.STATUS_CHANGED, { ...status });
    this.broadcastSummary();
    void this.syncRunningBatches(profileId);
    return status;
  }

  getStatus(profileId) {
    const validId = validateProfileId(profileId);
    return this.statuses.get(validId) || this.createStatus(validId);
  }

  listStatuses() {
    return Array.from(this.statuses.values()).map(status => ({ ...status }));
  }

  getSummary() {
    const statuses = this.listStatuses();
    const count = state => statuses.filter(item => item.state === state).length;
    return {
      maxConcurrency: this.getMaxConcurrency(),
      activeCount: this.activeWorkers.size,
      queuedCount: this.queue.length,
      runningCount: count('running') + count('starting'),
      stoppedCount: count('stopped'),
      errorCount: count('error') + count('proxy_error') + count('login_required'),
      totalTracked: statuses.length,
      updatedAt: new Date().toISOString()
    };
  }

  broadcast(channel, payload) {
    try {
      this.broadcastCallback(channel, payload);
    } catch (error) {
      console.error('[ProfileWorkerManager] Broadcast failed:', error);
    }
  }

  broadcastSummary() {
    this.broadcast(WORKER_IPC_CHANNELS.SUMMARY_CHANGED, this.getSummary());
  }

  async broadcastProfilesChanged() {
    this.broadcast(WORKER_IPC_CHANNELS.PROFILES_CHANGED, await this.profileRepo.listProfiles());
  }

  async broadcastLogsChanged() {
    this.broadcast(WORKER_IPC_CHANNELS.LOGS_CHANGED, await this.logRepository.listLogs());
  }

  async appendLog(profile, level, action, message, extra = {}) {
    const log = await this.logRepository.append({
      profileId: profile?.id,
      profileUid: profile?.uid,
      profileName: profile?.displayName || profile?.characterName,
      moduleCode: 'WORKER_CORE',
      source: 'WORKER_CORE',
      level,
      action,
      message,
      ...extra
    });
    await this.broadcastLogsChanged();
    return log;
  }

  async startProfiles(profileIds, options = {}) {
    const ids = validateProfileIds(profileIds);
    const allProfiles = await this.profileRepo.listProfiles();
    const profileMap = new Map(allProfiles.map(profile => [profile.id, profile]));
    const missing = ids.filter(id => !profileMap.has(id));
    if (missing.length > 0) {
      throw new Error(`WORKER_PROFILE_NOT_FOUND: Không tìm thấy ${missing.join(', ')}.`);
    }

    const accepted = [];
    for (const profileId of ids) {
      if (this.activeWorkers.has(profileId) || this.queue.some(item => item.profileId === profileId)) {
        continue;
      }

      const profile = profileMap.get(profileId);
      const queuedAt = new Date().toISOString();
      this.queue.push({
        profileId,
        batchId: options.batchId,
        activityType: options.activityType || 'Worker Core Session Check',
        concurrency: options.concurrency
      });
      accepted.push(profileId);

      this.setStatus(profileId, {
        state: 'queued',
        taskCode: 'session_check',
        batchId: options.batchId,
        queuedAt,
        error: undefined
      });
      await this.profileRepo.updateProfile(profileId, {
        status: 'waiting',
        currentActivity: 'Worker Core: Đang chờ hàng đợi',
        nextRunTime: 'Đang chờ',
        updatedAt: queuedAt
      });
      await this.appendLog(
        profile,
        'info',
        'WORKER_QUEUED',
        `Đã đưa profile vào hàng đợi Worker Core${options.batchId ? ` (Batch ${options.batchId})` : ''}.`
      );
    }

    await this.broadcastProfilesChanged();
    this.schedulePump();
    return {
      requested: ids.length,
      accepted: accepted.length,
      skipped: ids.length - accepted.length,
      acceptedProfileIds: accepted,
      summary: this.getSummary()
    };
  }

  async stopProfiles(profileIds, reason = 'user') {
    const ids = validateProfileIds(profileIds);
    const idSet = new Set(ids);

    const removedQueued = [];
    this.queue = this.queue.filter(item => {
      if (idSet.has(item.profileId)) {
        removedQueued.push(item.profileId);
        return false;
      }
      return true;
    });

    for (const profileId of removedQueued) {
      const profile = await this.profileRepo.getProfileById(profileId);
      this.setStatus(profileId, {
        state: 'stopped',
        stoppedAt: new Date().toISOString(),
        error: undefined
      });
      if (profile) {
        await this.profileRepo.updateProfile(profileId, {
          status: 'stopped',
          currentActivity: 'Đã Dừng',
          nextRunTime: '--:--'
        });
        await this.appendLog(profile, 'info', 'WORKER_STOPPED', 'Đã hủy profile khỏi hàng đợi Worker Core.');
      }
    }

    const promises = [];
    for (const profileId of ids) {
      const active = this.activeWorkers.get(profileId);
      if (!active) continue;
      active.stopReason = reason;
      this.setStatus(profileId, { state: 'stopping' });
      active.controller.abort(new Error('WORKER_STOP_REQUESTED'));
      promises.push(active.promise);
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    await this.broadcastProfilesChanged();
    this.broadcastSummary();
    return {
      stopped: removedQueued.length + promises.length,
      profileIds: ids,
      summary: this.getSummary()
    };
  }

  schedulePump() {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    queueMicrotask(() => {
      this.pumpScheduled = false;
      this.pump();
    });
  }

  pump() {
    const globalLimit = this.getMaxConcurrency();

    while (this.activeWorkers.size < globalLimit && this.queue.length > 0) {
      const nextIndex = this.queue.findIndex(item => {
        if (this.activeWorkers.has(item.profileId)) return false;
        if (!item.batchId) return true;

        const batchLimit = this.getMaxConcurrency(item.concurrency);
        let activeForBatch = 0;
        for (const active of this.activeWorkers.values()) {
          if (active.batchId === item.batchId) activeForBatch += 1;
        }
        return activeForBatch < batchLimit;
      });

      if (nextIndex === -1) break;

      const [item] = this.queue.splice(nextIndex, 1);
      if (!item) continue;

      const controller = new AbortController();
      const holder = {
        controller,
        stopReason: null,
        batchId: item.batchId,
        promise: null
      };
      const promise = this.runWorker(item, holder);
      const trackedPromise = promise
        .catch(error => {
          console.error('[ProfileWorkerManager] Worker lifecycle failed:', error);
        })
        .finally(() => {
          this.activeWorkers.delete(item.profileId);
          this.broadcastSummary();
          this.schedulePump();
        });
      holder.promise = trackedPromise;
      this.activeWorkers.set(item.profileId, holder);
    }
    this.broadcastSummary();
  }

  async runWorker(item, holder) {
    const profileId = item.profileId;
    let profile = await this.profileRepo.getProfileById(profileId);
    if (!profile) {
      this.setStatus(profileId, {
        state: 'error',
        error: 'WORKER_PROFILE_NOT_FOUND'
      });
      return;
    }

    const startedAt = new Date().toISOString();
    this.setStatus(profileId, {
      state: 'starting',
      batchId: item.batchId,
      startedAt,
      error: undefined
    });
    await this.profileRepo.updateProfile(profileId, {
      status: 'running',
      currentActivity: 'Worker Core: Đang kiểm tra session/network',
      lastRunAt: startedAt,
      lastActive: startedAt,
      nextRunTime: 'Đang chạy'
    });
    await this.broadcastProfilesChanged();
    await this.appendLog(profile, 'info', 'WORKER_STARTING', 'Bắt đầu Worker Core bằng persistent Chromium session.');

    let finalProfileStatus = 'stopped';
    let finalActivity = 'Đã Dừng';
    let finalState = 'stopped';
    let finalError;

    try {
      const settings = this.settingsRepository.getWorkerSettings();
      let lastError;
      let result;

      for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
        if (holder.controller.signal.aborted) {
          throw holder.controller.signal.reason || new Error('WORKER_STOP_REQUESTED');
        }

        try {
          result = await this.httpClient.fetch(profile, WORKER_HEALTHCHECK_URL, {
            signal: holder.controller.signal,
            timeoutMs: settings.requestTimeoutMs
          });
          break;
        } catch (error) {
          lastError = error;
          if (holder.controller.signal.aborted || attempt >= settings.maxRetries) throw error;
          this.setStatus(profileId, {
            state: 'starting',
            retryCount: attempt + 1,
            error: error instanceof Error ? error.message : String(error)
          });
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, settings.retryDelayMs);
            holder.controller.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(holder.controller.signal.reason || new Error('WORKER_STOP_REQUESTED'));
            }, { once: true });
          });
        }
      }

      if (!result) throw lastError || new Error('WORKER_CONNECTION_FAILED');

      const { response, durationMs } = result;
      const httpStatus = response.status;
      const requestCount = (this.getStatus(profileId).requestCount || 0) + 1;

      if (httpStatus === 401 || httpStatus === 403) {
        const error = new Error(`WORKER_LOGIN_REQUIRED: HTTP ${httpStatus}.`);
        error.code = 'WORKER_LOGIN_REQUIRED';
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`WORKER_HTTP_ERROR: HTTP ${httpStatus}.`);
        error.code = 'WORKER_HTTP_ERROR';
        throw error;
      }

      this.setStatus(profileId, {
        state: 'running',
        requestCount,
        successCount: (this.getStatus(profileId).successCount || 0) + 1,
        lastHttpStatus: httpStatus,
        lastDurationMs: durationMs,
        lastHeartbeatAt: new Date().toISOString(),
        error: undefined
      });

      await this.profileRepo.updateProfile(profileId, {
        status: 'running',
        currentActivity: 'Worker Core: Session/network sẵn sàng',
        lastActive: new Date().toISOString(),
        nextRunTime: 'Đang chạy'
      });
      await this.broadcastProfilesChanged();
      await this.appendLog(
        profile,
        'success',
        'WORKER_READY',
        `Worker Core sẵn sàng. HTTP ${httpStatus}, ${durationMs}ms.`,
        { httpStatus, durationMs }
      );

      await this.waitUntilStopped(profileId, holder.controller.signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isStop = holder.controller.signal.aborted || message.includes('WORKER_STOP_REQUESTED');

      if (isStop) {
        finalState = 'stopped';
        finalProfileStatus = 'stopped';
        finalActivity = 'Đã Dừng';
      } else if (message.includes('WORKER_LOGIN_REQUIRED')) {
        finalState = 'login_required';
        finalProfileStatus = 'login_required';
        finalActivity = 'Worker Core: Cần đăng nhập';
        finalError = message;
      } else if (
        profile.proxyId &&
        (
          message.includes('PROXY_') ||
          message.includes('ERR_PROXY') ||
          message.includes('ERR_TUNNEL') ||
          message.includes('ERR_SOCKS') ||
          message.includes('DIRECT_FALLBACK')
        )
      ) {
        finalState = 'proxy_error';
        finalProfileStatus = 'proxy_error';
        finalActivity = 'Worker Core: Lỗi Proxy';
        finalError = message;
      } else {
        finalState = 'error';
        finalProfileStatus = 'stopped';
        finalActivity = 'Worker Core: Lỗi kết nối';
        finalError = message;
      }

      if (!isStop) {
        this.setStatus(profileId, {
          state: finalState,
          failureCount: (this.getStatus(profileId).failureCount || 0) + 1,
          error: finalError
        });
        await this.appendLog(profile, 'error', 'WORKER_FAILED', finalError);
      }
    } finally {
      const stoppedAt = new Date().toISOString();
      if (finalState === 'stopped') {
        this.setStatus(profileId, {
          state: 'stopped',
          stoppedAt,
          lastHeartbeatAt: stoppedAt,
          error: undefined
        });
        await this.appendLog(profile, 'info', 'WORKER_STOPPED', 'Worker Core đã dừng.');
      }

      await this.profileRepo.updateProfile(profileId, {
        status: finalProfileStatus,
        currentActivity: finalActivity,
        nextRunTime: '--:--',
        lastActive: stoppedAt
      });
      await this.broadcastProfilesChanged();
      await this.syncRunningBatches(profileId);
    }
  }

  waitUntilStopped(profileId, signal) {
    const intervalMs = this.settingsRepository.getWorkerSettings().heartbeatIntervalMs;
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason || new Error('WORKER_STOP_REQUESTED'));
        return;
      }

      const timer = setInterval(() => {
        const current = this.getStatus(profileId);
        this.setStatus(profileId, {
          state: 'running',
          lastHeartbeatAt: new Date().toISOString(),
          error: current.error
        });
      }, intervalMs);

      signal.addEventListener('abort', () => {
        clearInterval(timer);
        reject(signal.reason || new Error('WORKER_STOP_REQUESTED'));
      }, { once: true });
    });
  }

  async startGroup(groupIdOrName) {
    const profiles = await this.profileRepo.listProfiles();
    const ids = profiles
      .filter(profile => profile.groupId === groupIdOrName || profile.group === groupIdOrName)
      .map(profile => profile.id);
    if (ids.length === 0) {
      throw new Error(`WORKER_GROUP_EMPTY: Không có profile trong nhóm "${groupIdOrName}".`);
    }
    return this.startProfiles(ids, { activityType: `Group: ${groupIdOrName}` });
  }

  async stopGroup(groupIdOrName) {
    const profiles = await this.profileRepo.listProfiles();
    const ids = profiles
      .filter(profile => profile.groupId === groupIdOrName || profile.group === groupIdOrName)
      .map(profile => profile.id);
    if (ids.length === 0) return { stopped: 0, profileIds: [], summary: this.getSummary() };
    return this.stopProfiles(ids, 'group');
  }

  async startBatch(batchId) {
    const batch = await this.batchRepository.getById(batchId);
    if (!batch) throw new Error(`BATCH_NOT_FOUND: Không tìm thấy batch "${batchId}".`);

    await this.batchRepository.setRuntime(batchId, {
      status: 'Running',
      readyCount: batch.totalProfiles,
      runningCount: 0,
      successCount: 0,
      failedCount: 0,
      failureCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: ''
    });
    await this.broadcastBatchesChanged();

    return this.startProfiles(batch.profileIds, {
      batchId,
      activityType: batch.activityType,
      concurrency: batch.concurrency
    });
  }

  async stopBatch(batchId) {
    const batch = await this.batchRepository.getById(batchId);
    if (!batch) return false;
    await this.stopProfiles(batch.profileIds, 'batch');
    await this.batchRepository.setRuntime(batchId, {
      status: 'Cancelled',
      runningCount: 0,
      readyCount: 0,
      completedAt: new Date().toISOString()
    });
    await this.broadcastBatchesChanged();
    return true;
  }

  async syncRunningBatches(profileId) {
    const batches = await this.batchRepository.list();
    for (const batch of batches) {
      if (batch.status !== 'Running' || !batch.profileIds.includes(profileId)) continue;

      const statuses = batch.profileIds.map(id => this.getStatus(id));
      const readyCount = statuses.filter(status => status.state === 'queued').length;
      const runningCount = statuses.filter(status => ['starting', 'running', 'stopping'].includes(status.state)).length;
      const failedCount = statuses.filter(status => ['error', 'proxy_error', 'login_required'].includes(status.state)).length;
      const successCount = statuses.filter(status => status.successCount > 0).length;

      let status = 'Running';
      let completedAt = '';
      if (runningCount === 0 && readyCount === 0 && successCount + failedCount >= batch.totalProfiles) {
        status = failedCount > 0 ? 'PartiallyFailed' : 'Completed';
        completedAt = new Date().toISOString();
      }

      await this.batchRepository.setRuntime(batch.id, {
        status,
        readyCount,
        runningCount,
        successCount,
        failedCount,
        failureCount: failedCount,
        completedAt
      });
      await this.broadcastBatchesChanged();
    }
  }

  async broadcastBatchesChanged() {
    this.broadcast(WORKER_IPC_CHANNELS.BATCHES_CHANGED, await this.batchRepository.list());
  }

  async setMaxConcurrency(value) {
    const settings = await this.settingsRepository.saveWorkerSettings({ maxConcurrency: value });
    this.schedulePump();
    this.broadcastSummary();
    return settings;
  }

  async stopAll(reason = 'app-quit') {
    const ids = Array.from(new Set([
      ...this.queue.map(item => item.profileId),
      ...this.activeWorkers.keys()
    ]));
    if (ids.length === 0) return;
    await this.stopProfiles(ids, reason);
  }
}

module.exports = ProfileWorkerManager;
