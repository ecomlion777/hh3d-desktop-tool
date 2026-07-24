const {
  extractWordPressRestNonce,
  looksLikeLoginPage
} = require('../helpers/wordpressNonce.cjs');
const { extractSecurityToken } = require('../helpers/securityToken.cjs');

const WORSHIP_PAGE_PATH = '/danh-sach-thanh-vien-tong-mon';
const WORSHIP_API_PATH = '/wp-json/tong-mon/v1/te-le-tong-mon';
const WORSHIP_ACTION = 'te_le_tong_mon';

const ALREADY_DONE_PATTERN = /(?:đã|da).*?(?:tế\s*lễ|te\s*le)|(?:tế\s*lễ|te\s*le).*?(?:rồi|roi|hôm\s*nay|hom\s*nay)|already.*?(?:worship|clan)|today.*?(?:worship|clan)/i;
const LOGIN_REQUIRED_PATTERN = /(?:đăng\s*nhập|dang\s*nhap|login|required authentication|unauthorized|chưa đăng nhập|chua dang nhap)/i;
const CONTEXT_REJECTED_PATTERN = /(?:nonce|security[_ -]?token|rest[_ -]?nonce).*(?:invalid|expired|không hợp lệ|khong hop le|hết hạn|het han|sai|missing|thiếu|thieu)|(?:invalid|expired|không hợp lệ|khong hop le|missing).*(?:nonce|security[_ -]?token)/i;
const NOT_IN_CLAN_PATTERN = /(?:chưa|chua|không|khong).*?(?:tông\s*môn|tong\s*mon)|(?:not|no).*?(?:clan|guild)|(?:gia nhập|gia nhap).*?(?:tông\s*môn|tong\s*mon)/i;

function createWorshipError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function buildCacheBustedPath(path, attempt = 0) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}t=${Date.now()}${attempt ? `-${attempt}` : ''}`;
}

function getMessage(payload) {
  const candidate = payload?.message
    ?? payload?.data?.message
    ?? payload?.data?.error
    ?? payload?.error
    ?? payload?.data
    ?? '';

  if (typeof candidate === 'string') return candidate.trim();
  if (candidate === null || candidate === undefined) return '';
  try { return JSON.stringify(candidate); } catch { return String(candidate); }
}

function getContributionPoints(payload) {
  const value = payload?.cong_hien_points
    ?? payload?.data?.cong_hien_points
    ?? payload?.contribution_points
    ?? payload?.data?.contribution_points;
  const points = Number(value);
  return Number.isFinite(points) && points >= 0 ? points : undefined;
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text.trim()) return { text, payload: {} };
  try {
    return { text, payload: JSON.parse(text) };
  } catch {
    return { text, payload: null };
  }
}

async function loadWorshipContext(context, attempt) {
  const pageUrl = context.buildWebsiteUrl(buildCacheBustedPath(WORSHIP_PAGE_PATH, attempt));
  const { response } = await context.httpClient.fetch(context.profile, pageUrl, {
    method: 'GET',
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    headers: {
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache'
    }
  });

  const html = await response.text();
  if (response.status === 401 || response.status === 403 || looksLikeLoginPage(html, response.url)) {
    throw createWorshipError(
      'WORKER_LOGIN_REQUIRED',
      'Profile chưa đăng nhập hoặc session website đã hết hạn.'
    );
  }
  if (!response.ok) {
    throw createWorshipError(
      'TE_LE_PAGE_HTTP_ERROR',
      `Không tải được trang thành viên Tông Môn. HTTP ${response.status}.`
    );
  }

  let securityToken = extractSecurityToken(html);
  let nonce = extractWordPressRestNonce(html);

  // HH3D currently exposes the token as hh3dData.securityToken (camelCase)
  // on some templates. It may also be present only on the homepage after a
  // theme/domain change, so fill whichever context value is missing from home.
  if (!securityToken || !nonce) {
    const homeUrl = context.buildWebsiteUrl(buildCacheBustedPath('/', attempt));
    const { response: homeResponse } = await context.httpClient.fetch(context.profile, homeUrl, {
      method: 'GET',
      signal: context.signal,
      timeoutMs: context.timeoutMs,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });
    const homeHtml = await homeResponse.text();
    if (homeResponse.status === 401 || homeResponse.status === 403 || looksLikeLoginPage(homeHtml, homeResponse.url)) {
      throw createWorshipError(
        'WORKER_LOGIN_REQUIRED',
        'Profile chưa đăng nhập hoặc session website đã hết hạn.'
      );
    }
    if (homeResponse.ok) {
      if (!securityToken) securityToken = extractSecurityToken(homeHtml);
      if (!nonce) nonce = extractWordPressRestNonce(homeHtml);
    }
  }

  if (!securityToken) {
    throw createWorshipError(
      'TE_LE_SECURITY_TOKEN_NOT_FOUND',
      'Không tìm thấy securityToken/security_token trong ngữ cảnh website Tông Môn.'
    );
  }

  if (!nonce) {
    throw createWorshipError(
      'TE_LE_NONCE_NOT_FOUND',
      'Không tìm thấy WordPress REST nonce cho thao tác Tế Lễ.'
    );
  }

  return { nonce, securityToken };
}

async function postWorship(context, authContext) {
  const apiUrl = context.buildWebsiteUrl(WORSHIP_API_PATH);
  const pageUrl = context.buildWebsiteUrl(WORSHIP_PAGE_PATH);
  const baseUrl = new URL(context.websiteBaseUrl);

  const { response, durationMs } = await context.httpClient.fetch(context.profile, apiUrl, {
    method: 'POST',
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'X-WP-Nonce': authContext.nonce,
      'X-Requested-With': 'XMLHttpRequest',
      security_token: authContext.securityToken,
      Origin: baseUrl.origin,
      Referer: pageUrl
    },
    body: JSON.stringify({
      action: WORSHIP_ACTION,
      security_token: authContext.securityToken
    })
  });

  const { text, payload } = await readResponsePayload(response);
  if (looksLikeLoginPage(text, response.url)) {
    throw createWorshipError(
      'WORKER_LOGIN_REQUIRED',
      'Profile chưa đăng nhập hoặc session website đã hết hạn.'
    );
  }

  const message = getMessage(payload) || `HTTP ${response.status}`;
  if (response.status === 401 || LOGIN_REQUIRED_PATTERN.test(message)) {
    throw createWorshipError('WORKER_LOGIN_REQUIRED', message);
  }

  return {
    response,
    durationMs,
    payload,
    text,
    message,
    contextRejected: response.status === 403 || CONTEXT_REJECTED_PATTERN.test(message)
  };
}

async function runClanWorship(context) {
  let lastResult;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const authContext = await loadWorshipContext(context, attempt);
    const result = await postWorship(context, authContext);
    lastResult = result;

    const alreadyDone = ALREADY_DONE_PATTERN.test(result.message);
    const successful = Boolean(result.response.ok && result.payload && result.payload.success === true)
      || alreadyDone;

    if (successful) {
      const contributionPoints = getContributionPoints(result.payload);
      const contributionText = contributionPoints !== undefined
        ? ` (${contributionPoints} cống hiến)`
        : '';

      return {
        outcome: alreadyDone ? 'already_done' : 'success',
        summary: `Tế Lễ: ${result.message}${contributionText}`,
        httpStatus: result.response.status,
        durationMs: result.durationMs,
        data: {
          alreadyDone,
          contributionPoints,
          message: result.message,
          action: WORSHIP_ACTION
        }
      };
    }

    if (result.contextRejected && attempt === 0) continue;

    if (!result.payload && result.response.ok) {
      throw createWorshipError(
        'TE_LE_INVALID_RESPONSE',
        'Máy chủ trả về phản hồi không phải JSON hợp lệ.'
      );
    }

    if (NOT_IN_CLAN_PATTERN.test(result.message)) {
      throw createWorshipError('TE_LE_NOT_IN_CLAN', result.message);
    }

    throw createWorshipError(
      result.contextRejected ? 'TE_LE_CONTEXT_REJECTED' : 'TE_LE_FAILED',
      result.message || `HTTP ${result.response.status}`
    );
  }

  throw createWorshipError(
    'TE_LE_CONTEXT_REJECTED',
    lastResult?.message || 'Nonce hoặc security_token bị từ chối sau khi tải lại.'
  );
}

module.exports = runClanWorship;
module.exports.extractSecurityToken = extractSecurityToken;
module.exports.extractWordPressRestNonce = extractWordPressRestNonce;
