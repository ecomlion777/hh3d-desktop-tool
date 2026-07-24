const {
  extractWordPressRestNonce,
  looksLikeLoginPage
} = require('../helpers/wordpressNonce.cjs');
const { extractSecurityToken } = require('../helpers/securityToken.cjs');

const TIEN_DUYEN_PAGE_PATH = '/tien-duyen';
const ACTION_API_PATH = '/wp-json/hh3d/v1/action';
const HONG_NHAN_BLESS_PATH = '/wp-json/hh3d/v1/hong-nhan/bless';
const LIST_ACTION = 'show_all_wedding';
const BLESS_ACTION = 'hh3d_add_blessing';
const RED_PACKET_ACTION = 'hh3d_receive_li_xi';
const DEFAULT_INTERVAL_MINUTES = 30;

const LOGIN_REQUIRED_PATTERN = /(?:đăng\s*nhập|dang\s*nhap|login|required authentication|unauthorized|chưa đăng nhập|chua dang nhap)/i;
const CONTEXT_REJECTED_PATTERN = /(?:nonce|security(?:[_ -]?token)?|rest[_ -]?nonce).*(?:invalid|expired|không hợp lệ|khong hop le|hết hạn|het han|sai|missing|thiếu|thieu)|(?:invalid|expired|không hợp lệ|khong hop le|missing).*(?:nonce|security(?:[_ -]?token)?)/i;
const ALREADY_BLESSED_PATTERN = /(?:đã|da).*?(?:(?:chúc\s*phúc|chuc\s*phuc)|(?:gửi|gui).*?(?:lời\s*chúc|loi\s*chuc))|(?:(?:chúc\s*phúc|chuc\s*phuc)|(?:lời\s*chúc|loi\s*chuc)).*?(?:rồi|roi)|already.*?bless/i;
const ALREADY_RECEIVED_PATTERN = /(?:đã|da).*?(?:nhận|nhan).*?(?:lì\s*xì|li\s*xi)|(?:lì\s*xì|li\s*xi).*?(?:đã|da).*?(?:nhận|nhan)|already.*?(?:received|claimed).*?(?:red packet|gift)/i;
const NO_RED_PACKET_PATTERN = /(?:không|khong|chưa|chua).*?(?:lì\s*xì|li\s*xi)|no.*?(?:red packet|gift).*?(?:available|left)/i;
const NO_ROOMS_PATTERN = /(?:không|khong).*?(?:phòng\s*cưới|phong\s*cuoi)|no.*?(?:wedding|room)/i;

function createBlessingError(code, message) {
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

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on', 'available'].includes(normalized);
}

function hasRoomCollection(payload) {
  return [
    payload?.data,
    payload?.data?.rooms,
    payload?.data?.weddings,
    payload?.rooms,
    payload?.weddings,
    payload
  ].some(candidate => Array.isArray(candidate));
}

function normalizeRooms(payload) {
  const candidates = [
    payload?.data,
    payload?.data?.rooms,
    payload?.data?.weddings,
    payload?.rooms,
    payload?.weddings,
    payload
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const values = Object.values(candidate);
      if (values.length > 0 && values.every(item => item && typeof item === 'object')) {
        if (values.some(item => item.wedding_room_id || item.room_id || item.id)) return values;
      }
    }
  }
  return [];
}

function getRoomId(room) {
  const value = room?.wedding_room_id ?? room?.room_id ?? room?.id;
  const id = String(value ?? '').trim();
  return id || null;
}

function getRoomType(room) {
  return String(room?.room_type ?? room?.type ?? '').trim().toLowerCase();
}

function getReward(payload) {
  const amountValue = payload?.data?.amount ?? payload?.amount;
  const amount = Number(amountValue);
  const name = String(payload?.data?.name ?? payload?.data?.reward_name ?? payload?.name ?? '').trim();
  return {
    amount: Number.isFinite(amount) ? amount : undefined,
    name: name || undefined
  };
}

function isSuccessfulPayload(response, payload) {
  return Boolean(response.ok && (
    payload?.success === true
    || payload?.status === 'success'
    || payload?.data?.success === true
  ));
}

function delay(ms, signal) {
  const waitMs = Math.max(0, Number(ms) || 0);
  if (waitMs === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new Error('MODULE_CANCELLED'));
      return;
    }
    const timer = setTimeout(resolve, waitMs);
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

async function loadHtmlPage(context, relativePath, errorCode, label) {
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
    throw createBlessingError(
      'WORKER_LOGIN_REQUIRED',
      'Profile chưa đăng nhập hoặc session website đã hết hạn.'
    );
  }
  if (!response.ok) {
    throw createBlessingError(errorCode, `Không tải được ${label}. HTTP ${response.status}.`);
  }
  return { response, html };
}

async function loadBlessingContext(context, attempt) {
  const page = await loadHtmlPage(
    context,
    buildCacheBustedPath(TIEN_DUYEN_PAGE_PATH, attempt),
    'CHUC_PHUC_PAGE_HTTP_ERROR',
    'trang Tiên Duyên'
  );

  let nonce = extractWordPressRestNonce(page.html);
  let securityToken = extractSecurityToken(page.html);

  if (!nonce || !securityToken) {
    const home = await loadHtmlPage(
      context,
      buildCacheBustedPath('/', attempt),
      'CHUC_PHUC_HOME_HTTP_ERROR',
      'trang chủ'
    );
    if (!nonce) nonce = extractWordPressRestNonce(home.html);
    if (!securityToken) securityToken = extractSecurityToken(home.html);
  }

  if (!nonce) {
    throw createBlessingError(
      'CHUC_PHUC_NONCE_NOT_FOUND',
      'Không tìm thấy WordPress REST nonce trong trang Tiên Duyên hoặc trang chủ.'
    );
  }
  if (!securityToken) {
    throw createBlessingError(
      'CHUC_PHUC_SECURITY_TOKEN_NOT_FOUND',
      'Không tìm thấy securityToken/security_token trong trang Tiên Duyên hoặc trang chủ.'
    );
  }

  return {
    nonce,
    securityToken,
    pageUrl: context.buildWebsiteUrl(TIEN_DUYEN_PAGE_PATH)
  };
}

async function postJson(context, authContext, url, body) {
  const baseUrl = new URL(context.websiteBaseUrl);
  const { response, durationMs } = await context.httpClient.fetch(context.profile, url, {
    method: 'POST',
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'X-WP-Nonce': authContext.nonce,
      'X-Requested-With': 'XMLHttpRequest',
      Origin: baseUrl.origin,
      Referer: authContext.pageUrl
    },
    body: JSON.stringify(body)
  });

  const { text, payload } = await readJsonResponse(response);
  if (looksLikeLoginPage(text, response.url)) {
    throw createBlessingError(
      'WORKER_LOGIN_REQUIRED',
      'Profile chưa đăng nhập hoặc session website đã hết hạn.'
    );
  }
  const message = getMessage(payload) || `HTTP ${response.status}`;
  if (response.status === 401 || LOGIN_REQUIRED_PATTERN.test(message)) {
    throw createBlessingError('WORKER_LOGIN_REQUIRED', message);
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

function postAction(context, authContext, action, body = {}) {
  return postJson(
    context,
    authContext,
    context.buildWebsiteUrl(ACTION_API_PATH),
    { action, ...body }
  );
}

function postHongNhanBlessing(context, authContext, roomId, message) {
  return postJson(
    context,
    authContext,
    context.buildWebsiteUrl(HONG_NHAN_BLESS_PATH),
    { wedding_room_id: roomId, message }
  );
}

function summarizeRewards(rewards) {
  const totals = new Map();
  for (const reward of rewards) {
    const key = reward.name || 'phần thưởng';
    const previous = totals.get(key) || 0;
    if (reward.amount !== undefined) totals.set(key, previous + reward.amount);
    else if (!totals.has(key)) totals.set(key, null);
  }
  return Array.from(totals.entries())
    .map(([name, amount]) => amount === null ? name : `${amount} ${name}`)
    .join(', ');
}

function makeNextRunAt(config) {
  const rawMinutes = Number(config?.checkIntervalMinutes ?? DEFAULT_INTERVAL_MINUTES);
  const minutes = Math.min(Math.max(Number.isFinite(rawMinutes) ? rawMinutes : DEFAULT_INTERVAL_MINUTES, 5), 1440);
  return {
    intervalMinutes: minutes,
    nextRunAt: new Date(Date.now() + minutes * 60_000).toISOString()
  };
}

async function runRooms(context, authContext, rooms) {
  const maxRoomsRaw = Number(context.config?.maxRoomsPerRun ?? 100);
  const maxRooms = Math.min(Math.max(Number.isFinite(maxRoomsRaw) ? Math.trunc(maxRoomsRaw) : 100, 1), 200);
  const roomDelayMsRaw = Number(context.config?.roomDelayMs ?? 500);
  const roomDelayMs = Math.min(Math.max(Number.isFinite(roomDelayMsRaw) ? roomDelayMsRaw : 500, 0), 5000);
  const receiveRedPackets = context.config?.receiveRedPackets !== false;
  const processHongNhan = context.config?.processHongNhan !== false;
  const blessingMessage = String(
    context.config?.blessingMessage || 'Chúc phúc trăm năm hạnh phúc 🎉'
  ).slice(0, 500);
  const hongNhanMessage = String(
    context.config?.hongNhanBlessingMessage
      || '🌠 Một đoạn hồng duyên, vạn phần cơ ngộ! Chúc mừng cơ duyên đẹp giữa chốn hồng trần. ✨'
  ).slice(0, 500);

  const stats = {
    totalRooms: rooms.length,
    processedRooms: 0,
    actionAttempts: 0,
    invalidRooms: 0,
    blessingsSent: 0,
    blessingsAlreadyDone: 0,
    blessingFailures: 0,
    redPacketsReceived: 0,
    redPacketsAlreadyDone: 0,
    redPacketFailures: 0,
    hongNhanRooms: 0,
    rewards: [],
    failures: []
  };

  const selectedRooms = rooms.slice(0, maxRooms);
  for (let index = 0; index < selectedRooms.length; index += 1) {
    if (context.signal?.aborted) {
      throw context.signal.reason || new Error('MODULE_CANCELLED');
    }

    const room = selectedRooms[index];
    const roomId = getRoomId(room);
    if (!roomId) {
      stats.invalidRooms += 1;
      continue;
    }

    const roomType = getRoomType(room);
    const isHongNhan = roomType === 'hong_nhan' || roomType === 'hong-nhan';
    const hasBlessed = normalizeBoolean(room?.has_blessed ?? room?.hasBlessed);
    const hasRedPacket = normalizeBoolean(room?.has_li_xi ?? room?.hasLiXi ?? room?.li_xi_available);
    let actionAttempted = false;
    stats.processedRooms += 1;
    if (isHongNhan) stats.hongNhanRooms += 1;

    if (isHongNhan && processHongNhan) {
      actionAttempted = true;
      stats.actionAttempts += 1;
      const result = await postHongNhanBlessing(context, authContext, roomId, hongNhanMessage);
      if (result.contextRejected) return { contextRejected: true, message: result.message, stats };
      if (isSuccessfulPayload(result.response, result.payload)) {
        stats.blessingsSent += 1;
      } else if (ALREADY_BLESSED_PATTERN.test(result.message)) {
        stats.blessingsAlreadyDone += 1;
      } else {
        stats.blessingFailures += 1;
        stats.failures.push({ roomId, action: 'hong_nhan_blessing', message: result.message });
      }
    } else if (!isHongNhan && !hasBlessed) {
      actionAttempted = true;
      stats.actionAttempts += 1;
      const result = await postAction(context, authContext, BLESS_ACTION, {
        wedding_room_id: roomId,
        message: blessingMessage
      });
      if (result.contextRejected) return { contextRejected: true, message: result.message, stats };
      if (isSuccessfulPayload(result.response, result.payload)) {
        stats.blessingsSent += 1;
      } else if (ALREADY_BLESSED_PATTERN.test(result.message)) {
        stats.blessingsAlreadyDone += 1;
      } else {
        stats.blessingFailures += 1;
        stats.failures.push({ roomId, action: 'blessing', message: result.message });
      }
    }

    if (receiveRedPackets && hasRedPacket) {
      actionAttempted = true;
      stats.actionAttempts += 1;
      const result = await postAction(context, authContext, RED_PACKET_ACTION, {
        wedding_room_id: roomId
      });
      if (result.contextRejected) return { contextRejected: true, message: result.message, stats };
      if (isSuccessfulPayload(result.response, result.payload)) {
        stats.redPacketsReceived += 1;
        stats.rewards.push(getReward(result.payload));
      } else if (ALREADY_RECEIVED_PATTERN.test(result.message) || NO_RED_PACKET_PATTERN.test(result.message)) {
        stats.redPacketsAlreadyDone += 1;
      } else {
        stats.redPacketFailures += 1;
        stats.failures.push({ roomId, action: 'red_packet', message: result.message });
      }
    }

    if (actionAttempted && index < selectedRooms.length - 1) {
      await delay(roomDelayMs, context.signal);
    }
  }

  return { contextRejected: false, stats };
}

function buildResult(stats, config) {
  const { intervalMinutes, nextRunAt } = makeNextRunAt(config);
  const totalActions = stats.blessingsSent + stats.redPacketsReceived;
  const totalAlreadyDone = stats.blessingsAlreadyDone + stats.redPacketsAlreadyDone;
  const totalFailures = stats.blessingFailures + stats.redPacketFailures;
  if (totalFailures > 0 && totalActions + totalAlreadyDone === 0) {
    const firstFailure = stats.failures[0]?.message || 'Tất cả thao tác Chúc Phúc/lì xì đều thất bại.';
    throw createBlessingError('CHUC_PHUC_ACTIONS_FAILED', firstFailure);
  }
  const rewardText = summarizeRewards(stats.rewards);
  let summary;

  if (totalActions === 0 && totalFailures === 0 && totalAlreadyDone === 0) {
    summary = 'Chúc Phúc: Không có phòng cưới mới hoặc lì xì cần nhận.';
  } else {
    const parts = [];
    if (stats.blessingsSent > 0) parts.push(`đã gửi ${stats.blessingsSent} lời chúc`);
    if (stats.redPacketsReceived > 0) {
      parts.push(`đã nhận ${stats.redPacketsReceived} lì xì${rewardText ? ` (${rewardText})` : ''}`);
    }
    if (totalAlreadyDone > 0) {
      parts.push(`${totalAlreadyDone} thao tác đã hoàn tất trước đó`);
    }
    if (totalFailures > 0) parts.push(`${totalFailures} thao tác lỗi`);
    summary = `Chúc Phúc: ${parts.join(', ')}. Đã kiểm tra ${stats.processedRooms}/${stats.totalRooms} phòng.`;
  }

  return {
    outcome: totalFailures > 0 && totalActions > 0
      ? 'partial_success'
      : totalFailures > 0
        ? 'completed_with_errors'
        : totalActions > 0
          ? 'success'
          : 'already_done',
    summary,
    nextRunAt,
    data: {
      ...stats,
      intervalMinutes,
      rewards: stats.rewards.filter(item => item.amount !== undefined || item.name),
      failures: stats.failures.slice(0, 20)
    }
  };
}

async function executeBlessingRun(context, authContext) {
  const listResult = await postAction(context, authContext, LIST_ACTION, {
    security_token: authContext.securityToken
  });

  if (listResult.contextRejected) {
    return { contextRejected: true, message: listResult.message };
  }

  const listPayloadAccepted = isSuccessfulPayload(listResult.response, listResult.payload)
    || (listResult.response.ok && hasRoomCollection(listResult.payload));

  if (!listPayloadAccepted) {
    if (NO_ROOMS_PATTERN.test(listResult.message)) {
      return buildResult({
        totalRooms: 0,
        processedRooms: 0,
        actionAttempts: 0,
        invalidRooms: 0,
        blessingsSent: 0,
        blessingsAlreadyDone: 0,
        blessingFailures: 0,
        redPacketsReceived: 0,
        redPacketsAlreadyDone: 0,
        redPacketFailures: 0,
        hongNhanRooms: 0,
        rewards: [],
        failures: []
      }, context.config);
    }
    if (!listResult.payload && listResult.response.ok) {
      throw createBlessingError(
        'CHUC_PHUC_INVALID_RESPONSE',
        'Máy chủ trả về danh sách phòng cưới không phải JSON hợp lệ.'
      );
    }
    throw createBlessingError(
      'CHUC_PHUC_LIST_FAILED',
      listResult.message || `HTTP ${listResult.response.status}`
    );
  }

  const rooms = normalizeRooms(listResult.payload);
  const roomResult = await runRooms(context, authContext, rooms);
  if (roomResult.contextRejected) return roomResult;

  const result = buildResult(roomResult.stats, context.config);
  result.httpStatus = listResult.response.status;
  return result;
}

async function runBlessingRedPacket(context) {
  const retryContext = context.config?.retrySecurityContextOnce !== false;
  let lastRejectedMessage = '';

  for (let attempt = 0; attempt < (retryContext ? 2 : 1); attempt += 1) {
    const authContext = await loadBlessingContext(context, attempt);
    const result = await executeBlessingRun(context, authContext);
    if (!result.contextRejected) return result;
    lastRejectedMessage = result.message || 'Security context bị từ chối.';
  }

  throw createBlessingError(
    'CHUC_PHUC_CONTEXT_REJECTED',
    lastRejectedMessage || 'Nonce hoặc security token bị từ chối sau khi tải lại.'
  );
}

module.exports = runBlessingRedPacket;
module.exports.hasRoomCollection = hasRoomCollection;
module.exports.normalizeRooms = normalizeRooms;
module.exports.normalizeBoolean = normalizeBoolean;
module.exports.getReward = getReward;
module.exports.makeNextRunAt = makeNextRunAt;
