/**
 * HH3D Desktop Tool - Transactional public proxy repository
 */

const {
  validateProxyId,
  normalizeIdList,
  validateProxyInput,
  sanitizeProxyPublic,
  proxyError
} = require('./proxyValidation.cjs');

class ProxyRepository {
  constructor(db, secretStore) {
    this.db = db;
    this.secretStore = secretStore;
  }

  async listProxies(runtimeResults = new Map()) {
    const data = this.db.getData();
    const profiles = data.profiles || [];
    const proxies = data.proxies || [];

    return proxies.map(proxy => {
      const assignedProfileCount = profiles.filter(profile => profile.proxyId === proxy.id).length;
      const runtime = runtimeResults.get(proxy.id) || {};
      let maskedUsername;
      let credentialState = proxy.hasCredentials ? 'saved' : 'none';

      if (proxy.hasCredentials) {
        try {
          maskedUsername = this.secretStore.getMaskedUsername(proxy.id);
        } catch {
          credentialState = 'decrypt_error';
        }
      }

      return sanitizeProxyPublic(proxy, {
        ...runtime,
        assignedProfileCount,
        maskedUsername,
        credentialState
      });
    });
  }

  async getProxyById(proxyId, runtimeResult) {
    const id = validateProxyId(proxyId);
    const data = this.db.getData();
    const proxy = (data.proxies || []).find(item => item.id === id);
    if (!proxy) return null;

    const assignedProfileCount = (data.profiles || []).filter(profile => profile.proxyId === id).length;
    let maskedUsername;
    let credentialState = proxy.hasCredentials ? 'saved' : 'none';

    if (proxy.hasCredentials) {
      try {
        maskedUsername = this.secretStore.getMaskedUsername(id);
      } catch {
        credentialState = 'decrypt_error';
      }
    }

    return sanitizeProxyPublic(proxy, {
      ...(runtimeResult || {}),
      assignedProfileCount,
      maskedUsername,
      credentialState
    });
  }

  getRawProxyById(proxyId) {
    const id = validateProxyId(proxyId);
    const data = this.db.getData();
    return (data.proxies || []).find(item => item.id === id) || null;
  }

  async createProxy(input) {
    const data = this.db.getData();
    const existing = data.proxies || [];
    const validated = validateProxyInput(input, existing);
    const now = new Date().toISOString();
    const id = input.id || `proxy_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const hasCredentialInput = Boolean(input.username || input.password);
    const authRequired = Boolean(input.authRequired || hasCredentialInput);

    if (hasCredentialInput) {
      this.secretStore.ensureEncryptionAvailable();
      if (!input.username || !input.password) {
        throw proxyError('PROXY_AUTH_REQUIRED', 'Credential proxy cần đầy đủ username và password.');
      }
    }
    if (authRequired && !hasCredentialInput) {
      throw proxyError('PROXY_AUTH_REQUIRED', 'Proxy xác thực cần đầy đủ username và password.');
    }

    const publicRecord = {
      id,
      name: validated.name,
      protocol: validated.protocol,
      host: validated.host,
      port: validated.port,
      enabled: validated.enabled,
      authRequired,
      hasCredentials: hasCredentialInput,
      notes: validated.notes,
      createdAt: now,
      updatedAt: now
    };

    await this.db.transaction(async workingData => {
      const proxies = workingData.proxies || [];
      validateProxyInput(publicRecord, proxies);
      return {
        nextData: { ...workingData, proxies: [...proxies, publicRecord] },
        result: true
      };
    });

    try {
      if (hasCredentialInput) {
        await this.secretStore.setCredentials(id, input.username, input.password);
      }
    } catch (error) {
      await this.db.transaction(async workingData => ({
        nextData: {
          ...workingData,
          proxies: (workingData.proxies || []).filter(item => item.id !== id)
        },
        result: true
      }));
      try { await this.secretStore.deleteCredentials(id); } catch {}
      throw error;
    }

    return this.getProxyById(id);
  }

  async updateProxy(proxyId, changes) {
    const id = validateProxyId(proxyId);
    const oldPublic = this.getRawProxyById(id);
    if (!oldPublic) {
      throw proxyError('PROXY_NOT_FOUND', `Không tìm thấy proxy ID "${id}".`);
    }

    let oldCredentials = null;
    if (oldPublic.hasCredentials) {
      oldCredentials = this.secretStore.getCredentials(id);
    }

    const currentData = this.db.getData();
    const mergedInput = {
      ...oldPublic,
      ...changes,
      id,
      authRequired: changes.clearCredentials ? false :
        changes.authRequired !== undefined ? Boolean(changes.authRequired) : Boolean(oldPublic.authRequired)
    };
    const validated = validateProxyInput(mergedInput, currentData.proxies || [], {
      isUpdate: true,
      ignoreId: id
    });

    const credentialsExplicitlySupplied = Boolean(changes.username || changes.password);
    const clearCredentials = changes.clearCredentials === true;
    const shouldHaveCredentials = clearCredentials ? false :
      credentialsExplicitlySupplied ? true :
      Boolean(oldCredentials);

    if (mergedInput.authRequired && !shouldHaveCredentials) {
      throw proxyError('PROXY_AUTH_REQUIRED', 'Proxy xác thực chưa có credential đã lưu.');
    }

    if (credentialsExplicitlySupplied) {
      this.secretStore.ensureEncryptionAvailable();
      const nextUsername = changes.username || oldCredentials?.username;
      const nextPassword = changes.password || oldCredentials?.password;
      if (!nextUsername || !nextPassword) {
        throw proxyError('PROXY_AUTH_REQUIRED', 'Proxy xác thực cần đầy đủ username và password.');
      }
    }

    const updatedPublic = {
      ...oldPublic,
      name: validated.name,
      protocol: validated.protocol,
      host: validated.host,
      port: validated.port,
      enabled: validated.enabled,
      authRequired: clearCredentials ? false : Boolean(mergedInput.authRequired),
      hasCredentials: shouldHaveCredentials,
      notes: validated.notes,
      updatedAt: new Date().toISOString()
    };

    await this.db.transaction(async workingData => ({
      nextData: {
        ...workingData,
        proxies: (workingData.proxies || []).map(item => item.id === id ? updatedPublic : item)
      },
      result: true
    }));

    try {
      if (clearCredentials) {
        await this.secretStore.deleteCredentials(id);
      } else if (credentialsExplicitlySupplied) {
        await this.secretStore.setCredentials(
          id,
          changes.username || oldCredentials?.username,
          changes.password || oldCredentials?.password
        );
      }
    } catch (error) {
      await this.db.transaction(async workingData => ({
        nextData: {
          ...workingData,
          proxies: (workingData.proxies || []).map(item => item.id === id ? oldPublic : item)
        },
        result: true
      }));
      if (oldCredentials) {
        try { await this.secretStore.setCredentials(id, oldCredentials.username, oldCredentials.password); } catch {}
      }
      throw error;
    }

    return this.getProxyById(id);
  }

  async deleteProxy(proxyId) {
    const id = validateProxyId(proxyId);
    const existing = this.getRawProxyById(id);
    if (!existing) {
      throw proxyError('PROXY_NOT_FOUND', `Không tìm thấy proxy ID "${id}".`);
    }

    const result = await this.db.transaction(async workingData => {
      const originalProfiles = workingData.profiles || [];
      const affectedProfileIds = originalProfiles
        .filter(profile => profile.proxyId === id)
        .map(profile => profile.id);
      const affectedSet = new Set(affectedProfileIds);
      const now = new Date().toISOString();

      const profiles = originalProfiles.map(profile => {
        if (!affectedSet.has(profile.id)) return profile;
        return {
          ...profile,
          proxyId: null,
          proxyAddress: 'Không dùng Proxy',
          expectedIp: '',
          currentIp: '',
          updatedAt: now
        };
      });

      return {
        nextData: {
          ...workingData,
          proxies: (workingData.proxies || []).filter(item => item.id !== id),
          profiles
        },
        result: { deleted: true, affectedProfileIds }
      };
    });

    try {
      await this.secretStore.deleteCredentials(id);
    } catch (error) {
      console.error('[ProxyRepository] Non-sensitive credential cleanup failure:', error.message);
    }

    return result;
  }

  async assignProxyToProfiles(profileIds, proxyId) {
    const ids = normalizeIdList(profileIds, 'Danh sách profile ID');
    if (ids.length === 0) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', 'Chưa chọn profile để gán proxy.');
    }

    const id = validateProxyId(proxyId);
    const idSet = new Set(ids);

    return this.db.transaction(async workingData => {
      const proxy = (workingData.proxies || []).find(item => item.id === id);
      if (!proxy) {
        throw proxyError('PROXY_NOT_FOUND', `Không tìm thấy proxy ID "${id}".`);
      }
      if (!proxy.enabled) {
        throw proxyError('PROXY_DISABLED', `Proxy "${proxy.name}" đang bị tắt.`);
      }

      const profiles = workingData.profiles || [];
      const profileIdSet = new Set(profiles.map(profile => profile.id));
      const missing = ids.filter(profileId => !profileIdSet.has(profileId));
      if (missing.length > 0) {
        throw proxyError('PROXY_INVALID_CONFIGURATION', `Không tìm thấy ${missing.length} profile được chọn.`);
      }

      const now = new Date().toISOString();
      const updated = profiles.map(profile => idSet.has(profile.id) ? {
        ...profile,
        proxyId: id,
        proxyAddress: `${proxy.host}:${proxy.port}`,
        expectedIp: '',
        currentIp: '',
        updatedAt: now
      } : profile);

      return {
        nextData: { ...workingData, profiles: updated },
        result: updated.filter(profile => idSet.has(profile.id))
      };
    });
  }

  async unassignProxyFromProfiles(profileIds) {
    const ids = normalizeIdList(profileIds, 'Danh sách profile ID');
    if (ids.length === 0) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', 'Chưa chọn profile để bỏ gán proxy.');
    }

    return this.db.transaction(async workingData => {
      const profiles = workingData.profiles || [];
      const missing = ids.filter(profileId => !profiles.some(profile => profile.id === profileId));
      if (missing.length > 0) {
        throw proxyError('PROXY_INVALID_CONFIGURATION', `Không tìm thấy ${missing.length} profile được chọn.`);
      }

      const updated = profiles.map(profile => ids.includes(profile.id) ? {
        ...profile,
        proxyId: null,
        proxyAddress: 'Không dùng Proxy',
        expectedIp: '',
        currentIp: '',
        updatedAt: new Date().toISOString()
      } : profile);

      return {
        nextData: { ...workingData, profiles: updated },
        result: updated.filter(profile => ids.includes(profile.id))
      };
    });
  }

  async replaceProfilesForProxy(proxyId, profileIds) {
    const id = validateProxyId(proxyId);
    const ids = normalizeIdList(profileIds, 'Danh sách profile ID');
    const targetSet = new Set(ids);

    return this.db.transaction(async workingData => {
      const profiles = workingData.profiles || [];
      const proxy = (workingData.proxies || []).find(item => item.id === id);
      if (!proxy) {
        throw proxyError('PROXY_NOT_FOUND', `Không tìm thấy proxy ID "${id}".`);
      }

      const profileIdSet = new Set(profiles.map(profile => profile.id));
      const missing = ids.filter(profileId => !profileIdSet.has(profileId));
      if (missing.length > 0) {
        throw proxyError('PROXY_INVALID_CONFIGURATION', `Không tìm thấy ${missing.length} profile được chọn.`);
      }

      const currentlyAssignedSet = new Set(
        profiles.filter(profile => profile.proxyId === id).map(profile => profile.id)
      );
      const introducesNewAssignments = ids.some(profileId => !currentlyAssignedSet.has(profileId));
      if (!proxy.enabled && introducesNewAssignments) {
        throw proxyError(
          'PROXY_DISABLED',
          `Proxy "${proxy.name}" đang bị tắt. Chỉ có thể bỏ gán các profile hiện tại.`
        );
      }

      const now = new Date().toISOString();
      const affectedProfileIds = new Set();
      const updated = profiles.map(profile => {
        if (targetSet.has(profile.id)) {
          if (profile.proxyId !== id) affectedProfileIds.add(profile.id);
          return {
            ...profile,
            proxyId: id,
            proxyAddress: `${proxy.host}:${proxy.port}`,
            expectedIp: '',
            currentIp: '',
            updatedAt: now
          };
        }
        if (profile.proxyId === id) {
          affectedProfileIds.add(profile.id);
          return {
            ...profile,
            proxyId: null,
            proxyAddress: 'Không dùng Proxy',
            expectedIp: '',
            currentIp: '',
            updatedAt: now
          };
        }
        return profile;
      });

      return {
        nextData: { ...workingData, profiles: updated },
        result: updated.filter(profile => affectedProfileIds.has(profile.id) || targetSet.has(profile.id))
      };
    });
  }

  /**
   * Atomically assigns one distinct enabled proxy to each selected profile.
   * Pairing is positional: profileIds[index] receives proxyIds[index].
   */
  async assignProxiesOneToOne(profileIds, proxyIds) {
    if (!Array.isArray(profileIds) || !Array.isArray(proxyIds)) {
      throw proxyError(
        'PROXY_INVALID_CONFIGURATION',
        'Danh sách profile và proxy phải là mảng.'
      );
    }

    const rawProfileIds = profileIds.map(value => String(value || '').trim());
    const rawProxyIds = proxyIds.map(value => String(value || '').trim());

    if (rawProfileIds.length === 0) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', 'Chưa chọn profile để gán proxy 1-1.');
    }
    if (rawProfileIds.length !== rawProxyIds.length) {
      throw proxyError(
        'PROXY_ONE_TO_ONE_COUNT_MISMATCH',
        `Số profile (${rawProfileIds.length}) phải bằng số proxy (${rawProxyIds.length}).`
      );
    }
    if (rawProfileIds.some(value => !value) || rawProxyIds.some(value => !value)) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', 'Danh sách gán 1-1 chứa ID rỗng.');
    }
    if (new Set(rawProfileIds).size !== rawProfileIds.length) {
      throw proxyError('PROXY_DUPLICATE_PROFILE_ASSIGNMENT', 'Một profile xuất hiện nhiều lần trong danh sách gán 1-1.');
    }
    if (new Set(rawProxyIds).size !== rawProxyIds.length) {
      throw proxyError('PROXY_DUPLICATE_ONE_TO_ONE', 'Mỗi profile phải được gán một proxy khác nhau.');
    }

    const normalizedProfileIds = normalizeIdList(rawProfileIds, 'Danh sách profile ID');
    const normalizedProxyIds = normalizeIdList(rawProxyIds, 'Danh sách proxy ID');

    return this.db.transaction(async workingData => {
      const profiles = workingData.profiles || [];
      const proxies = workingData.proxies || [];
      const profileById = new Map(profiles.map(profile => [profile.id, profile]));
      const proxyById = new Map(proxies.map(proxy => [proxy.id, proxy]));

      const missingProfiles = normalizedProfileIds.filter(profileId => !profileById.has(profileId));
      if (missingProfiles.length > 0) {
        throw proxyError(
          'PROXY_INVALID_CONFIGURATION',
          `Không tìm thấy ${missingProfiles.length} profile trong danh sách gán 1-1.`
        );
      }

      const missingProxies = normalizedProxyIds.filter(proxyId => !proxyById.has(proxyId));
      if (missingProxies.length > 0) {
        throw proxyError(
          'PROXY_NOT_FOUND',
          `Không tìm thấy ${missingProxies.length} proxy trong danh sách gán 1-1.`
        );
      }

      const disabledProxies = normalizedProxyIds
        .map(proxyId => proxyById.get(proxyId))
        .filter(proxy => proxy && !proxy.enabled);
      if (disabledProxies.length > 0) {
        throw proxyError(
          'PROXY_DISABLED',
          `${disabledProxies.length} proxy đang bị tắt và không thể gán.`
        );
      }

      const assignmentByProfileId = new Map();
      const assignments = normalizedProfileIds.map((profileId, index) => {
        const proxy = proxyById.get(normalizedProxyIds[index]);
        assignmentByProfileId.set(profileId, proxy);
        return {
          profileId,
          proxyId: proxy.id
        };
      });

      const now = new Date().toISOString();
      const updatedProfiles = profiles.map(profile => {
        const proxy = assignmentByProfileId.get(profile.id);
        if (!proxy) return profile;
        return {
          ...profile,
          proxyId: proxy.id,
          proxyAddress: `${proxy.host}:${proxy.port}`,
          expectedIp: '',
          currentIp: '',
          updatedAt: now
        };
      });
      const updatedById = new Map(updatedProfiles.map(profile => [profile.id, profile]));

      return {
        nextData: {
          ...workingData,
          profiles: updatedProfiles
        },
        result: {
          assignments,
          profiles: normalizedProfileIds.map(profileId => updatedById.get(profileId))
        }
      };
    });
  }

  async getProfilesUsingProxy(proxyId) {
    const id = validateProxyId(proxyId);
    return (this.db.getData().profiles || []).filter(profile => profile.proxyId === id);
  }

  async importProxies(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', 'Không có proxy hợp lệ để import.');
    }
    if (items.length > 500) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', 'Mỗi lần chỉ được import tối đa 500 proxy.');
    }

    const existing = this.db.getData().proxies || [];
    const prepared = [];
    const usedNames = new Set(existing.map(item => item.name.toLocaleLowerCase('vi-VN')));

    items.forEach((input, index) => {
      let baseName = String(input.name || `Proxy Import ${existing.length + index + 1}`).trim();
      let uniqueName = baseName;
      let suffix = 2;
      while (usedNames.has(uniqueName.toLocaleLowerCase('vi-VN'))) {
        uniqueName = `${baseName} (${suffix++})`;
      }
      usedNames.add(uniqueName.toLocaleLowerCase('vi-VN'));

      const validated = validateProxyInput({ ...input, name: uniqueName }, [...existing, ...prepared]);
      const id = `proxy_${Date.now()}_${index}_${Math.floor(Math.random() * 100000)}`;
      const wantsCredentials = Boolean(input.username || input.password);
      if (wantsCredentials && (!input.username || !input.password)) {
        throw proxyError('PROXY_AUTH_REQUIRED', `Dòng ${index + 1} thiếu username hoặc password.`);
      }
      if (wantsCredentials) this.secretStore.ensureEncryptionAvailable();

      prepared.push({
        id,
        name: validated.name,
        protocol: validated.protocol,
        host: validated.host,
        port: validated.port,
        enabled: validated.enabled,
        authRequired: wantsCredentials,
        hasCredentials: wantsCredentials,
        notes: validated.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _username: input.username,
        _password: input.password
      });
    });

    const publicRecords = prepared.map(({ _username, _password, ...publicRecord }) => publicRecord);
    await this.db.transaction(async workingData => {
      const latest = [...(workingData.proxies || [])];
      for (const publicRecord of publicRecords) {
        validateProxyInput(publicRecord, latest);
        latest.push(publicRecord);
      }
      return {
        nextData: {
          ...workingData,
          proxies: latest
        },
        result: true
      };
    });

    const credentialItems = prepared
      .filter(item => item.hasCredentials)
      .map(item => ({
        proxyId: item.id,
        username: item._username,
        password: item._password
      }));

    try {
      await this.secretStore.setManyCredentials(credentialItems);
    } catch (error) {
      await this.db.transaction(async workingData => ({
        nextData: {
          ...workingData,
          proxies: (workingData.proxies || []).filter(item => !publicRecords.some(created => created.id === item.id))
        },
        result: true
      }));
      try {
        await this.secretStore.deleteManyCredentials(publicRecords.map(item => item.id));
      } catch {}
      throw error;
    }

    const result = [];
    for (const record of publicRecords) {
      result.push(await this.getProxyById(record.id));
    }
    return result;
  }
}

module.exports = ProxyRepository;
