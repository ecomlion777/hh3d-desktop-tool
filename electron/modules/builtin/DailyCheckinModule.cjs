const {
  extractWordPressRestNonce,
  looksLikeLoginPage
} = require('../helpers/wordpressNonce.cjs');

const CHECKIN_PAGE_PATH = '/diem-danh';
const CHECKIN_API_PATH = '/wp-json/hh3d/v1/action';
const CHECKIN_ACTION = 'daily_check_in';
const ALREADY_DONE_PATTERN = /(?:đã|da).*?(?:điểm\s*danh|diem\s*danh)|(?:điểm\s*danh|diem\s*danh).*?(?:rồi|roi)|already.*?(?:check|attendance)/i;
const LOGIN_REQUIRED_PATTERN = /(?:đăng\s*nhập|dang\s*nhap|login|required authentication|unauthorized|chưa đăng nhập|chua dang nhap)/i;
const NONCE_ERROR_PATTERN = /(?:nonce|security|rest[_ -]?nonce).*(?:invalid|expired|không hợp lệ|het han|hết hạn|sai)|(?:invalid|expired|không hợp lệ).*(?:nonce|security)/i;

function createCheckinError(code, message) {
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
    ?? '';
  if (typeof candidate === 'string') return candidate.trim();
  if (candidate === null || candidate === undefined) return '';
  try { return JSON.stringify(candidate); } catch { return String(candidate); }
}

function getStreak(payload) {
  const value = payload?.streak ?? payload?.data?.streak ?? payload?.data?.current_streak;
  const streak = Number(value);
  return Number.isFinite(streak) && streak >= 0 ? streak : undefined;
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

function isSuccessfulPayload(response, payload, message) {
  return Boolean(response.ok && payload && payload.success === true)
    || ALREADY_DONE_PATTERN.test(message);
}

async function fetchNonce(context, attempt) {
  const candidates = [
    buildCacheBustedPath(CHECKIN_PAGE_PATH, attempt),
    buildCacheBustedPath('/', attempt)
  ];

  for (const relativePath of candidates) {
    const url = context.buildWebsiteUrl(relativePath);
    const { response } = await context.httpClient.fetch(context.profile, url, {
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
      throw createCheckinError(
        'WORKER_LOGIN_REQUIRED',
        'Profile chưa đăng nhập hoặc session website đã hết hạn.'
      );
    }
    if (!response.ok) {
      throw createCheckinError(
        'DIEM_DANH_PAGE_HTTP_ERROR',
        `Không tải được trang Điểm Danh. HTTP ${response.status}.`
      );
    }

    const nonce = extractWordPressRestNonce(html);
    if (nonce) return nonce;
  }

  throw createCheckinError(
    'DIEM_DANH_NONCE_NOT_FOUND',
    'Không tìm thấy WordPress REST nonce trong trang Điểm Danh hoặc trang chủ.'
  );
}

async function postCheckin(context, nonce) {
  const apiUrl = context.buildWebsiteUrl(CHECKIN_API_PATH);
  const pageUrl = context.buildWebsiteUrl(CHECKIN_PAGE_PATH);
  const baseUrl = new URL(context.websiteBaseUrl);

  const { response, durationMs } = await context.httpClient.fetch(context.profile, apiUrl, {
    method: 'POST',
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'X-WP-Nonce': nonce,
      'X-Requested-With': 'XMLHttpRequest',
      Origin: baseUrl.origin,
      Referer: pageUrl
    },
    body: JSON.stringify({ action: CHECKIN_ACTION })
  });

  const { text, payload } = await readResponsePayload(response);
  if (looksLikeLoginPage(text, response.url)) {
    throw createCheckinError(
      'WORKER_LOGIN_REQUIRED',
      'Profile chưa đăng nhập hoặc session website đã hết hạn.'
    );
  }

  const message = getMessage(payload) || `HTTP ${response.status}`;
  if (response.status === 401 || LOGIN_REQUIRED_PATTERN.test(message)) {
    throw createCheckinError('WORKER_LOGIN_REQUIRED', message);
  }

  return {
    response,
    durationMs,
    payload,
    text,
    message,
    nonceRejected: response.status === 403 || NONCE_ERROR_PATTERN.test(message)
  };
}

async function runDailyCheckin(context) {
  let lastResult;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nonce = await fetchNonce(context, attempt);
    const result = await postCheckin(context, nonce);
    lastResult = result;

    if (isSuccessfulPayload(result.response, result.payload, result.message)) {
      const alreadyDone = ALREADY_DONE_PATTERN.test(result.message);
      const streak = getStreak(result.payload);
      const streakText = streak !== undefined ? ` (${streak} ngày)` : '';
      return {
        outcome: alreadyDone ? 'already_done' : 'success',
        summary: `Điểm Danh: ${result.message}${streakText}`,
        httpStatus: result.response.status,
        durationMs: result.durationMs,
        data: {
          alreadyDone,
          streak,
          message: result.message,
          action: CHECKIN_ACTION
        }
      };
    }

    if (result.nonceRejected && attempt === 0) continue;

    if (!result.payload && result.response.ok) {
      throw createCheckinError(
        'DIEM_DANH_INVALID_RESPONSE',
        'Máy chủ trả về phản hồi không phải JSON hợp lệ.'
      );
    }

    throw createCheckinError(
      result.nonceRejected ? 'DIEM_DANH_NONCE_REJECTED' : 'DIEM_DANH_FAILED',
      result.message || `HTTP ${result.response.status}`
    );
  }

  throw createCheckinError(
    'DIEM_DANH_NONCE_REJECTED',
    lastResult?.message || 'REST nonce bị từ chối sau khi tải lại.'
  );
}

module.exports = runDailyCheckin;
module.exports.extractWordPressRestNonce = extractWordPressRestNonce;
module.exports.looksLikeLoginPage = looksLikeLoginPage;
