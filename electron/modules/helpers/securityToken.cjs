/**
 * Extract HH3D security token values from server-rendered HTML without
 * executing remote scripts.
 *
 * Real HH3D pages commonly expose the value as `hh3dData.securityToken`
 * (camelCase), while some older pages/forms use `security_token`.
 */

const SECURITY_TOKEN_PATTERNS = Object.freeze([
  // Current HH3D page data: { "securityToken": "..." }
  /["']securityToken["']\s*:\s*["']([^"'\s<>]{6,512})["']/i,
  /\bsecurityToken\b\s*[:=]\s*["']([^"'\s<>]{6,512})["']/i,

  // Legacy snake_case variants.
  /\bsecurity_token\b\s*[:=]\s*["']([^"'\s<>]{6,512})["']/i,
  /["']security_token["']\s*:\s*["']([^"'\s<>]{6,512})["']/i,
  /name=["']security_token["'][^>]{0,800}?value=["']([^"']{6,512})["']/i,
  /value=["']([^"']{6,512})["'][^>]{0,800}?name=["']security_token["']/i,
  /data-security-token=["']([^"']{6,512})["']/i,
  /data-security_token=["']([^"']{6,512})["']/i
]);

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeEmbeddedJson(value) {
  return String(value || '')
    .replace(/\\u0022/gi, '"')
    .replace(/\\u0027/gi, "'")
    .replace(/\\x22/gi, '"')
    .replace(/\\x27/gi, "'")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function sanitizeToken(value) {
  const token = String(value || '').trim();
  if (token.length < 6 || token.length > 512) return null;
  if (/[\s<>]/.test(token)) return null;
  return token;
}

function extractSecurityToken(html) {
  const source = normalizeEmbeddedJson(decodeHtmlEntities(html));

  for (const pattern of SECURITY_TOKEN_PATTERNS) {
    const match = pattern.exec(source);
    const token = sanitizeToken(match?.[1]);
    if (token) return token;
  }

  return null;
}

module.exports = {
  extractSecurityToken
};
