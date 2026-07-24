/**
 * HH3D Desktop Tool - Dynamic website/domain validation.
 */

const DEFAULT_WEBSITE_BASE_URL = 'https://hoathinh3d.co/';
const DEFAULT_WEBSITE_ALLOWED_HOSTS = Object.freeze([
  'hoathinh3d.co',
  'hoathinh3d.com',
  'hoathinh3d.st'
]);

function websiteConfigError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function normalizeHostname(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw websiteConfigError('WEBSITE_DOMAIN_REQUIRED', 'Tên miền website không được để trống.');
  }

  let parsed;
  try {
    parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    throw websiteConfigError('WEBSITE_DOMAIN_INVALID', `Tên miền không hợp lệ: "${raw}".`);
  }

  if (parsed.protocol !== 'https:') {
    throw websiteConfigError('WEBSITE_HTTPS_REQUIRED', 'Tên miền website bắt buộc phải sử dụng HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw websiteConfigError('WEBSITE_CREDENTIALS_NOT_ALLOWED', 'Không được đặt username/password trong URL website.');
  }
  if (parsed.port && parsed.port !== '443') {
    throw websiteConfigError('WEBSITE_PORT_NOT_ALLOWED', 'Phase 06B chỉ hỗ trợ cổng HTTPS mặc định 443.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!hostname || hostname.length > 253) {
    throw websiteConfigError('WEBSITE_DOMAIN_INVALID', 'Hostname website không hợp lệ.');
  }

  const labels = hostname.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    throw websiteConfigError('WEBSITE_DOMAIN_INVALID', `Hostname không hợp lệ: "${hostname}".`);
  }

  return hostname;
}

function normalizeWebsiteBaseUrl(value) {
  const hostname = normalizeHostname(value || DEFAULT_WEBSITE_BASE_URL);
  return `https://${hostname}/`;
}

function normalizeWebsiteAllowedHosts(value, primaryBaseUrl = DEFAULT_WEBSITE_BASE_URL) {
  const primaryHost = new URL(normalizeWebsiteBaseUrl(primaryBaseUrl)).hostname;
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\n,;\s]+/g)
      .filter(Boolean);

  const hasExplicitHosts = rawItems.length > 0;
  const hosts = [];
  const seen = new Set();
  const addHost = input => {
    const host = normalizeHostname(input);
    if (!seen.has(host)) {
      seen.add(host);
      hosts.push(host);
    }
  };

  addHost(primaryHost);
  for (const item of rawItems) {
    addHost(item);
    if (hosts.length >= 20) break;
  }

  if (!hasExplicitHosts) {
    for (const fallback of DEFAULT_WEBSITE_ALLOWED_HOSTS) {
      addHost(fallback);
    }
  }

  return hosts;
}

function normalizeWebsiteSettings(input = {}, current = {}) {
  const baseUrl = normalizeWebsiteBaseUrl(
    input.websiteBaseUrl ?? current.websiteBaseUrl ?? DEFAULT_WEBSITE_BASE_URL
  );
  const allowedHosts = normalizeWebsiteAllowedHosts(
    input.websiteAllowedHosts ?? current.websiteAllowedHosts ?? DEFAULT_WEBSITE_ALLOWED_HOSTS,
    baseUrl
  );

  return {
    websiteBaseUrl: baseUrl,
    websiteAllowedHosts: allowedHosts
  };
}

function isAllowedWebsiteUrl(urlString, allowedHosts = DEFAULT_WEBSITE_ALLOWED_HOSTS) {
  if (!urlString || typeof urlString !== 'string') return false;

  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    const rawHosts = Array.isArray(allowedHosts)
      ? allowedHosts
      : String(allowedHosts || '').split(/[\n,;\s]+/g).filter(Boolean);
    const normalizedHosts = Array.from(new Set(rawHosts.map(normalizeHostname)));
    return normalizedHosts.some(
      allowed => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

function buildWebsiteUrl(baseUrl, relativePath = '/') {
  const normalizedBase = normalizeWebsiteBaseUrl(baseUrl);
  const pathValue = String(relativePath || '/').trim();
  const result = new URL(pathValue || '/', normalizedBase);
  if (!isAllowedWebsiteUrl(result.toString(), [new URL(normalizedBase).hostname])) {
    throw websiteConfigError('WEBSITE_PATH_INVALID', 'Đường dẫn website tạo URL ngoài tên miền đã cấu hình.');
  }
  return result.toString();
}

module.exports = {
  DEFAULT_WEBSITE_BASE_URL,
  DEFAULT_WEBSITE_ALLOWED_HOSTS,
  websiteConfigError,
  normalizeHostname,
  normalizeWebsiteBaseUrl,
  normalizeWebsiteAllowedHosts,
  normalizeWebsiteSettings,
  isAllowedWebsiteUrl,
  buildWebsiteUrl
};
