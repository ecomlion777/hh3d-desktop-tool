/**
 * Extract a WordPress REST nonce from HH3D HTML without executing page scripts.
 */

const NONCE_PATTERNS = Object.freeze([
  /customRestNonce\s*=\s*['"]([A-Za-z0-9_-]{6,128})['"]/i,
  /['"]restNonce['"]\s*:\s*['"]([A-Za-z0-9_-]{6,128})['"]/i,
  /wpApiSettings\s*=\s*\{[\s\S]{0,2500}?['"]nonce['"]\s*:\s*['"]([A-Za-z0-9_-]{6,128})['"]/i,
  /['"]nonce['"]\s*:\s*['"]([A-Za-z0-9_-]{6,128})['"]/i,
  /name=['"]_wpnonce['"][^>]*value=['"]([A-Za-z0-9_-]{6,128})['"]/i,
  /value=['"]([A-Za-z0-9_-]{6,128})['"][^>]*name=['"]_wpnonce['"]/i
]);

function extractWordPressRestNonce(html) {
  const source = String(html || '');
  for (const pattern of NONCE_PATTERNS) {
    const match = pattern.exec(source);
    if (match?.[1]) return match[1];
  }
  return null;
}

function looksLikeLoginPage(html, finalUrl = '') {
  const source = String(html || '');
  const url = String(finalUrl || '').toLowerCase();
  if (/\/(wp-login\.php|dang-nhap|login)(?:[/?#]|$)/i.test(url)) return true;
  return [
    /id=['"]loginform['"]/i,
    /name=['"]user_login['"]/i,
    /name=['"]log['"][^>]*type=['"]text['"]/i,
    /<body[^>]+class=['"][^'"]*\blogin\b/i
  ].some(pattern => pattern.test(source));
}

module.exports = {
  extractWordPressRestNonce,
  looksLikeLoginPage
};
