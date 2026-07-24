/**
 * HH3D Desktop Tool - Phase 07 Module Framework constants.
 */

const MODULE_IPC_CHANNELS = Object.freeze({
  LIST_CATALOG: 'modules:list-catalog',
  GET_PROFILE_SETTINGS: 'modules:get-profile-settings',
  SAVE_PROFILE_SETTINGS: 'modules:save-profile-settings',
  APPLY_TO_PROFILES: 'modules:apply-to-profiles',
  RUN_ONCE: 'modules:run-once',
  GET_RUNTIME_STATUS: 'modules:get-runtime-status',
  LIST_RUNTIME_STATUSES: 'modules:list-runtime-statuses',
  STATUS_CHANGED: 'modules:status-changed',
  SETTINGS_CHANGED: 'modules:settings-changed'
});

const MODULE_RUNTIME_STATES = Object.freeze([
  'idle',
  'queued',
  'running',
  'success',
  'skipped',
  'error',
  'cancelled'
]);

const MODULE_IMPLEMENTATION_STATES = Object.freeze([
  'ready',
  'planned',
  'disabled'
]);

const MODULE_TRIGGERS = Object.freeze([
  'manual',
  'worker_start'
]);

const MODULE_SETTINGS_VERSION = 1;
const MODULE_CATALOG_VERSION = 1;
const DEFAULT_MODULE_TIMEOUT_MS = 30000;

module.exports = {
  MODULE_IPC_CHANNELS,
  MODULE_RUNTIME_STATES,
  MODULE_IMPLEMENTATION_STATES,
  MODULE_TRIGGERS,
  MODULE_SETTINGS_VERSION,
  MODULE_CATALOG_VERSION,
  DEFAULT_MODULE_TIMEOUT_MS
};
