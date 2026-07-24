const { looksLikeLoginPage } = require('../helpers/wordpressNonce.cjs');
const { extractSecurityToken } = require('../helpers/securityToken.cjs');
const {
  parseHh3dActionContext,
  mergeActionContexts,
  resolveHh3dAction
} = require('../helpers/hh3dActionContext.cjs');

const WELFARE_PAGE_PATH = '/phuc-loi-duong';
const AJAX_PATH = '/wp-content/themes/halimmovies-child/hh3d-ajax.php';
const TIMER_ACTION = 'get_next_time_pl';
const OPEN_ACTION = 'open_chest_pl';
const BONUS_ACTION = 'claim_bonus_reward';
const MAX_CHESTS = 4;

const LOGIN_REQUIRED_PATTERN = /(?:đăng\s*nhập|dang\s*nhap|login|required authentication|unauthorized|chưa đăng nhập|chua dang nhap)/i;
const CONTEXT_REJECTED_PATTERN = /(?:security(?:_token)?|token|nonce|action).*(?:invalid|expired|không hợp lệ|khong hop le|hết hạn|het han|sai|missing|thiếu|thieu)|(?:invalid|expired|không hợp lệ|khong hop le|missing).*(?:security|token|nonce|action)/i;
const ALREADY_CLAIMED_PATTERN = /(?:đã|da).*?(?:nhận|nhan).*?(?:trước|truoc|rồi|roi)|phần thưởng.*?đã.*?nhận|already.*?(?:claimed|received)/i;
const NOT_ELIGIBLE_PATTERN = /(?:chưa|chua).*?(?:đủ|du).*?(?:yêu cầu|yeu cau)|not.*?eligible|requirements?.*?not.*?met/i;
const COMPLETE_PATTERN = /(?:hoàn thành|hoan thanh).*?(?:phúc lợi|phuc loi)|(?:phúc lợi|phuc loi).*?(?:hoàn thành|hoan thanh)/i;

function createWelfareError(code, message) {
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

function normalizeChestLevel(payload) {
  const value = payload?.data?.chest_level
    ?? payload?.data?.chestLevel
    ?? payload?.chest_level
    ?? payload?.chestLevel
    ?? 0;
  const level = Number.parseInt(value, 10);
  return Number.isFinite(level) ? Math.min(Math.max(level, 0), MAX_CHESTS) : 0;
}

function normalizeWaitTime(payload) {
  const value = payload?.data?.time
    ?? payload?.data?.time_remaining
    ?? payload?.data?.timeRemaining
    ?? payload?.time
    ?? payload?.time_remaining
    ?? '00:00';
  return String(value ?? '00:00').trim() || '00:00';
}

function parseCountdownMs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value * 1000 : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^(?:0+:)?0{1,2}:0{1,2}$/.test(raw) || /^0+$/.test(raw)) return 0;
  const clock = raw.match(/^(?:(\d+)\s*:)?(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (clock) {
    return (Number(clock[1] || 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3])) * 1000;
  }
  const shortClock = raw.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (shortClock) return (Number(shortClock[1]) * 60 + Number(shortClock[2])) * 1000;
  let seconds = 0;
  let matched = false;
  for (const [pattern, multiplier] of [
    [/([\d.]+)\s*(?:ngày|day)/i, 86400],
    [/([\d.]+)\s*(?:giờ|hour|hr)/i, 3600],
    [/([\d.]+)\s*(?:phút|minute|min)/i, 60],
    [/([\d.]+)\s*(?:giây|second|sec)/i, 1]
  ]) {
    const match = raw.match(pattern);
    if (match) {
      seconds += Number(match[1]) * multiplier;
      matched = true;
    }
  }
  return matched && Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
}

function isReadyTime(value) {
  return parseCountdownMs(value) === 0;
}

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
}

function isLastTwoDaysInVietnam(date = new Date()) {
  const { year, month, day } = getVietnamDateParts(date);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= daysInMonth - 1;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new Error('MODULE_CANCELLED'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason || new Error('MODULE_CANCELLED'));
    }, { once: true });
  });
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return { text, payload: {} };
  try { return { text, payload: JSON.parse(text) }; }
  catch { return { text, payload: null }; }
}

async function loadPage(context, relativePath) {
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
    throw createWelfareError('WORKER_LOGIN_REQUIRED', 'Profile chưa đăng nhập hoặc session website đã hết hạn.');
  }
  if (!response.ok) {
    throw createWelfareError('PHUC_LOI_PAGE_HTTP_ERROR', `Không tải được trang Phúc Lợi. HTTP ${response.status}.`);
  }
  return { html, response };
}

async function loadWelfareContext(context, attempt) {
  const page = await loadPage(context, buildCacheBustedPath(WELFARE_PAGE_PATH, attempt));
  let securityToken = extractSecurityToken(page.html);
  let actionContext = parseHh3dActionContext(page.html);

  // Domain/theme changes occasionally move hh3dData to the homepage. Merge the
  // homepage context only when the Phúc Lợi page is missing a required value.
  const hasActionContext = Object.keys(actionContext.actionMap).length > 0
    || Object.keys(actionContext.legacySecurity).length > 0;
  if (!securityToken || !hasActionContext) {
    const home = await loadPage(context, buildCacheBustedPath('/', attempt));
    if (!securityToken) securityToken = extractSecurityToken(home.html);
    actionContext = mergeActionContexts(actionContext, parseHh3dActionContext(home.html));
  }

  if (!securityToken) {
    throw createWelfareError(
      'PHUC_LOI_SECURITY_TOKEN_NOT_FOUND',
      'Không tìm thấy securityToken/security_token trong trang Phúc Lợi hoặc trang chủ.'
    );
  }

  return {
    securityToken,
    actionMap: actionContext.actionMap,
    legacySecurity: actionContext.legacySecurity,
    pageUrl: context.buildWebsiteUrl(WELFARE_PAGE_PATH)
  };
}

async function postAction(context, authContext, actionName, extra = {}) {
  const ajaxUrl = context.buildWebsiteUrl(AJAX_PATH);
  const baseUrl = new URL(context.websiteBaseUrl);
  const body = new URLSearchParams();
  body.set('action', resolveHh3dAction(actionName, authContext.actionMap));
  body.set('security_token', authContext.securityToken);
  const legacySecurity = authContext.legacySecurity?.[actionName];
  if (legacySecurity) body.set('security', legacySecurity);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }

  const { response, durationMs } = await context.httpClient.fetch(context.profile, ajaxUrl, {
    method: 'POST',
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Origin: baseUrl.origin,
      Referer: authContext.pageUrl
    },
    body: body.toString()
  });

  const { text, payload } = await readJsonResponse(response);
  if (looksLikeLoginPage(text, response.url)) {
    throw createWelfareError('WORKER_LOGIN_REQUIRED', 'Profile chưa đăng nhập hoặc session website đã hết hạn.');
  }
  const message = getMessage(payload) || `HTTP ${response.status}`;
  if (response.status === 401 || LOGIN_REQUIRED_PATTERN.test(message)) {
    throw createWelfareError('WORKER_LOGIN_REQUIRED', message);
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

function makeNextRunAt(waitTime) {
  const waitMs = parseCountdownMs(waitTime);
  return waitMs === null ? undefined : new Date(Date.now() + waitMs + 1000).toISOString();
}

async function claimMonthlyBonus(context, authContext) {
  const enabled = context.config?.claimMonthlyBonus !== false;
  if (!enabled || !isLastTwoDaysInVietnam()) {
    return { attempted: false, claimed: [], alreadyClaimed: [], notEligibleFrom: undefined };
  }

  const result = { attempted: true, claimed: [], alreadyClaimed: [], notEligibleFrom: undefined };
  for (let chestId = 1; chestId <= MAX_CHESTS; chestId += 1) {
    const response = await postAction(context, authContext, BONUS_ACTION, { chest_id: chestId });
    if (response.contextRejected) {
      return { ...result, contextRejected: true, message: response.message };
    }
    if (response.response.ok && response.payload?.success === true) {
      result.claimed.push(chestId);
    } else if (ALREADY_CLAIMED_PATTERN.test(response.message)) {
      result.alreadyClaimed.push(chestId);
    } else if (NOT_ELIGIBLE_PATTERN.test(response.message)) {
      result.notEligibleFrom = chestId;
      break;
    } else if (!response.payload && response.response.ok) {
      throw createWelfareError('PHUC_LOI_BONUS_INVALID_RESPONSE', 'Phản hồi nhận bonus không phải JSON hợp lệ.');
    } else {
      result.lastMessage = response.message;
    }
    if (chestId < MAX_CHESTS) await delay(150, context.signal);
  }
  return result;
}

function formatBonusSuffix(bonus) {
  if (!bonus?.attempted) return '';
  const totalDone = (bonus.claimed?.length || 0) + (bonus.alreadyClaimed?.length || 0);
  if (bonus.claimed?.length) return ` Bonus tháng: nhận ${bonus.claimed.length} mốc.`;
  if (totalDone >= MAX_CHESTS) return ' Bonus tháng: đã nhận đủ.';
  if (bonus.notEligibleFrom) return ` Bonus tháng: chưa đủ điều kiện từ mốc ${bonus.notEligibleFrom}.`;
  return '';
}

async function runWelfareHall(context) {
  let lastResult;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const authContext = await loadWelfareContext(context, attempt);
    const statusResult = await postAction(context, authContext, TIMER_ACTION);
    lastResult = statusResult;

    if (statusResult.contextRejected && attempt === 0) continue;
    if (!statusResult.payload && statusResult.response.ok) {
      throw createWelfareError('PHUC_LOI_INVALID_RESPONSE', 'Phản hồi trạng thái Phúc Lợi không phải JSON hợp lệ.');
    }
    if (!statusResult.response.ok || statusResult.payload?.success !== true) {
      throw createWelfareError(
        statusResult.contextRejected ? 'PHUC_LOI_CONTEXT_REJECTED' : 'PHUC_LOI_STATUS_FAILED',
        statusResult.message || `HTTP ${statusResult.response.status}`
      );
    }

    let chestLevel = normalizeChestLevel(statusResult.payload);
    let waitTime = normalizeWaitTime(statusResult.payload);
    let openedChestId;
    let finalDurationMs = statusResult.durationMs;

    if (chestLevel < MAX_CHESTS && isReadyTime(waitTime)) {
      openedChestId = chestLevel + 1;
      const openResult = await postAction(context, authContext, OPEN_ACTION, { chest_id: openedChestId });
      finalDurationMs += openResult.durationMs;
      if (openResult.contextRejected && attempt === 0) continue;
      if (!openResult.payload && openResult.response.ok) {
        throw createWelfareError('PHUC_LOI_OPEN_INVALID_RESPONSE', 'Phản hồi mở rương không phải JSON hợp lệ.');
      }
      if (!openResult.response.ok || openResult.payload?.success !== true) {
        if (ALREADY_CLAIMED_PATTERN.test(openResult.message)) {
          chestLevel = Math.max(chestLevel, openedChestId);
        } else {
          throw createWelfareError(
            openResult.contextRejected ? 'PHUC_LOI_CONTEXT_REJECTED' : 'PHUC_LOI_OPEN_FAILED',
            openResult.message || `HTTP ${openResult.response.status}`
          );
        }
      } else {
        chestLevel = Math.min(MAX_CHESTS, Math.max(chestLevel + 1, normalizeChestLevel(openResult.payload)));
      }

      // Ask the server again so VIP/non-VIP countdown and completion state are
      // taken from the current account rather than guessed locally.
      await delay(350, context.signal);
      const refreshed = await postAction(context, authContext, TIMER_ACTION);
      finalDurationMs += refreshed.durationMs;
      if (refreshed.contextRejected && attempt === 0) continue;
      if (refreshed.response.ok && refreshed.payload?.success === true) {
        chestLevel = normalizeChestLevel(refreshed.payload);
        waitTime = normalizeWaitTime(refreshed.payload);
      }
    }

    const bonus = await claimMonthlyBonus(context, authContext);
    if (bonus.contextRejected && attempt === 0) continue;

    const completed = chestLevel >= MAX_CHESTS;
    const bonusSuffix = formatBonusSuffix(bonus);
    if (completed) {
      return {
        outcome: 'already_done',
        summary: `Phúc Lợi: Đã hoàn tất ${MAX_CHESTS}/${MAX_CHESTS} rương hôm nay.${bonusSuffix}`,
        httpStatus: statusResult.response.status,
        durationMs: finalDurationMs,
        data: {
          chestLevel,
          totalChests: MAX_CHESTS,
          completed: true,
          openedChestId,
          waitTime,
          monthlyBonus: bonus,
          actions: { timer: TIMER_ACTION, open: OPEN_ACTION, bonus: BONUS_ACTION }
        }
      };
    }

    const nextRunAt = makeNextRunAt(waitTime);
    const openedText = openedChestId ? ` Mở rương ${openedChestId} thành công.` : '';
    return {
      outcome: openedChestId ? 'opened' : 'waiting',
      summary: `Phúc Lợi:${openedText} Tiến độ ${chestLevel}/${MAX_CHESTS}, chờ ${waitTime}.${bonusSuffix}`,
      httpStatus: statusResult.response.status,
      durationMs: finalDurationMs,
      nextRunAt,
      data: {
        chestLevel,
        totalChests: MAX_CHESTS,
        completed: false,
        openedChestId,
        waitTime,
        monthlyBonus: bonus,
        actions: { timer: TIMER_ACTION, open: OPEN_ACTION, bonus: BONUS_ACTION }
      }
    };
  }

  throw createWelfareError(
    'PHUC_LOI_CONTEXT_REJECTED',
    lastResult?.message || 'Security context Phúc Lợi bị từ chối sau khi tải lại.'
  );
}

module.exports = runWelfareHall;
module.exports.parseCountdownMs = parseCountdownMs;
module.exports.isLastTwoDaysInVietnam = isLastTwoDaysInVietnam;
module.exports.loadWelfareContext = loadWelfareContext;
