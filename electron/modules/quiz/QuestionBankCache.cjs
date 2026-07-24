const fs = require('fs');
const path = require('path');
const VanDapMatcher = require('./VanDapMatcher.cjs');

const QUESTION_DATA_URL = 'https://gist.githubusercontent.com/mrchou-tvt/94b1732e3351fb34667a7e6d45b39de5/raw/vandap.json';
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_QUESTION_COUNT = 20000;
const CACHE_VERSION = 1;
const CACHE_FILENAME = 'van-dap-question-bank.json';

let cacheEntry = null;
let loadingPromise = null;
let diskCacheChecked = false;

function createQuestionBankError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function normalizeTtlMs(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_TTL_MS;
  return Math.min(Math.max(minutes, 5), 24 * 60) * 60 * 1000;
}

function validateQuestionCount(matcher) {
  const count = matcher.questionIndex.length;
  if (count <= 0) {
    throw createQuestionBankError('VAN_DAP_QA_EMPTY', 'Ngân hàng câu hỏi đang trống.');
  }
  if (count > MAX_QUESTION_COUNT) {
    throw createQuestionBankError(
      'VAN_DAP_QA_TOO_LARGE',
      `Ngân hàng câu hỏi vượt giới hạn ${MAX_QUESTION_COUNT} câu.`
    );
  }
  return count;
}

function getCacheFilePath() {
  try {
    const electron = require('electron');
    const app = electron?.app;
    if (!app || typeof app.getPath !== 'function') return null;
    return path.join(app.getPath('userData'), 'hh3d-data', CACHE_FILENAME);
  } catch {
    return null;
  }
}

function buildCacheEntry(rawData, fetchedAt = Date.now(), metadata = {}) {
  const matcher = new VanDapMatcher(rawData);
  const questionCount = validateQuestionCount(matcher);
  return {
    matcher,
    rawData,
    questionCount,
    loadedAt: Number(fetchedAt) || Date.now(),
    sourceUrl: QUESTION_DATA_URL,
    durationMs: metadata.durationMs
  };
}

function loadDiskCacheOnce() {
  if (diskCacheChecked) return cacheEntry;
  diskCacheChecked = true;
  const cacheFile = getCacheFilePath();
  if (!cacheFile || !fs.existsSync(cacheFile)) return cacheEntry;

  try {
    const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (stored?.cacheVersion !== CACHE_VERSION || stored?.sourceUrl !== QUESTION_DATA_URL || !stored?.data) {
      return cacheEntry;
    }
    cacheEntry = buildCacheEntry(stored.data, stored.fetchedAt, { durationMs: stored.durationMs });
  } catch (error) {
    console.warn('[Vấn Đáp QA] Cache đĩa không hợp lệ, sẽ tải lại:', error.message);
  }
  return cacheEntry;
}

function saveDiskCache(entry) {
  const cacheFile = getCacheFilePath();
  if (!cacheFile || !entry?.rawData) return;
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tempFile = `${cacheFile}.tmp`;
    const payload = {
      cacheVersion: CACHE_VERSION,
      sourceUrl: QUESTION_DATA_URL,
      fetchedAt: entry.loadedAt,
      durationMs: entry.durationMs,
      questionCount: entry.questionCount,
      data: entry.rawData
    };
    fs.writeFileSync(tempFile, JSON.stringify(payload), 'utf8');
    JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
    fs.renameSync(tempFile, cacheFile);
  } catch (error) {
    console.warn('[Vấn Đáp QA] Không ghi được cache đĩa:', error.message);
  }
}

async function fetchQuestionBank(context) {
  const url = `${QUESTION_DATA_URL}?t=${Date.now()}`;
  const { response, durationMs } = await context.httpClient.fetch(context.profile, url, {
    method: 'GET',
    timeoutMs: Math.min(Math.max(Number(context.timeoutMs || 15000), 5000), 60000),
    headers: {
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.5',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache'
    }
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw createQuestionBankError(
      'VAN_DAP_QA_HTTP_ERROR',
      `Không tải được ngân hàng đáp án. HTTP ${response.status}.`
    );
  }

  let rawData;
  try {
    rawData = JSON.parse(rawText);
  } catch (error) {
    throw createQuestionBankError(
      'VAN_DAP_QA_INVALID_JSON',
      `Dữ liệu QA không phải JSON hợp lệ: ${error.message}`
    );
  }

  return buildCacheEntry(rawData, Date.now(), { durationMs });
}

async function loadQuestionBank(context, options = {}) {
  const ttlMs = normalizeTtlMs(options.cacheTtlMinutes);
  loadDiskCacheOnce();
  const now = Date.now();
  if (!options.forceRefresh && cacheEntry && now - cacheEntry.loadedAt < ttlMs) {
    return { ...cacheEntry, cacheState: 'fresh' };
  }

  if (!loadingPromise) {
    loadingPromise = fetchQuestionBank(context)
      .then(entry => {
        cacheEntry = entry;
        saveDiskCache(entry);
        return entry;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }

  try {
    const entry = await loadingPromise;
    return { ...entry, cacheState: 'network' };
  } catch (error) {
    // A stale verified disk/memory bank is safer than guessing answers or
    // stopping every profile because GitHub is temporarily unavailable.
    if (cacheEntry) return { ...cacheEntry, cacheState: 'stale_fallback', warning: error.message };
    throw error;
  }
}

function clearQuestionBankCache(options = {}) {
  cacheEntry = null;
  loadingPromise = null;
  diskCacheChecked = Boolean(options.keepDiskChecked);
  if (options.clearDisk) {
    const cacheFile = getCacheFilePath();
    if (cacheFile && fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
    diskCacheChecked = true;
  }
}

function getQuestionBankCacheInfo() {
  loadDiskCacheOnce();
  return cacheEntry ? {
    loadedAt: new Date(cacheEntry.loadedAt).toISOString(),
    questionCount: cacheEntry.questionCount,
    sourceUrl: cacheEntry.sourceUrl,
    cacheFile: getCacheFilePath()
  } : null;
}

module.exports = {
  QUESTION_DATA_URL,
  loadQuestionBank,
  clearQuestionBankCache,
  getQuestionBankCacheInfo
};
