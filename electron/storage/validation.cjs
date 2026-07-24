/**
 * HH3D Desktop Tool - Validation Helpers for Local JSON Storage
 */

const SUPPORTED_SCHEMA_VERSION = 4;

function validateProfile(profile, existingProfiles, isUpdate = false) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Dữ liệu Profile không hợp lệ.');
  }

  if (!isUpdate) {
    if (!profile.id || typeof profile.id !== 'string' || !profile.id.trim()) {
      throw new Error('Profile ID không được để trống.');
    }
  }

  const uidVal = profile.uid;
  if (!isUpdate || uidVal !== undefined) {
    if (!uidVal || typeof uidVal !== 'string' || !uidVal.trim()) {
      throw new Error('Profile UID không được để trống.');
    }
  }

  if (Array.isArray(existingProfiles)) {
    if (!isUpdate && profile.id) {
      const duplicateId = existingProfiles.some(item => item.id === profile.id);
      if (duplicateId) {
        throw new Error(`Profile với ID "${profile.id}" đã tồn tại.`);
      }
    }

    if (profile.uid) {
      const normalizedUid = String(profile.uid).trim().toLocaleLowerCase('vi-VN');
      const duplicateUid = existingProfiles.some(item => (
        String(item.uid || '').trim().toLocaleLowerCase('vi-VN') === normalizedUid &&
        item.id !== profile.id
      ));
      if (duplicateUid) {
        throw new Error(`Profile với UID "${profile.uid}" đã tồn tại.`);
      }
    }
  }

  return true;
}

function validateGroup(group, existingGroups, isUpdate = false) {
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    throw new Error('Dữ liệu Group không hợp lệ.');
  }

  if (!group.id || typeof group.id !== 'string' || !group.id.trim()) {
    throw new Error('Group ID không được để trống.');
  }

  if (!group.name || typeof group.name !== 'string' || !group.name.trim()) {
    throw new Error('Tên nhóm không được để trống.');
  }

  if (Array.isArray(existingGroups)) {
    if (!isUpdate && existingGroups.some(item => item.id === group.id)) {
      throw new Error(`Group với ID "${group.id}" đã tồn tại.`);
    }

    const normalizedName = group.name.trim().toLocaleLowerCase('vi-VN');
    const duplicateName = existingGroups.some(item => (
      String(item.name || '').trim().toLocaleLowerCase('vi-VN') === normalizedName &&
      item.id !== group.id
    ));
    if (duplicateName) {
      throw new Error(`Tên nhóm "${group.name.trim()}" đã tồn tại trong hệ thống.`);
    }
  }

  return true;
}

function validateDatabaseShape(data, options = {}) {
  const { allowLegacy = true } = options;

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dữ liệu cơ sở dữ liệu phải là một object.');
  }

  if (!Number.isInteger(data.schemaVersion)) {
    throw new Error('schemaVersion không hợp lệ.');
  }

  if (data.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Schema ${data.schemaVersion} mới hơn phiên bản ứng dụng hỗ trợ (${SUPPORTED_SCHEMA_VERSION}).`
    );
  }

  if (!allowLegacy && data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`Schema phải là phiên bản ${SUPPORTED_SCHEMA_VERSION}.`);
  }

  if (data.schemaVersion < 1) {
    throw new Error('schemaVersion không được nhỏ hơn 1.');
  }

  if (!Array.isArray(data.profiles)) {
    throw new Error('Cấu trúc profiles không hợp lệ (phải là Array).');
  }
  if (!Array.isArray(data.groups)) {
    throw new Error('Cấu trúc groups không hợp lệ (phải là Array).');
  }
  if (data.schemaVersion >= 2 && !Array.isArray(data.proxies)) {
    throw new Error('Cấu trúc proxies không hợp lệ (phải là Array).');
  }
  if (data.schemaVersion >= 3) {
    if (!Array.isArray(data.batches)) {
      throw new Error('Cấu trúc batches không hợp lệ (phải là Array).');
    }
    if (!Array.isArray(data.logs)) {
      throw new Error('Cấu trúc logs không hợp lệ (phải là Array).');
    }
    if (!data.workerSettings || typeof data.workerSettings !== 'object' || Array.isArray(data.workerSettings)) {
      throw new Error('Cấu trúc workerSettings không hợp lệ.');
    }
    if (!data.activityConfig || typeof data.activityConfig !== 'object' || Array.isArray(data.activityConfig)) {
      throw new Error('Cấu trúc activityConfig không hợp lệ.');
    }
    if (!data.generalSettings || typeof data.generalSettings !== 'object' || Array.isArray(data.generalSettings)) {
      throw new Error('Cấu trúc generalSettings không hợp lệ.');
    }
  }
  if (data.schemaVersion >= 4) {
    if (!Array.isArray(data.moduleSettings)) {
      throw new Error('Cấu trúc moduleSettings không hợp lệ (phải là Array).');
    }
  }

  return true;
}

module.exports = {
  SUPPORTED_SCHEMA_VERSION,
  validateProfile,
  validateGroup,
  validateDatabaseShape
};
