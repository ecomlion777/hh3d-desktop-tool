const { looksLikeLoginPage, extractWordPressRestNonce } = require('../helpers/wordpressNonce.cjs');
const { extractSecurityToken } = require('../helpers/securityToken.cjs');
const {
  parseHh3dActionContext,
  mergeActionContexts,
  resolveHh3dAction
} = require('../helpers/hh3dActionContext.cjs');
const { loadQuestionBank } = require('../quiz/QuestionBankCache.cjs');

const QUIZ_PAGE_PATH = '/van-dap-tong-mon';
const AJAX_PATH = '/wp-content/themes/halimmovies-child/hh3d-ajax.php';
const LOAD_ACTION = 'load_quiz_data';
const SAVE_ACTION = 'save_quiz_result';

const LOGIN_REQUIRED_PATTERN = /(?:đăng\s*nhập|dang\s*nhap|login|required authentication|unauthorized|chưa đăng nhập|chua dang nhap)/i;
const SESSION_ERROR_PATTERN = /security|token|nonce|session|phiên|hết hạn|het han|expired|invalid|không hợp lệ|khong hop le|xác thực|xac thuc/i;
const ALREADY_ANSWERED_PATTERN = /đã trả lời|da tra loi|đã xử lý|da xu ly|already answered|already processed|câu hỏi này đã|cau hoi nay da/i;

function createQuizError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function buildCacheBustedPath(path, attempt = 0) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}t=${Date.now()}${attempt ? `-${attempt}` : ''}`;
}

function getMessage(payload, fallback = '') {
  const candidates = [
    payload?.message,
    payload?.data?.message,
    payload?.error,
    payload?.data?.error,
    typeof payload?.data === 'string' ? payload.data : null
  ];
  const found = candidates.find(value => value !== undefined && value !== null && String(value).trim());
  if (!found) return fallback;
  if (typeof found === 'string') return found.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  try { return JSON.stringify(found); } catch { return String(found); }
}

async function readJsonResponse(response) {
  const rawText = await response.text();
  if (!rawText.trim()) return { ok: true, payload: {}, rawText };
  try {
    return { ok: true, payload: JSON.parse(rawText), rawText };
  } catch (error) {
    return { ok: false, payload: null, rawText, error };
  }
}

function isSessionError(message) {
  return SESSION_ERROR_PATTERN.test(String(message || ''));
}

function isAlreadyAnsweredMessage(message) {
  return ALREADY_ANSWERED_PATTERN.test(String(message || ''));
}

function normalizeOptionText(option) {
  if (typeof option === 'string' || typeof option === 'number') return String(option);
  if (!option || typeof option !== 'object') return String(option ?? '');
  const candidate = option.text ?? option.label ?? option.option ?? option.answer ?? option.value ?? option.name;
  if (candidate !== undefined && candidate !== null) return String(candidate);
  try { return JSON.stringify(option); } catch { return String(option); }
}

function normalizeQuestionForMatch(question) {
  return {
    ...question,
    question: String(question?.question ?? question?.text ?? question?.title ?? ''),
    options: Array.isArray(question?.options)
      ? question.options.map(normalizeOptionText)
      : []
  };
}

function isQuizCompleted(state, requiredCorrect = 5) {
  const total = Number(state?.questions?.length || 0);
  const threshold = Math.min(Math.max(1, Number(requiredCorrect) || 5), total || Math.max(1, Number(requiredCorrect) || 5));
  return Boolean(state?.completed) || Number(state?.correctCount || 0) >= threshold;
}

function waitWithSignal(signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || createQuizError('MODULE_CANCELLED', 'Module đã bị hủy.'));
      return;
    }
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason || createQuizError('MODULE_CANCELLED', 'Module đã bị hủy.'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, Number(timeoutMs) || 0));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function report(context, level, action, message, extra = {}) {
  if (typeof context.appendLog !== 'function') return;
  try { await context.appendLog(level, action, message, extra); } catch {}
}

async function fetchHtml(context, relativePath) {
  const url = context.buildWebsiteUrl(relativePath);
  const { response, durationMs } = await context.httpClient.fetch(context.profile, url, {
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
    throw createQuizError('WORKER_LOGIN_REQUIRED', 'Profile chưa đăng nhập hoặc session website đã hết hạn.');
  }
  if (!response.ok) {
    throw createQuizError('VAN_DAP_PAGE_HTTP_ERROR', `Không tải được trang Vấn Đáp. HTTP ${response.status}.`);
  }
  return { html, response, durationMs };
}

async function loadSecurityContext(context, attempt = 0) {
  const page = await fetchHtml(context, buildCacheBustedPath(QUIZ_PAGE_PATH, attempt));
  let nonce = extractWordPressRestNonce(page.html);
  let securityToken = extractSecurityToken(page.html);
  let actionContext = parseHh3dActionContext(page.html);

  if (!nonce || !securityToken) {
    const home = await fetchHtml(context, buildCacheBustedPath('/', attempt));
    nonce = nonce || extractWordPressRestNonce(home.html);
    securityToken = securityToken || extractSecurityToken(home.html);
    actionContext = mergeActionContexts(actionContext, parseHh3dActionContext(home.html));
  }

  if (!securityToken) {
    throw createQuizError('VAN_DAP_SECURITY_TOKEN_NOT_FOUND', 'Không tìm thấy securityToken của Vấn Đáp.');
  }
  if (!nonce) {
    throw createQuizError('VAN_DAP_NONCE_NOT_FOUND', 'Không tìm thấy WordPress REST nonce của Vấn Đáp.');
  }

  return {
    nonce,
    securityToken,
    actionContext,
    loadAction: resolveHh3dAction(LOAD_ACTION, actionContext.actionMap),
    saveAction: resolveHh3dAction(SAVE_ACTION, actionContext.actionMap),
    contextDurationMs: page.durationMs
  };
}

async function postQuizAction(context, securityContext, action, extra = {}) {
  const url = context.buildWebsiteUrl(AJAX_PATH);
  const pageUrl = context.buildWebsiteUrl(QUIZ_PAGE_PATH);
  const baseUrl = new URL(context.websiteBaseUrl);
  const body = new URLSearchParams({
    action,
    security_token: securityContext.securityToken,
    ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, String(value)]))
  }).toString();

  const { response, durationMs } = await context.httpClient.fetch(context.profile, url, {
    method: 'POST',
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    headers: {
      Accept: 'application/json,text/javascript,*/*;q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-WP-Nonce': securityContext.nonce,
      Origin: baseUrl.origin,
      Referer: pageUrl
    },
    body
  });

  const parsed = await readJsonResponse(response);
  if (looksLikeLoginPage(parsed.rawText, response.url)) {
    throw createQuizError('WORKER_LOGIN_REQUIRED', 'Profile chưa đăng nhập hoặc session website đã hết hạn.');
  }
  return { response, durationMs, ...parsed };
}

async function loadQuizState(context, securityContext) {
  const result = await postQuizAction(context, securityContext, securityContext.loadAction);
  if (!result.ok) {
    return {
      ok: false,
      reason: 'invalid_json',
      code: 'VAN_DAP_INVALID_RESPONSE',
      message: `Server trả dữ liệu không phải JSON (HTTP ${result.response.status}).`,
      httpStatus: result.response.status
    };
  }

  const payload = result.payload;
  if (!result.response.ok || payload?.success !== true || !payload?.data) {
    const message = getMessage(payload, `Không tải được câu hỏi (HTTP ${result.response.status}).`);
    if (result.response.status === 401 || LOGIN_REQUIRED_PATTERN.test(message)) {
      throw createQuizError('WORKER_LOGIN_REQUIRED', message);
    }
    return {
      ok: false,
      reason: isSessionError(message) ? 'session_error' : 'server_error',
      code: isSessionError(message) ? 'VAN_DAP_CONTEXT_REJECTED' : 'VAN_DAP_LOAD_FAILED',
      message,
      httpStatus: result.response.status,
      payload
    };
  }

  return {
    ok: true,
    questions: Array.isArray(payload.data.questions) ? payload.data.questions : [],
    correctCount: Number(payload.data.correct_answers || 0),
    completed: Boolean(payload.data.completed),
    raw: payload.data,
    httpStatus: result.response.status,
    durationMs: result.durationMs
  };
}

async function submitAnswer(context, securityContext, question, answerIndex) {
  const result = await postQuizAction(context, securityContext, securityContext.saveAction, {
    question_id: question.id,
    answer: answerIndex
  });

  if (!result.ok) {
    return {
      success: false,
      reason: 'invalid_json',
      code: 'VAN_DAP_INVALID_RESPONSE',
      message: `Server trả dữ liệu không phải JSON (HTTP ${result.response.status}).`,
      httpStatus: result.response.status
    };
  }

  const payload = result.payload;
  if (result.response.ok && payload?.success === true) {
    const state = Number.parseInt(payload?.data?.is_correct, 10);
    const correct = state === 1 ? true : (state === 2 ? false : null);
    return {
      success: true,
      correct,
      isCorrectState: state,
      message: getMessage(payload, correct === true ? 'Trả lời đúng' : (correct === false ? 'Trả lời sai' : 'Server đã nhận đáp án')),
      httpStatus: result.response.status,
      durationMs: result.durationMs,
      payload
    };
  }

  const message = getMessage(payload, `Server từ chối đáp án (HTTP ${result.response.status}).`);
  if (result.response.status === 401 || LOGIN_REQUIRED_PATTERN.test(message)) {
    throw createQuizError('WORKER_LOGIN_REQUIRED', message);
  }
  if (isAlreadyAnsweredMessage(message)) {
    return { success: false, reason: 'already_answered', message, httpStatus: result.response.status, payload };
  }
  return {
    success: false,
    reason: isSessionError(message) ? 'session_error' : 'server_error',
    code: isSessionError(message) ? 'VAN_DAP_CONTEXT_REJECTED' : 'VAN_DAP_SAVE_FAILED',
    message,
    httpStatus: result.response.status,
    payload
  };
}

function createSummary({ done, correctCount, totalQuestions, submitted, wrong, skipped }) {
  if (done) {
    return `Vấn Đáp: Hoàn thành ${correctCount}/${totalQuestions} câu đúng; đã gửi ${submitted} câu${wrong ? `, sai ${wrong} câu` : ''}.`;
  }
  return `Vấn Đáp: đúng ${correctCount}/${totalQuestions}; đã gửi ${submitted} câu${wrong ? `, sai ${wrong} câu` : ''}${skipped ? `, bỏ qua ${skipped} câu chưa đủ độ tin cậy` : ''}.`;
}

async function runQuiz(context) {
  const config = {
    minSubmitGapMs: Math.min(Math.max(Number(context.config?.minSubmitGapMs ?? 900), 500), 5000),
    afterSubmitDelayMs: Math.min(Math.max(Number(context.config?.afterSubmitDelayMs ?? 1000), 500), 5000),
    maxAttempts: Math.min(Math.max(Number(context.config?.maxAttempts ?? 20), 1), 40),
    maxTokenRefreshes: Math.min(Math.max(Number(context.config?.maxTokenRefreshes ?? 2), 0), 5),
    requiredCorrect: Math.min(Math.max(Number(context.config?.requiredCorrect ?? 5), 1), 20),
    cacheTtlMinutes: Math.min(Math.max(Number(context.config?.questionCacheTtlMinutes ?? 60), 5), 1440)
  };

  const questionBank = await loadQuestionBank(context, {
    cacheTtlMinutes: config.cacheTtlMinutes
  });
  const matcher = questionBank.matcher;

  const submittedQuestionIds = new Set();
  const skippedQuestionIds = new Set();
  const serverFailureCounts = new Map();
  const skippedDiagnostics = [];
  let securityContext = await loadSecurityContext(context, 0);
  let lastSubmitAt = 0;
  let totalQuestions = 0;
  let correctCount = 0;
  let completed = false;
  let submittedThisSession = 0;
  let correctThisSession = 0;
  let wrongThisSession = 0;
  let tokenRefreshes = 0;
  let attempts = 0;
  let lastHttpStatus;

  await report(
    context,
    'info',
    'VAN_DAP_QA_READY',
    `Đã nạp ${questionBank.questionCount} câu hỏi Vấn Đáp (${questionBank.cacheState}).`,
    { questionCount: questionBank.questionCount, cacheState: questionBank.cacheState }
  );

  while (attempts < config.maxAttempts) {
    attempts += 1;
    let state = await loadQuizState(context, securityContext);
    if (!state.ok) {
      if (state.reason === 'session_error' && tokenRefreshes < config.maxTokenRefreshes) {
        tokenRefreshes += 1;
        securityContext = await loadSecurityContext(context, tokenRefreshes);
        continue;
      }
      throw createQuizError(state.code || 'VAN_DAP_LOAD_FAILED', state.message);
    }

    lastHttpStatus = state.httpStatus;
    totalQuestions = state.questions.length;
    correctCount = state.correctCount;
    completed = state.completed;

    if (isQuizCompleted(state, config.requiredCorrect)) {
      const summary = createSummary({
        done: true,
        correctCount,
        totalQuestions,
        submitted: submittedThisSession,
        wrong: wrongThisSession,
        skipped: skippedQuestionIds.size
      });
      return {
        outcome: submittedThisSession > 0 ? 'success' : 'already_done',
        summary,
        httpStatus: state.httpStatus,
        data: {
          completed: true,
          correctCount,
          totalQuestions,
          submitted: submittedThisSession,
          correctThisSession,
          wrongThisSession,
          skipped: skippedQuestionIds.size,
          tokenRefreshes,
          questionBankCount: questionBank.questionCount,
          questionBankCacheState: questionBank.cacheState,
          loadAction: securityContext.loadAction,
          saveAction: securityContext.saveAction
        }
      };
    }

    const unanswered = state.questions.filter(rawQuestion => {
      const question = normalizeQuestionForMatch(rawQuestion);
      const key = matcher.getQuestionKey(question);
      return matcher.isQuestionUnanswered(question)
        && !submittedQuestionIds.has(key)
        && !skippedQuestionIds.has(key);
    });

    if (!unanswered.length) break;

    let selected = null;
    for (const rawQuestion of unanswered) {
      const question = normalizeQuestionForMatch(rawQuestion);
      const match = matcher.findQuestionAndAnswer(question);
      if (match?.ok) {
        selected = { rawQuestion, question, match };
        break;
      }
      const key = matcher.getQuestionKey(question);
      skippedQuestionIds.add(key);
      const diagnostic = {
        questionId: question.id,
        question: question.question,
        reason: match?.reason || 'not_in_cache',
        message: match?.message || 'Không tìm thấy đáp án đủ tin cậy'
      };
      if (skippedDiagnostics.length < 20) skippedDiagnostics.push(diagnostic);
      await report(
        context,
        'warn',
        'VAN_DAP_SKIPPED',
        `Bỏ qua câu #${question.id ?? '--'} để tránh gửi sai: ${diagnostic.message}`,
        diagnostic
      );
    }

    if (!selected) break;

    const elapsed = Date.now() - lastSubmitAt;
    if (elapsed < config.minSubmitGapMs) {
      await waitWithSignal(context.signal, config.minSubmitGapMs - elapsed);
    }

    const answerIndex = selected.match.answerMatch.index;
    const answerOption = selected.question.options[answerIndex];
    const submitResult = await submitAnswer(
      context,
      securityContext,
      selected.question,
      answerIndex
    );
    lastSubmitAt = Date.now();
    lastHttpStatus = submitResult.httpStatus || lastHttpStatus;
    const questionKey = matcher.getQuestionKey(selected.question);

    if (submitResult.success) {
      submittedQuestionIds.add(questionKey);
      submittedThisSession += 1;
      if (submitResult.correct === true) correctThisSession += 1;
      else if (submitResult.correct === false) wrongThisSession += 1;

      await report(
        context,
        submitResult.correct === false ? 'warn' : 'success',
        submitResult.correct === false ? 'VAN_DAP_ANSWER_WRONG' : 'VAN_DAP_ANSWER_ACCEPTED',
        `Câu #${selected.question.id ?? '--'}: ${submitResult.message}.`,
        {
          questionId: selected.question.id,
          question: selected.question.question,
          matchedQuestion: selected.match.candidate.question,
          questionMatchType: selected.match.matchType,
          questionConfidence: selected.match.candidate.questionScore,
          answerMatchType: selected.match.answerMatch.matchType,
          answerConfidence: selected.match.answerMatch.confidence,
          selectedIndex: answerIndex,
          selectedOption: answerOption,
          correct: submitResult.correct
        }
      );
      await waitWithSignal(context.signal, config.afterSubmitDelayMs);
      continue;
    }

    if (submitResult.reason === 'already_answered') {
      submittedQuestionIds.add(questionKey);
      continue;
    }

    if (submitResult.reason === 'session_error' && tokenRefreshes < config.maxTokenRefreshes) {
      tokenRefreshes += 1;
      securityContext = await loadSecurityContext(context, tokenRefreshes);
      continue;
    }

    const failureCount = (serverFailureCounts.get(questionKey) || 0) + 1;
    serverFailureCounts.set(questionKey, failureCount);
    if (['server_error', 'invalid_json'].includes(submitResult.reason) && failureCount < 2) {
      await waitWithSignal(context.signal, 1200);
      continue;
    }

    skippedQuestionIds.add(questionKey);
    const diagnostic = {
      questionId: selected.question.id,
      question: selected.question.question,
      reason: submitResult.reason,
      message: submitResult.message
    };
    if (skippedDiagnostics.length < 20) skippedDiagnostics.push(diagnostic);
    await report(context, 'warn', 'VAN_DAP_SUBMIT_SKIPPED', `Bỏ qua câu #${selected.question.id ?? '--'} sau lỗi gửi: ${submitResult.message}`, diagnostic);
  }

  // Refresh final server state for an authoritative summary.
  const finalState = await loadQuizState(context, securityContext);
  if (finalState.ok) {
    totalQuestions = finalState.questions.length;
    correctCount = finalState.correctCount;
    completed = finalState.completed;
    lastHttpStatus = finalState.httpStatus;
  }
  const done = finalState.ok
    ? isQuizCompleted(finalState, config.requiredCorrect)
    : (completed || correctCount >= Math.min(config.requiredCorrect, totalQuestions || config.requiredCorrect));
  const summary = createSummary({
    done,
    correctCount,
    totalQuestions,
    submitted: submittedThisSession,
    wrong: wrongThisSession,
    skipped: skippedQuestionIds.size
  });

  return {
    outcome: done ? 'success' : 'partial',
    summary,
    httpStatus: lastHttpStatus,
    data: {
      completed: done,
      correctCount,
      totalQuestions,
      submitted: submittedThisSession,
      correctThisSession,
      wrongThisSession,
      skipped: skippedQuestionIds.size,
      skippedDiagnostics,
      attempts,
      tokenRefreshes,
      questionBankCount: questionBank.questionCount,
      questionBankCacheState: questionBank.cacheState,
      loadAction: securityContext.loadAction,
      saveAction: securityContext.saveAction
    }
  };
}

module.exports = runQuiz;
module.exports.loadSecurityContext = loadSecurityContext;
module.exports.loadQuizState = loadQuizState;
module.exports.submitAnswer = submitAnswer;
module.exports.normalizeQuestionForMatch = normalizeQuestionForMatch;
module.exports.isQuizCompleted = isQuizCompleted;
