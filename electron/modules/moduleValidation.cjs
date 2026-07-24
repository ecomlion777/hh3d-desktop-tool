const {
  MODULE_RUNTIME_STATES,
  MODULE_IMPLEMENTATION_STATES,
  MODULE_TRIGGERS
} = require('./moduleConstants.cjs');

const MODULE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const MAX_CONFIG_BYTES = 32 * 1024;

function validateModuleCode(moduleCode) {
  const value = String(moduleCode || '').trim();
  if (!MODULE_CODE_PATTERN.test(value)) {
    throw new Error(`MODULE_CODE_INVALID: Module code không hợp lệ: "${value}".`);
  }
  return value;
}

function validateModuleManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('MODULE_MANIFEST_INVALID: Manifest phải là object.');
  }
  const code = validateModuleCode(manifest.code);
  if (!manifest.label || typeof manifest.label !== 'string') {
    throw new Error(`MODULE_MANIFEST_INVALID: Module ${code} thiếu label.`);
  }
  if (!MODULE_IMPLEMENTATION_STATES.includes(manifest.implementationState)) {
    throw new Error(`MODULE_MANIFEST_INVALID: implementationState của ${code} không hợp lệ.`);
  }
  if (!Array.isArray(manifest.triggers) || manifest.triggers.some(item => !MODULE_TRIGGERS.includes(item))) {
    throw new Error(`MODULE_MANIFEST_INVALID: triggers của ${code} không hợp lệ.`);
  }
  if (!Number.isFinite(Number(manifest.order))) {
    throw new Error(`MODULE_MANIFEST_INVALID: order của ${code} không hợp lệ.`);
  }
  return true;
}

function validateModuleConfig(config) {
  if (config === undefined || config === null) return {};
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('MODULE_CONFIG_INVALID: config phải là object JSON.');
  }
  let serialized;
  try {
    serialized = JSON.stringify(config);
  } catch {
    throw new Error('MODULE_CONFIG_INVALID: config không thể chuyển thành JSON.');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) {
    throw new Error(`MODULE_CONFIG_TOO_LARGE: config vượt quá ${MAX_CONFIG_BYTES} bytes.`);
  }
  return JSON.parse(serialized);
}

function validateProfileIds(profileIds) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    throw new Error('MODULE_PROFILE_IDS_REQUIRED: Cần ít nhất một profile.');
  }
  const result = Array.from(new Set(profileIds.map(item => String(item || '').trim()).filter(Boolean)));
  if (result.length === 0) {
    throw new Error('MODULE_PROFILE_IDS_REQUIRED: Danh sách profile không hợp lệ.');
  }
  if (result.length > 500) {
    throw new Error('MODULE_PROFILE_LIMIT: Không thể cấu hình quá 500 profile trong một thao tác.');
  }
  return result;
}

function validateRuntimeState(state) {
  if (!MODULE_RUNTIME_STATES.includes(state)) {
    throw new Error(`MODULE_RUNTIME_STATE_INVALID: ${state}`);
  }
  return state;
}

module.exports = {
  validateModuleCode,
  validateModuleManifest,
  validateModuleConfig,
  validateProfileIds,
  validateRuntimeState
};
