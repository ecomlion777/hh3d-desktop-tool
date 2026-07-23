/**
 * HH3D Desktop Tool - Mini Browser Validation & Utility Helpers
 */

const crypto = require('crypto');
const {
  PARTITION_PREFIX,
  ALLOWED_HOSTS
} = require('./browserConstants.cjs');

/**
 * Validates profileId presence and type.
 */
function validateProfileId(profileId) {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('profileId không hợp lệ hoặc không phải chuỗi văn bản.');
  }

  const trimmed = profileId.trim();

  if (!trimmed) {
    throw new Error('profileId không được để trống.');
  }

  return trimmed;
}

/**
 * Sanitizes profile.id for an Electron persistent partition name.
 */
function sanitizeProfileId(profileId) {
  const normalized = validateProfileId(profileId);
  const safeId = normalized.replace(/[^a-zA-Z0-9_-]/g, '-');

  return safeId || 'default';
}

/**
 * Returns a deterministic collision-resistant partition for a profile.
 */
function getPartitionForProfile(profileId) {
  const normalizedId = validateProfileId(profileId);
  const safeSlug = sanitizeProfileId(normalizedId).slice(0, 48);

  const idHash = crypto
    .createHash('sha256')
    .update(normalizedId, 'utf8')
    .digest('hex')
    .slice(0, 12);

  return `${PARTITION_PREFIX}${safeSlug}-${idHash}`;
}

/**
 * Allows HTTPS navigation to configured HH3D domains and their subdomains.
 */
function isAllowedUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    return ALLOWED_HOSTS.some(
      allowedHost =>
        hostname === allowedHost ||
        hostname.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
}

module.exports = {
  validateProfileId,
  sanitizeProfileId,
  getPartitionForProfile,
  isAllowedUrl
};
