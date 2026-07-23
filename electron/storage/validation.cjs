/**
 * HH3D Desktop Tool - Validation Helpers for Storage Repository
 */

function validateProfile(profile, existingProfiles, isUpdate = false) {
  if (!profile || typeof profile !== 'object') {
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

  // Check unique ID & UID
  if (existingProfiles && Array.isArray(existingProfiles)) {
    if (!isUpdate && profile.id) {
      const duplicateId = existingProfiles.some(p => p.id === profile.id);
      if (duplicateId) {
        throw new Error(`Profile với ID "${profile.id}" đã tồn tại.`);
      }
    }

    if (uidVal) {
      const duplicateUid = existingProfiles.some(
        p => p.uid === uidVal && p.id !== profile.id
      );
      if (duplicateUid) {
        throw new Error(`Profile với UID "${uidVal}" đã tồn tại trong hệ thống.`);
      }
    }
  }

  return true;
}

function validateGroup(group, existingGroups, isUpdate = false) {
  if (!group || typeof group !== 'object') {
    throw new Error('Dữ liệu Group không hợp lệ.');
  }

  if (!isUpdate) {
    if (!group.id || typeof group.id !== 'string' || !group.id.trim()) {
      throw new Error('Group ID không được để trống.');
    }
  }

  const nameVal = group.name;
  if (!isUpdate || nameVal !== undefined) {
    if (!nameVal || typeof nameVal !== 'string' || !nameVal.trim()) {
      throw new Error('Tên Nhóm (Group Name) không được để trống.');
    }
  }

  if (existingGroups && Array.isArray(existingGroups)) {
    if (!isUpdate && group.id) {
      const duplicateId = existingGroups.some(g => g.id === group.id);
      if (duplicateId) {
        throw new Error(`Group với ID "${group.id}" đã tồn tại.`);
      }
    }

    if (nameVal) {
      const normalizedName = nameVal.trim().toLocaleLowerCase('vi-VN');
      const duplicateName = existingGroups.some(
        g => g.name.trim().toLocaleLowerCase('vi-VN') === normalizedName && g.id !== group.id
      );
      if (duplicateName) {
        throw new Error(`Tên nhóm "${nameVal.trim()}" đã tồn tại trong hệ thống.`);
      }
    }
  }

  return true;
}

function validateDatabaseShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dữ liệu cơ sở dữ liệu phải là một object.');
  }

  if (typeof data.schemaVersion !== 'number') {
    throw new Error('Cấu trúc schemaVersion không hợp lệ (phải là number).');
  }

  if (!Array.isArray(data.profiles)) {
    throw new Error('Cấu trúc profiles không hợp lệ (phải là Array).');
  }

  if (!Array.isArray(data.groups)) {
    throw new Error('Cấu trúc groups không hợp lệ (phải là Array).');
  }

  return true;
}

module.exports = {
  validateProfile,
  validateGroup,
  validateDatabaseShape
};
