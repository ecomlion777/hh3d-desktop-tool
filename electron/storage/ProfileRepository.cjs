/**
 * HH3D Desktop Tool - Profile Storage Repository
 */

const { validateProfile } = require('./validation.cjs');

class ProfileRepository {
  constructor(db) {
    this.db = db;
  }

  resolveGroupForCreate(profileInput, groups) {
    if (profileInput.groupId) {
      const found = groups.find(g => g.id === profileInput.groupId);
      if (found) {
        return { groupId: found.id, group: found.name };
      }
      return { groupId: null, group: 'Chưa Phân Nhóm' };
    }

    if (profileInput.group) {
      const found = groups.find(g => g.name === profileInput.group);
      if (found) {
        return { groupId: found.id, group: found.name };
      }
      return { groupId: null, group: 'Chưa Phân Nhóm' };
    }

    return { groupId: null, group: 'Chưa Phân Nhóm' };
  }

  resolveGroupForUpdate(existing, changes, groups) {
    if (Object.prototype.hasOwnProperty.call(changes, 'groupId')) {
      const targetGroupId = changes.groupId;
      if (targetGroupId) {
        const found = groups.find(g => g.id === targetGroupId);
        if (found) {
          return { groupId: found.id, group: found.name };
        }
      }
      return { groupId: null, group: 'Chưa Phân Nhóm' };
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'group')) {
      const targetGroupName = changes.group;
      if (targetGroupName) {
        const found = groups.find(g => g.name === targetGroupName);
        if (found) {
          return { groupId: found.id, group: found.name };
        }
      }
      return { groupId: null, group: 'Chưa Phân Nhóm' };
    }

    return {
      groupId: existing.groupId !== undefined ? existing.groupId : null,
      group: existing.group || 'Chưa Phân Nhóm'
    };
  }

  /**
   * Returns all profiles
   */
  async listProfiles() {
    const data = this.db.getData();
    return data.profiles || [];
  }

  /**
   * Finds a single profile by ID
   */
  async getProfileById(profileId) {
    const data = this.db.getData();
    return (data.profiles || []).find(p => p.id === profileId) || null;
  }

  /**
   * Creates a new profile transactional
   */
  async createProfile(profileInput) {
    return this.db.transaction(async (data) => {
      const profiles = data.profiles || [];
      const groups = data.groups || [];

      const nowISO = new Date().toISOString();
      const id = profileInput.id || `profile_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const { groupId, group } = this.resolveGroupForCreate(profileInput, groups);

      const newProfile = {
        ...profileInput,
        id,
        displayName: profileInput.displayName || profileInput.characterName || `Char_${profileInput.uid}`,
        characterName: profileInput.characterName || profileInput.displayName || `Char_${profileInput.uid}`,
        groupId,
        group,
        status: profileInput.status || 'stopped',
        currentActivity: profileInput.currentActivity || 'Vừa khởi tạo',
        level: profileInput.level !== undefined ? profileInput.level : 70,
        stamina: profileInput.stamina !== undefined ? profileInput.stamina : 100,
        createdAt: nowISO,
        updatedAt: nowISO
      };

      validateProfile(newProfile, profiles, false);

      const nextProfiles = [...profiles, newProfile];
      const nextData = { ...data, profiles: nextProfiles };

      return {
        nextData,
        result: newProfile
      };
    });
  }

  /**
   * Updates an existing profile transactional
   */
  async updateProfile(profileId, changes) {
    return this.db.transaction(async (data) => {
      const profiles = data.profiles || [];
      const groups = data.groups || [];

      const existing = profiles.find(p => p.id === profileId);
      if (!existing) {
        throw new Error(`Không tìm thấy profile với ID: "${profileId}"`);
      }

      const groupFields = this.resolveGroupForUpdate(existing, changes, groups);

      const updatedProfile = {
        ...existing,
        ...changes,
        ...groupFields,
        id: profileId, // Prevent ID overwrite
        updatedAt: new Date().toISOString()
      };

      validateProfile(updatedProfile, profiles, true);

      const nextProfiles = profiles.map(p => p.id === profileId ? updatedProfile : p);
      const nextData = { ...data, profiles: nextProfiles };

      return {
        nextData,
        result: updatedProfile
      };
    });
  }

  /**
   * Deletes a profile by ID transactional
   */
  async deleteProfile(profileId) {
    return this.db.transaction(async (data) => {
      const profiles = data.profiles || [];

      const initialLength = profiles.length;
      const filteredProfiles = profiles.filter(p => p.id !== profileId);

      if (filteredProfiles.length === initialLength) {
        return {
          nextData: data,
          result: false
        };
      }

      const nextData = { ...data, profiles: filteredProfiles };

      return {
        nextData,
        result: true
      };
    });
  }
}

module.exports = ProfileRepository;
