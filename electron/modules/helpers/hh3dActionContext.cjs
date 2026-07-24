/**
 * Parse HH3D page action mappings and action-specific security values without
 * executing remote scripts.
 */

const ACTION_KEY_MAP = Object.freeze({
  load_quiz_data: 'vdLoad',
  save_quiz_result: 'vdSave',
  get_next_time_pl: 'plTimer',
  open_chest_pl: 'plOpen',
  claim_bonus_reward: 'plClaim'
});

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

function normalizeEmbeddedSource(value) {
  return decodeHtmlEntities(value)
    .replace(/\\u0022/gi, '"')
    .replace(/\\u0027/gi, "'")
    .replace(/\\x22/gi, '"')
    .replace(/\\x27/gi, "'")
    .replace(/\\\"/g, '"')
    .replace(/\\'/g, "'");
}

function safeActionValue(value) {
  const result = String(value || '').trim();
  if (!result || result.length > 256 || /[\s<>]/.test(result)) return null;
  return result;
}

function parseJsonObjectCandidate(source) {
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function decodeEncryptedActionMap(html) {
  const source = normalizeEmbeddedSource(html);
  const match = source.match(/var\s+k\s*=\s*["']([^"']+)["']\s*,\s*d\s*=\s*["']([^"']+)["']/i);
  if (!match) return {};

  try {
    const key = match[1];
    const normalized = match[2]
      .replace(/\\/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\s/g, '');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const bytes = Buffer.from(padded, 'base64');
    let decoded = '';
    for (let index = 0; index < bytes.length; index += 1) {
      decoded += String.fromCharCode(bytes[index] ^ key.charCodeAt(index % key.length));
    }
    const parsed = parseJsonObjectCandidate(decoded);
    return parsed || {};
  } catch {
    return {};
  }
}

function extractDirectActionMap(html) {
  const source = normalizeEmbeddedSource(html);
  const result = {};

  // Direct JSON fields are the safest fallback when the encrypted map is not
  // present or the frontend temporarily renders a plain hh3dData object.
  for (const key of Object.values(ACTION_KEY_MAP)) {
    const pattern = new RegExp(`["']${key}["']\\s*:\\s*["']([^"']+)["']`, 'i');
    const value = safeActionValue(pattern.exec(source)?.[1]);
    if (value) result[key] = value;
  }

  const hh3dDataMatch = source.match(/var\s+hh3dData\s*=\s*(\{[\s\S]{0,12000}?\})\s*;/i);
  const directObject = hh3dDataMatch ? parseJsonObjectCandidate(hh3dDataMatch[1]) : null;
  if (directObject?.act && typeof directObject.act === 'object') {
    Object.assign(result, directObject.act);
  }

  return result;
}

function extractLegacySecurity(html, actionName) {
  const source = normalizeEmbeddedSource(html);
  const escaped = String(actionName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`action\\s*:\\s*["']${escaped}["'][\\s\\S]{0,1200}?security\\s*:\\s*["']([^"']+)["']`, 'i'),
    new RegExp(`security\\s*:\\s*["']([^"']+)["'][\\s\\S]{0,1200}?action\\s*:\\s*["']${escaped}["']`, 'i'),
    new RegExp(`["']action["']\\s*:\\s*["']${escaped}["'][\\s\\S]{0,1200}?["']security["']\\s*:\\s*["']([^"']+)["']`, 'i')
  ];

  for (const pattern of patterns) {
    const value = safeActionValue(pattern.exec(source)?.[1]);
    if (value) return value;
  }
  return null;
}

function parseHh3dActionContext(html) {
  const encrypted = decodeEncryptedActionMap(html);
  const direct = extractDirectActionMap(html);
  const actionMap = { ...direct, ...encrypted };
  const legacySecurity = {};

  for (const actionName of Object.keys(ACTION_KEY_MAP)) {
    const value = extractLegacySecurity(html, actionName);
    if (value) legacySecurity[actionName] = value;
  }

  return { actionMap, legacySecurity };
}

function mergeActionContexts(...contexts) {
  const result = { actionMap: {}, legacySecurity: {} };
  for (const context of contexts) {
    if (!context || typeof context !== 'object') continue;
    Object.assign(result.actionMap, context.actionMap || {});
    Object.assign(result.legacySecurity, context.legacySecurity || {});
  }
  return result;
}

function resolveHh3dAction(actionName, actionMap = {}) {
  const key = ACTION_KEY_MAP[actionName];
  return safeActionValue(key ? actionMap[key] : null) || actionName;
}

module.exports = {
  ACTION_KEY_MAP,
  decodeEncryptedActionMap,
  extractDirectActionMap,
  extractLegacySecurity,
  parseHh3dActionContext,
  mergeActionContexts,
  resolveHh3dAction
};
