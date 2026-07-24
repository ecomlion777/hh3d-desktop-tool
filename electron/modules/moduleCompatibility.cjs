/**
 * Compatibility helpers for profile module IDs created before Phase 07.
 */

const LEGACY_PROFILE_MODULE_CODES = Object.freeze([
  'daily_quest',
  'dungeon',
  'boss_raid',
  'clear_inventory',
  'claim_mail'
]);

const LEGACY_PROFILE_MODULE_CODE_SET = new Set(LEGACY_PROFILE_MODULE_CODES);

function removeLegacyProfileModuleCodes(moduleCodes) {
  if (!Array.isArray(moduleCodes)) return [];
  return Array.from(new Set(moduleCodes
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter(code => !LEGACY_PROFILE_MODULE_CODE_SET.has(code))));
}

function repairLegacyModuleData(data) {
  let changed = false;
  const profiles = Array.isArray(data?.profiles)
    ? data.profiles.map(profile => {
        const before = Array.isArray(profile.enabledModules) ? profile.enabledModules : [];
        const after = removeLegacyProfileModuleCodes(before);
        if (after.length !== before.length || after.some((code, index) => code !== before[index])) {
          changed = true;
          return { ...profile, enabledModules: after };
        }
        return profile;
      })
    : [];

  return {
    changed,
    data: changed ? { ...data, profiles } : data
  };
}

module.exports = {
  LEGACY_PROFILE_MODULE_CODES,
  LEGACY_PROFILE_MODULE_CODE_SET,
  removeLegacyProfileModuleCodes,
  repairLegacyModuleData
};
