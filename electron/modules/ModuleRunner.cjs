const {
  MODULE_IPC_CHANNELS,
  DEFAULT_MODULE_TIMEOUT_MS
} = require('./moduleConstants.cjs');
const { validateModuleCode } = require('./moduleValidation.cjs');
const { isFatalWorkerModuleError } = require('./moduleErrorPolicy.cjs');

function createModuleError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

class ModuleRunner {
  constructor(options) {
    this.registry = options.registry;
    this.settingsRepository = options.settingsRepository;
    this.profileRepo = options.profileRepo;
    this.httpClient = options.httpClient;
    this.logRepository = options.logRepository;
    this.websiteConfigService = options.websiteConfigService;
    this.broadcastCallback = options.broadcastCallback || (() => {});
    this.runtimeStatuses = new Map();
    this.running = new Map();
  }

  makeKey(profileId, moduleCode) {
    return `${profileId}:${moduleCode}`;
  }

  broadcast(channel, payload) {
    try { this.broadcastCallback(channel, payload); } catch (error) {
      console.error('[ModuleRunner] Broadcast failed:', error);
    }
  }

  createStatus(profileId, moduleCode, changes = {}) {
    const key = this.makeKey(profileId, moduleCode);
    const previous = this.runtimeStatuses.get(key);
    const now = new Date().toISOString();
    return {
      profileId,
      moduleCode,
      state: 'idle',
      trigger: 'manual',
      startedAt: undefined,
      finishedAt: undefined,
      durationMs: undefined,
      summary: undefined,
      error: undefined,
      resultData: undefined,
      updatedAt: now,
      ...previous,
      ...changes,
      updatedAt: now
    };
  }

  setStatus(profileId, moduleCode, changes = {}) {
    const status = this.createStatus(profileId, moduleCode, changes);
    this.runtimeStatuses.set(this.makeKey(profileId, moduleCode), status);
    this.broadcast(MODULE_IPC_CHANNELS.STATUS_CHANGED, { ...status });
    return status;
  }

  getRuntimeStatus(profileId, moduleCode) {
    const code = validateModuleCode(moduleCode);
    return this.runtimeStatuses.get(this.makeKey(profileId, code)) || this.createStatus(profileId, code);
  }

  listRuntimeStatuses() {
    return Array.from(this.runtimeStatuses.values()).map(item => ({ ...item }));
  }

  async appendLog(profile, moduleCode, level, action, message, extra = {}) {
    const log = await this.logRepository.append({
      profileId: profile.id,
      profileUid: profile.uid,
      profileName: profile.displayName || profile.characterName,
      moduleCode,
      source: 'MODULE_FRAMEWORK',
      level,
      action,
      message,
      ...extra
    });
    this.broadcast('logs:changed', await this.logRepository.listLogs());
    return log;
  }

  async runModule(profileId, moduleCode, options = {}) {
    const code = validateModuleCode(moduleCode);
    const profile = await this.profileRepo.getProfileById(profileId);
    if (!profile) throw createModuleError('MODULE_PROFILE_NOT_FOUND', `Không tìm thấy profile "${profileId}".`);

    const manifest = this.registry.getManifest(code);
    if (!manifest) throw createModuleError('MODULE_NOT_FOUND', `Không tìm thấy module ${code}.`);
    const handler = this.registry.getHandler(code);
    if (manifest.implementationState !== 'ready' || !handler) {
      throw createModuleError('MODULE_NOT_IMPLEMENTED', `Module "${manifest.label}" chưa được triển khai trong Phase 07.`);
    }

    const settings = await this.settingsRepository.getProfileSettings(profileId);
    const setting = settings.find(item => item.moduleCode === code);
    if (!manifest.required && !setting?.enabled && !options.force) {
      throw createModuleError('MODULE_DISABLED', `Module "${manifest.label}" chưa được bật cho profile.`);
    }

    const key = this.makeKey(profileId, code);
    if (this.running.has(key)) {
      throw createModuleError('MODULE_ALREADY_RUNNING', `Module ${code} đang chạy cho profile ${profileId}.`);
    }

    const trigger = options.trigger || 'manual';
    if (!manifest.triggers.includes(trigger)) {
      throw createModuleError('MODULE_TRIGGER_NOT_ALLOWED', `Module ${code} không hỗ trợ trigger ${trigger}.`);
    }

    const externalSignal = options.signal;
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort(externalSignal.reason || new Error('MODULE_CANCELLED'));
    if (externalSignal) {
      if (externalSignal.aborted) onExternalAbort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timeoutMs = Math.min(Math.max(Number(options.timeoutMs || manifest.timeoutMs || DEFAULT_MODULE_TIMEOUT_MS), 1000), 120000);
    let timeoutId;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    this.setStatus(profileId, code, {
      state: 'running', trigger, startedAt, finishedAt: undefined,
      durationMs: undefined, summary: undefined, error: undefined, resultData: undefined
    });

    await this.appendLog(profile, code, 'info', 'MODULE_START', `Bắt đầu module ${manifest.label}.`);

    const handlerPromise = Promise.resolve().then(() => handler({
      profile: { ...profile },
      manifest: { ...manifest },
      config: setting?.config || manifest.defaultConfig || {},
      trigger,
      signal: controller.signal,
      timeoutMs,
      httpClient: this.httpClient,
      websiteBaseUrl: this.websiteConfigService?.getTargetUrl?.() || 'https://hoathinh3d.co/',
      buildWebsiteUrl: relativePath => this.httpClient.buildWebsiteUrl(relativePath),
      appendLog: (level, action, message, extra = {}) => this.appendLog(
        profile,
        code,
        level,
        action,
        message,
        extra
      ),
      now: () => new Date().toISOString()
    }));

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutError = createModuleError(
          'MODULE_TIMEOUT',
          `Module ${code} quá thời gian ${timeoutMs}ms.`
        );
        controller.abort(timeoutError);
        reject(timeoutError);
      }, timeoutMs);
    });

    // Promise.race guarantees the framework itself times out even if a future
    // module handler accidentally ignores AbortSignal. The handler still gets
    // the signal so it can cancel its own network/timer work promptly.
    const runPromise = Promise.race([handlerPromise, timeoutPromise]);
    this.running.set(key, { controller, promise: runPromise });

    try {
      const rawResult = await runPromise;
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;
      const result = {
        profileId,
        moduleCode: code,
        state: 'success',
        outcome: rawResult?.outcome || 'success',
        summary: String(rawResult?.summary || `${manifest.label} hoàn tất.`),
        httpStatus: rawResult?.httpStatus,
        durationMs: rawResult?.durationMs ?? durationMs,
        data: rawResult?.data && typeof rawResult.data === 'object' ? rawResult.data : {},
        startedAt,
        finishedAt,
        nextRunAt: rawResult?.nextRunAt
      };
      this.setStatus(profileId, code, {
        state: 'success', trigger, finishedAt, durationMs: result.durationMs,
        summary: result.summary, error: undefined, resultData: result.data
      });
      await this.settingsRepository.recordResult(profileId, code, result);
      await this.appendLog(profile, code, 'success', 'MODULE_SUCCESS', result.summary, {
        httpStatus: result.httpStatus,
        durationMs: result.durationMs
      });
      return result;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;
      const message = error instanceof Error ? error.message : String(error);
      const cancelled = controller.signal.aborted && (
        message.includes('MODULE_CANCELLED')
        || message.includes('WORKER_STOP_REQUESTED')
      );
      const state = cancelled ? 'cancelled' : 'error';
      this.setStatus(profileId, code, {
        state, trigger, finishedAt, durationMs, summary: undefined, error: message
      });
      await this.settingsRepository.recordResult(profileId, code, {
        outcome: state,
        finishedAt
      });
      await this.appendLog(profile, code, cancelled ? 'warn' : 'error', cancelled ? 'MODULE_CANCELLED' : 'MODULE_FAILED', message, {
        durationMs
      });
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      this.running.delete(key);
    }
  }

  async runEnabledForProfile(profileId, trigger = 'worker_start', options = {}) {
    const settings = await this.settingsRepository.listEnabledRunnable(profileId, trigger);
    const excluded = new Set(options.excludeCodes || []);
    const requested = Array.isArray(options.requestedCodes) && options.requestedCodes.length > 0
      ? new Set(options.requestedCodes.map(validateModuleCode))
      : null;
    const results = [];
    for (const item of settings) {
      if (excluded.has(item.moduleCode)) continue;
      if (requested && !requested.has(item.moduleCode)) continue;
      if (options.signal?.aborted) throw options.signal.reason || new Error('MODULE_CANCELLED');

      try {
        results.push(await this.runModule(profileId, item.moduleCode, {
          ...options,
          trigger,
          force: true
        }));
      } catch (error) {
        if (!options.continueOnError || isFatalWorkerModuleError(error)) {
          throw error;
        }

        const manifest = item.manifest || this.registry.getManifest(item.moduleCode);
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          profileId,
          moduleCode: item.moduleCode,
          state: 'error',
          outcome: 'error',
          summary: `${manifest?.label || item.moduleCode}: lỗi nhưng Worker tiếp tục module kế tiếp.`,
          error: message,
          startedAt: undefined,
          finishedAt: new Date().toISOString(),
          nextRunAt: undefined,
          data: {}
        });
      }
    }
    return results;
  }

  cancelProfile(profileId, reason = 'MODULE_CANCELLED') {
    for (const [key, active] of this.running.entries()) {
      if (!key.startsWith(`${profileId}:`)) continue;
      active.controller.abort(new Error(reason));
    }
  }
}

module.exports = ModuleRunner;
