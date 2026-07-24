const { validateModuleCode, validateModuleConfig, validateProfileIds } = require('./moduleValidation.cjs');
const { MODULE_SETTINGS_VERSION } = require('./moduleConstants.cjs');
const { LEGACY_PROFILE_MODULE_CODE_SET } = require('./moduleCompatibility.cjs');

class ModuleSettingsRepository {
  constructor(db, profileRepo, registry) {
    this.db = db;
    this.profileRepo = profileRepo;
    this.registry = registry;
  }


  normalizeRequestedCodes(enabledModuleCodes, catalogMap) {
    const requested = [];
    const seen = new Set();

    for (const rawCode of enabledModuleCodes) {
      const code = validateModuleCode(rawCode);
      if (seen.has(code)) continue;
      seen.add(code);

      if (catalogMap.has(code)) {
        requested.push(code);
        continue;
      }

      // Phase 03-06 mock profiles used placeholder module IDs which are not
      // part of the reviewed Phase 07 catalog. Ignore only those known legacy
      // placeholders so they cannot break a real bulk apply operation.
      if (LEGACY_PROFILE_MODULE_CODE_SET.has(code)) continue;

      throw new Error(`MODULE_NOT_FOUND: Không tìm thấy module ${code}.`);
    }

    return requested;
  }

  normalizeStoredCodes(moduleCodes, catalogMap) {
    if (!Array.isArray(moduleCodes)) return [];
    return Array.from(new Set(moduleCodes
      .map(item => String(item || '').trim())
      .filter(code => catalogMap.has(code))));
  }

  getRawSettings() {
    const data = this.db.getData();
    return Array.isArray(data.moduleSettings) ? data.moduleSettings : [];
  }

  buildDefaultSetting(profileId, manifest) {
    return {
      profileId,
      moduleCode: manifest.code,
      enabled: manifest.required ? true : Boolean(manifest.defaultEnabled),
      config: JSON.parse(JSON.stringify(manifest.defaultConfig || {})),
      lastResult: undefined,
      lastRunAt: undefined,
      nextRunAt: undefined,
      settingsVersion: MODULE_SETTINGS_VERSION,
      updatedAt: new Date().toISOString()
    };
  }

  async ensureProfile(profileId) {
    const profile = await this.profileRepo.getProfileById(profileId);
    if (!profile) throw new Error(`MODULE_PROFILE_NOT_FOUND: Không tìm thấy profile "${profileId}".`);
    return profile;
  }

  async getProfileSettings(profileId) {
    const profile = await this.ensureProfile(profileId);
    const raw = this.getRawSettings().filter(item => item.profileId === profile.id);
    const rawMap = new Map(raw.map(item => [item.moduleCode, item]));

    return this.registry.listCatalog().map(manifest => {
      const stored = rawMap.get(manifest.code);
      const enabledByLegacyProfile = Array.isArray(profile.enabledModules)
        && profile.enabledModules.includes(manifest.code);
      const base = stored || this.buildDefaultSetting(profile.id, manifest);
      return {
        ...base,
        enabled: manifest.required ? true : (stored ? Boolean(stored.enabled) : enabledByLegacyProfile || Boolean(manifest.defaultEnabled)),
        config: validateModuleConfig(base.config || manifest.defaultConfig || {}),
        manifest
      };
    });
  }

  async listEnabledRunnable(profileId, trigger = 'worker_start') {
    const settings = await this.getProfileSettings(profileId);
    return settings.filter(item => (
      item.enabled
      && item.manifest.runnable
      && item.manifest.triggers.includes(trigger)
    ));
  }

  async saveProfileSettings(profileId, inputSettings) {
    const profile = await this.ensureProfile(profileId);
    if (!Array.isArray(inputSettings)) {
      throw new Error('MODULE_SETTINGS_INVALID: settings phải là Array.');
    }

    const catalog = this.registry.listCatalog();
    const catalogMap = new Map(catalog.map(item => [item.code, item]));
    const now = new Date().toISOString();
    const normalizedMap = new Map();

    for (const input of inputSettings) {
      const code = validateModuleCode(input?.moduleCode);
      const manifest = catalogMap.get(code);
      if (!manifest) {
        if (LEGACY_PROFILE_MODULE_CODE_SET.has(code)) continue;
        throw new Error(`MODULE_NOT_FOUND: Không tìm thấy module ${code}.`);
      }
      normalizedMap.set(code, {
        profileId: profile.id,
        moduleCode: code,
        enabled: manifest.required ? true : Boolean(input.enabled),
        config: validateModuleConfig(input.config || manifest.defaultConfig || {}),
        lastResult: input.lastResult,
        lastRunAt: input.lastRunAt,
        nextRunAt: input.nextRunAt,
        settingsVersion: MODULE_SETTINGS_VERSION,
        updatedAt: now
      });
    }

    for (const manifest of catalog) {
      if (!normalizedMap.has(manifest.code)) {
        normalizedMap.set(manifest.code, this.buildDefaultSetting(profile.id, manifest));
      }
    }

    const normalized = Array.from(normalizedMap.values());
    const enabledCodes = normalized
      .filter(item => item.enabled && item.moduleCode !== 'session_check')
      .map(item => item.moduleCode);

    const result = await this.db.transaction(async data => {
      const existing = Array.isArray(data.moduleSettings) ? data.moduleSettings : [];
      const nextSettings = [
        ...existing.filter(item => item.profileId !== profile.id),
        ...normalized
      ];
      const nextProfiles = data.profiles.map(item => item.id === profile.id ? {
        ...item,
        enabledModules: enabledCodes,
        updatedAt: now
      } : item);
      return {
        nextData: { ...data, moduleSettings: nextSettings, profiles: nextProfiles },
        result: normalized
      };
    });

    return this.getProfileSettings(profile.id);
  }

  async applyToProfiles(profileIds, enabledModuleCodes, mode = 'replace') {
    const ids = validateProfileIds(profileIds);
    if (!Array.isArray(enabledModuleCodes)) {
      throw new Error('MODULE_CODES_INVALID: enabledModuleCodes phải là Array.');
    }
    if (!['replace', 'merge'].includes(mode)) {
      throw new Error('MODULE_APPLY_MODE_INVALID: mode phải là replace hoặc merge.');
    }

    const catalog = this.registry.listCatalog();
    const catalogMap = new Map(catalog.map(item => [item.code, item]));
    const requested = this.normalizeRequestedCodes(enabledModuleCodes, catalogMap);

    const now = new Date().toISOString();
    return this.db.transaction(async data => {
      const profileMap = new Map(data.profiles.map(profile => [profile.id, profile]));
      const missing = ids.filter(id => !profileMap.has(id));
      if (missing.length > 0) {
        throw new Error(`MODULE_PROFILE_NOT_FOUND: Không tìm thấy ${missing.join(', ')}.`);
      }

      const existing = Array.isArray(data.moduleSettings) ? data.moduleSettings : [];
      const untouched = existing.filter(item => !ids.includes(item.profileId));
      const nextForProfiles = [];
      const updatedProfiles = [];

      for (const profileId of ids) {
        const profile = profileMap.get(profileId);
        const current = new Map(
          existing.filter(item => item.profileId === profileId).map(item => [item.moduleCode, item])
        );
        const currentEnabled = this.normalizeStoredCodes(profile.enabledModules, catalogMap);
        const enabledSet = new Set(mode === 'merge'
          ? [...currentEnabled, ...requested]
          : requested
        );

        for (const manifest of catalog) {
          const previous = current.get(manifest.code);
          nextForProfiles.push({
            profileId,
            moduleCode: manifest.code,
            enabled: manifest.required ? true : enabledSet.has(manifest.code),
            config: validateModuleConfig(previous?.config || manifest.defaultConfig || {}),
            lastResult: previous?.lastResult,
            lastRunAt: previous?.lastRunAt,
            nextRunAt: previous?.nextRunAt,
            settingsVersion: MODULE_SETTINGS_VERSION,
            updatedAt: now
          });
        }

        updatedProfiles.push({
          ...profile,
          enabledModules: catalog
            .filter(manifest => !manifest.required && enabledSet.has(manifest.code))
            .map(manifest => manifest.code),
          updatedAt: now
        });
      }

      const updatedMap = new Map(updatedProfiles.map(profile => [profile.id, profile]));
      const nextProfiles = data.profiles.map(profile => updatedMap.get(profile.id) || profile);
      return {
        nextData: {
          ...data,
          profiles: nextProfiles,
          moduleSettings: [...untouched, ...nextForProfiles]
        },
        result: {
          profileIds: ids,
          enabledModuleCodes: requested,
          mode,
          updatedProfiles
        }
      };
    });
  }

  async recordResult(profileId, moduleCode, result) {
    const code = validateModuleCode(moduleCode);
    const now = new Date().toISOString();
    return this.db.transaction(async data => {
      const existing = Array.isArray(data.moduleSettings) ? data.moduleSettings : [];
      const index = existing.findIndex(item => item.profileId === profileId && item.moduleCode === code);
      const manifest = this.registry.getManifest(code);
      if (!manifest) throw new Error(`MODULE_NOT_FOUND: Không tìm thấy module ${code}.`);
      const previous = index >= 0 ? existing[index] : this.buildDefaultSetting(profileId, manifest);
      const updated = {
        ...previous,
        lastResult: String(result?.outcome || result?.state || 'unknown'),
        lastRunAt: result?.finishedAt || now,
        nextRunAt: result?.nextRunAt,
        updatedAt: now
      };
      const next = index >= 0
        ? existing.map((item, itemIndex) => itemIndex === index ? updated : item)
        : [...existing, updated];
      return {
        nextData: { ...data, moduleSettings: next },
        result: updated
      };
    });
  }
}

module.exports = ModuleSettingsRepository;
