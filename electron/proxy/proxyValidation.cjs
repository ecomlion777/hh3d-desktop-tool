/**
 * HH3D Desktop Tool - Proxy validation and public-data sanitization
 */

const SUPPORTED_PROTOCOLS = new Set(['http', 'https', 'socks4', 'socks5']);

function proxyError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function validateProxyId(proxyId) {
  if (typeof proxyId !== 'string' || !proxyId.trim()) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Proxy ID không hợp lệ.');
  }
  return proxyId.trim();
}


function normalizeIdList(values, label = 'ID') {
  if (!Array.isArray(values)) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', `${label} phải là một mảng.`);
  }

  const normalized = Array.from(new Set(values.map(value => String(value || '').trim())));
  if (normalized.some(value => !value)) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', `${label} chứa giá trị rỗng.`);
  }
  return normalized;
}

function normalizeProtocol(protocol) {
  const normalized = String(protocol || 'http').trim().toLowerCase();
  if (!SUPPORTED_PROTOCOLS.has(normalized)) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', `Protocol "${protocol}" không được hỗ trợ.`);
  }
  return normalized;
}

function normalizeHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Host proxy không được để trống.');
  }

  if (
    normalized.includes('://') ||
    normalized.includes('/') ||
    normalized.includes('@') ||
    /\s/.test(normalized)
  ) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Host proxy chứa ký tự không hợp lệ.');
  }

  // IPv6 is intentionally rejected in Phase 05A to avoid ambiguous host:port parsing.
  if (normalized.includes(':')) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'IPv6 chưa được hỗ trợ trong Phase 05A.');
  }

  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const hostname = /^(?=.{1,253}$)(localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)$/i;

  if (!ipv4.test(normalized) && !hostname.test(normalized)) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Host proxy không phải IPv4 hoặc hostname hợp lệ.');
  }

  return normalized;
}

function normalizePort(port) {
  const normalized = Number(port);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 65535) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Port proxy phải là số nguyên từ 1 đến 65535.');
  }
  return normalized;
}

function normalizeName(name) {
  const normalized = String(name || '').trim();
  if (!normalized) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Tên proxy không được để trống.');
  }
  if (normalized.length > 120) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Tên proxy không được dài quá 120 ký tự.');
  }
  return normalized;
}

function validateProxyInput(input, existingProxies = [], options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', 'Dữ liệu proxy không hợp lệ.');
  }

  const id = input.id ? validateProxyId(input.id) : undefined;
  const name = normalizeName(input.name);
  const protocol = normalizeProtocol(input.protocol);
  const host = normalizeHost(input.host);
  const port = normalizePort(input.port);
  const enabled = input.enabled !== false;
  const authRequired = Boolean(input.authRequired);
  const notes = String(input.notes || '').trim().slice(0, 2000);

  const normalizedName = name.toLocaleLowerCase('vi-VN');
  const duplicateName = existingProxies.some(item => (
    String(item.name || '').trim().toLocaleLowerCase('vi-VN') === normalizedName &&
    item.id !== options.ignoreId
  ));
  if (duplicateName) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', `Tên proxy "${name}" đã tồn tại.`);
  }

  if (id && !options.isUpdate && existingProxies.some(item => item.id === id)) {
    throw proxyError('PROXY_INVALID_CONFIGURATION', `Proxy ID "${id}" đã tồn tại.`);
  }

  return {
    id,
    name,
    protocol,
    host,
    port,
    enabled,
    authRequired,
    notes
  };
}

function maskUsername(username) {
  if (!username) return undefined;
  const value = String(username);
  if (value.length <= 1) return '*';
  return `${value[0]}${'*'.repeat(Math.min(5, value.length - 1))}`;
}

function sanitizeProxyPublic(proxy, extras = {}) {
  if (!proxy) return null;
  return {
    id: proxy.id,
    name: proxy.name,
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    enabled: proxy.enabled !== false,
    authRequired: Boolean(proxy.authRequired),
    hasCredentials: Boolean(proxy.hasCredentials),
    maskedUsername: extras.maskedUsername,
    notes: proxy.notes || '',
    createdAt: proxy.createdAt,
    updatedAt: proxy.updatedAt,
    assignedProfileCount: extras.assignedProfileCount || 0,
    testState: extras.testState || 'not_tested',
    publicIp: extras.publicIp,
    latencyMs: extras.latencyMs,
    resolvedRule: extras.resolvedRule,
    lastCheckedAt: extras.lastCheckedAt,
    testError: extras.testError,
    credentialState: extras.credentialState || (proxy.hasCredentials ? 'saved' : 'none'),
    // Compatibility fields used by existing selectors.
    ipPort: `${proxy.host}:${proxy.port}`,
    assignedProfilesCount: extras.assignedProfileCount || 0,
    status: extras.testState === 'online' ? 'online' :
      extras.testState === 'offline' || extras.testState === 'auth_error' || extras.testState === 'configuration_error' ? 'offline' :
      extras.testState === 'testing' ? 'testing' : 'unknown',
    currentIp: extras.publicIp || '',
    expectedIp: '',
    ping: extras.latencyMs || 0,
    lastChecked: extras.lastCheckedAt || 'Chưa test'
  };
}

module.exports = {
  SUPPORTED_PROTOCOLS,
  proxyError,
  validateProxyId,
  normalizeIdList,
  normalizeProtocol,
  normalizeHost,
  normalizePort,
  validateProxyInput,
  maskUsername,
  sanitizeProxyPublic
};
