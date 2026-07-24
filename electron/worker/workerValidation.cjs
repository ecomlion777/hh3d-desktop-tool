/**
 * HH3D Desktop Tool - Phase 06A worker validation helpers.
 */

const {
  DEFAULT_WORKER_SETTINGS,
  ALLOWED_WORKER_HOSTS
} = require('./workerConstants.cjs');

function validateProfileId(profileId) {
  if (typeof profileId !== 'string' || !profileId.trim()) {
    throw new Error('WORKER_INVALID_PROFILE_ID: profileId không hợp lệ.');
  }
  return profileId.trim();
}

function validateProfileIds(profileIds) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    throw new Error('WORKER_EMPTY_PROFILE_LIST: Danh sách profile không được để trống.');
  }
  return Array.from(new Set(profileIds.map(validateProfileId)));
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), minimum), maximum);
}

function normalizeWorkerSettings(input = {}) {
  return {
    maxConcurrency: clampInteger(
      input.maxConcurrency,
      1,
      50,
      DEFAULT_WORKER_SETTINGS.maxConcurrency
    ),
    requestTimeoutMs: clampInteger(
      input.requestTimeoutMs,
      3000,
      60000,
      DEFAULT_WORKER_SETTINGS.requestTimeoutMs
    ),
    maxRetries: clampInteger(
      input.maxRetries,
      0,
      5,
      DEFAULT_WORKER_SETTINGS.maxRetries
    ),
    retryDelayMs: clampInteger(
      input.retryDelayMs,
      250,
      30000,
      DEFAULT_WORKER_SETTINGS.retryDelayMs
    ),
    heartbeatIntervalMs: clampInteger(
      input.heartbeatIntervalMs,
      1000,
      60000,
      DEFAULT_WORKER_SETTINGS.heartbeatIntervalMs
    )
  };
}

function isAllowedWorkerUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_WORKER_HOSTS.some(
      allowed => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

function validateBatchInput(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('BATCH_NAME_REQUIRED: Tên batch không được để trống.');
  const profileIds = validateProfileIds(input.profileIds);
  return {
    name,
    profileIds,
    concurrency: clampInteger(input.concurrency, 1, 50, 40),
    activityType: String(input.activityType || 'Worker Core Session Check').trim(),
    groupTarget: String(input.groupTarget || 'Tất Cả Profiles').trim()
  };
}

module.exports = {
  validateProfileId,
  validateProfileIds,
  normalizeWorkerSettings,
  isAllowedWorkerUrl,
  validateBatchInput
};
