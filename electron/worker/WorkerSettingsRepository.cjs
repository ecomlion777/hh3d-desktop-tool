/**
 * HH3D Desktop Tool - Persistent worker/activity/general settings.
 */

const {
  DEFAULT_WORKER_SETTINGS,
  DEFAULT_ACTIVITY_CONFIG,
  DEFAULT_GENERAL_SETTINGS
} = require('./workerConstants.cjs');
const { normalizeWorkerSettings } = require('./workerValidation.cjs');

class WorkerSettingsRepository {
  constructor(db) {
    this.db = db;
  }

  getWorkerSettings() {
    const data = this.db.getData();
    return normalizeWorkerSettings(data.workerSettings || DEFAULT_WORKER_SETTINGS);
  }

  async saveWorkerSettings(changes = {}) {
    const nextSettings = normalizeWorkerSettings({
      ...this.getWorkerSettings(),
      ...changes
    });
    return this.db.transaction(async data => ({
      nextData: { ...data, workerSettings: nextSettings },
      result: nextSettings
    }));
  }

  getActivityConfig() {
    const data = this.db.getData();
    return {
      ...DEFAULT_ACTIVITY_CONFIG,
      ...(data.activityConfig || {})
    };
  }

  async saveActivityConfig(config = {}) {
    const current = this.getActivityConfig();
    const normalized = {
      ...current,
      ...config,
      delayBetweenActions: Math.min(Math.max(Number(config.delayBetweenActions ?? current.delayBetweenActions) || 1, 1), 60),
      maxConcurrentProfiles: Math.min(Math.max(Number(config.maxConcurrentProfiles ?? current.maxConcurrentProfiles) || 40, 1), 50),
      reloginAttempts: Math.min(Math.max(Number(config.reloginAttempts ?? current.reloginAttempts) || 0, 0), 10),
      scriptPreset: String(config.scriptPreset ?? current.scriptPreset)
    };

    return this.db.transaction(async data => ({
      nextData: {
        ...data,
        activityConfig: normalized,
        workerSettings: normalizeWorkerSettings({
          ...(data.workerSettings || DEFAULT_WORKER_SETTINGS),
          maxConcurrency: normalized.maxConcurrentProfiles,
          retryDelayMs: Math.max(250, normalized.delayBetweenActions * 1000)
        })
      },
      result: normalized
    }));
  }

  getGeneralSettings() {
    const data = this.db.getData();
    return {
      ...DEFAULT_GENERAL_SETTINGS,
      ...(data.generalSettings || {})
    };
  }

  async saveGeneralSettings(settings = {}) {
    const current = this.getGeneralSettings();
    const normalized = {
      ...current,
      ...settings,
      maxThreads: Math.min(Math.max(Number(settings.maxThreads ?? current.maxThreads) || 40, 1), 50),
      proxyTimeout: Math.min(Math.max(Number(settings.proxyTimeout ?? current.proxyTimeout) || 15, 3), 60),
      theme: ['dark', 'midnight', 'cyberpunk'].includes(settings.theme) ? settings.theme : current.theme,
      ipcMode: settings.ipcMode === 'mock' ? 'mock' : 'electron_bridge',
      language: settings.language === 'en' ? 'en' : 'vi'
    };

    return this.db.transaction(async data => ({
      nextData: {
        ...data,
        generalSettings: normalized,
        workerSettings: normalizeWorkerSettings({
          ...(data.workerSettings || DEFAULT_WORKER_SETTINGS),
          maxConcurrency: normalized.maxThreads,
          requestTimeoutMs: normalized.proxyTimeout * 1000
        })
      },
      result: normalized
    }));
  }
}

module.exports = WorkerSettingsRepository;
