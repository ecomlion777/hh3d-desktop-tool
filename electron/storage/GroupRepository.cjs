/**
 * HH3D Desktop Tool - Group Storage Repository
 */

const { validateGroup } = require('./validation.cjs');

class GroupRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Returns all groups enriched with dynamic counts calculated strictly from profiles
   */
  async listGroups() {
    const data = this.db.getData();
    const rawGroups = data.groups || [];
    const profiles = data.profiles || [];

    return rawGroups.map(group => {
      const groupProfiles = profiles.filter(
        p => p.groupId === group.id || p.group === group.name
      );

      const profileCount = groupProfiles.length;
      const runningCount = groupProfiles.filter(p => p.status === 'running').length;
      const waitingCount = groupProfiles.filter(p => p.status === 'waiting').length;
      const stoppedCount = groupProfiles.filter(p => p.status === 'stopped').length;

      return {
        ...group,
        profileCount,
        runningCount,
        waitingCount,
        stoppedCount
      };
    });
  }

  /**
   * Creates a new group transactional
   */
  async createGroup(groupInput) {
    return this.db.transaction(async (data) => {
      const groups = data.groups || [];

      const nowISO = new Date().toISOString();
      const id = groupInput.id || `group_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newGroup = {
        ...groupInput,
        id,
        name: groupInput.name || 'Nhóm Mới',
        description: groupInput.description || '',
        color: groupInput.color || '#3b82f6',
        createdAt: nowISO,
        updatedAt: nowISO
      };

      validateGroup(newGroup, groups, false);

      const nextGroups = [...groups, newGroup];
      const nextData = { ...data, groups: nextGroups };

      return {
        nextData,
        result: newGroup
      };
    });
  }

  /**
   * Updates an existing group transactional
   */
  async updateGroup(groupId, changes) {
    return this.db.transaction(async (data) => {
      const groups = data.groups || [];

      const existing = groups.find(g => g.id === groupId);
      if (!existing) {
        throw new Error(`Không tìm thấy group với ID: "${groupId}"`);
      }

      const updatedGroup = {
        ...existing,
        ...changes,
        id: groupId,
        updatedAt: new Date().toISOString()
      };

      validateGroup(updatedGroup, groups, true);

      const nextGroups = groups.map(g => g.id === groupId ? updatedGroup : g);

      // If group name changed, update group name on profiles referencing this group ID
      let profiles = data.profiles || [];
      if (changes.name && changes.name !== existing.name) {
        profiles = profiles.map(p => {
          if (p.groupId === groupId) {
            return { ...p, group: changes.name, updatedAt: new Date().toISOString() };
          }
          return p;
        });
      }

      const nextData = { ...data, groups: nextGroups, profiles };

      return {
        nextData,
        result: updatedGroup
      };
    });
  }

  /**
   * Deletes a group and disassociates profiles belonging to it in a single atomic transaction
   */
  async deleteGroup(groupId) {
    return this.db.transaction(async (data) => {
      const groups = data.groups || [];
      const profiles = data.profiles || [];

      const initialGroupsCount = groups.length;
      const filteredGroups = groups.filter(g => g.id !== groupId);

      if (filteredGroups.length === initialGroupsCount) {
        return {
          nextData: data,
          result: false
        };
      }

      // Reassign profiles belonging to deleted group to null
      const nextProfiles = profiles.map(p => {
        if (p.groupId === groupId) {
          return {
            ...p,
            groupId: null,
            group: 'Chưa Phân Nhóm',
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });

      const nextData = { ...data, groups: filteredGroups, profiles: nextProfiles };

      return {
        nextData,
        result: true
      };
    });
  }
}

module.exports = GroupRepository;
