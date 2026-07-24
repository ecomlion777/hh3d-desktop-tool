/**
 * HH3D Desktop Tool - Phase 06A API Worker Core constants.
 */

const WORKER_IPC_CHANNELS = Object.freeze({
  START_PROFILES: 'workers:start-profiles',
  STOP_PROFILES: 'workers:stop-profiles',
  GET_STATUS: 'workers:get-status',
  LIST_STATUSES: 'workers:list-statuses',
  GET_SUMMARY: 'workers:get-summary',
  RUN_GROUP: 'workers:run-group',
  STOP_GROUP: 'workers:stop-group',
  STATUS_CHANGED: 'workers:status-changed',
  SUMMARY_CHANGED: 'workers:summary-changed',
  PROFILES_CHANGED: 'profiles:changed',
  BATCHES_CHANGED: 'batches:changed',
  LOGS_CHANGED: 'logs:changed',
  STATS_CHANGED: 'stats:changed'
});

const DEFAULT_WORKER_SETTINGS = Object.freeze({
  maxConcurrency: 40,
  requestTimeoutMs: 15000,
  maxRetries: 1,
  retryDelayMs: 1500,
  heartbeatIntervalMs: 5000
});

const WORKER_HEALTHCHECK_URL = 'https://api.ipify.org?format=json';

const ALLOWED_WORKER_HOSTS = Object.freeze([
  'hoathinh3d.co',
  'hoathinh3d.st',
  'api.ipify.org'
]);

const DEFAULT_ACTIVITY_CONFIG = Object.freeze({
  autoDailyQuest: false,
  autoDungeon: false,
  autoBossRaid: false,
  autoClearInventory: false,
  autoClaimMailReward: false,
  delayBetweenActions: 5,
  maxConcurrentProfiles: 40,
  autoReloginOnDisconnect: false,
  reloginAttempts: 0,
  proxyFailover: false,
  scriptPreset: 'worker-core-session-check'
});

const DEFAULT_GENERAL_SETTINGS = Object.freeze({
  websiteBaseUrl: 'https://hoathinh3d.co/',
  websiteAllowedHosts: ['hoathinh3d.co', 'hoathinh3d.com', 'hoathinh3d.st'],
  theme: 'dark',
  maxThreads: 40,
  minimizeToTray: true,
  autoStartWithSystem: false,
  ipcMode: 'electron_bridge',
  proxyTimeout: 15,
  checkUpdateAuto: true,
  language: 'vi'
});

module.exports = {
  WORKER_IPC_CHANNELS,
  DEFAULT_WORKER_SETTINGS,
  WORKER_HEALTHCHECK_URL,
  ALLOWED_WORKER_HOSTS,
  DEFAULT_ACTIVITY_CONFIG,
  DEFAULT_GENERAL_SETTINGS
};
