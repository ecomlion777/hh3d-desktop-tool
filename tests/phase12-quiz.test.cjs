const assert = require('assert/strict');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const VanDapMatcher = require(`${base}/modules/quiz/VanDapMatcher.cjs`);
const {
  QUESTION_DATA_URL,
  clearQuestionBankCache
} = require(`${base}/modules/quiz/QuestionBankCache.cjs`);
const runQuiz = require(`${base}/modules/builtin/QuizModule.cjs`);
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);

function makeResponse(status, body, url = 'https://hoathinh3d.st/') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: {},
    async text() { return text; },
    async json() { return JSON.parse(text); }
  };
}

function contextPage(nonce = 'noncePhase12', token = 'tokenPhase12', loadAction = 'vd_load_encoded', saveAction = 'vd_save_encoded') {
  return `
    <html><body>Vấn Đáp Tông Môn</body>
    <script>
      const customRestNonce = "${nonce}";
      var hh3dData = {
        "securityToken": "${token}",
        "act": { "vdLoad": "${loadAction}", "vdSave": "${saveAction}" }
      };
    </script></html>
  `;
}

const QA_DATA = {
  questions: {
    'Cao Ảnh trong 《Nam Đình Cốc Vi》 học tại đại học nào?': 'Học viện Mỹ thuật Giang Châu',
    'Ai sau đây làm lễ cưới với Lý Mộ Uyển trong Tiên Nghịch?': [
      'Tôn Chấn Vĩ', 'Tôn Trấn Vĩ', 'Tôn Chấn Vỹ', 'Tôn Trấn Vỹ'
    ],
    'Hai nhận định nào sau đây là đúng?': 'Cả 1 và 2',
    'Câu hỏi tổng hợp?': 'Tất cả đáp án trên'
  }
};

function createContext(fetchImpl, config = {}) {
  return {
    profile: { id: 'p1', uid: 'HH3D-88001', displayName: 'Profile 1' },
    manifest: { code: 'van_dap', label: 'Vấn Đáp' },
    config: {
      minSubmitGapMs: 500,
      afterSubmitDelayMs: 500,
      maxAttempts: 20,
      maxTokenRefreshes: 2,
      requiredCorrect: 5,
      questionCacheTtlMinutes: 60,
      ...config
    },
    trigger: 'manual',
    signal: new AbortController().signal,
    timeoutMs: 5000,
    websiteBaseUrl: 'https://hoathinh3d.st/',
    buildWebsiteUrl(relativePath) {
      return new URL(relativePath, 'https://hoathinh3d.st/').toString();
    },
    httpClient: { fetch: fetchImpl },
    logs: [],
    async appendLog(level, action, message, extra = {}) {
      this.logs.push({ level, action, message, extra });
    }
  };
}

function parseFormBody(init) {
  return Object.fromEntries(new URLSearchParams(String(init.body || '')).entries());
}

function testSmartMatcher() {
  const matcher = new VanDapMatcher(QA_DATA);
  assert.equal(matcher.questionIndex.length, 4);

  const exact = matcher.findQuestionAndAnswer({
    question: 'Cao Ảnh trong 《Nam Đình Cốc Vi》 học tại đại học nào?',
    options: ['Đại học A', 'Học viện Mỹ thuật Giang Châu', 'Đại học B']
  });
  assert.equal(exact.ok, true);
  assert.equal(exact.matchType, 'question_exact');
  assert.equal(exact.answerMatch.index, 1);

  const loose = matcher.findQuestionAndAnswer({
    question: 'Cao Anh trong Nam Dinh Coc Vi hoc tai dai hoc nao?',
    options: ['Hoc vien My thuat Giang Chau', 'Hoc vien My thuat Quang Chau']
  });
  assert.equal(loose.ok, true);
  assert.equal(loose.matchType, 'question_loose');
  assert.equal(loose.answerMatch.index, 0);

  const alias = matcher.findQuestionAndAnswer({
    question: 'Hai nhận định nào sau đây là đúng?',
    options: ['Chỉ 1', 'Chỉ 2', '1 và 2']
  });
  assert.equal(alias.ok, true);
  assert.equal(alias.answerMatch.index, 2);

  const allAnswers = matcher.findQuestionAndAnswer({
    question: 'Câu hỏi tổng hợp?',
    options: ['A', 'B', 'Tất cả đáp án']
  });
  assert.equal(allAnswers.ok, true);
  assert.equal(allAnswers.answerMatch.index, 2);

  const numericSafetyMatcher = new VanDapMatcher({
    questions: { 'Nhân vật hoàn thành thử thách trong 8 năm?': 'A' }
  });
  const unsafe = numericSafetyMatcher.findQuestionAndAnswer({
    question: 'Nhân vật hoàn thành thử thách trong 9 năm?',
    options: ['A', 'B']
  });
  assert.equal(unsafe.ok, false);
}

async function testSuccessfulQuizFlow() {
  clearQuestionBankCache();
  let loadCalls = 0;
  let saveCalls = 0;
  const context = createContext(async (_profile, url, init = {}) => {
    if (url.startsWith(QUESTION_DATA_URL)) {
      return { response: makeResponse(200, QA_DATA, url), durationMs: 10 };
    }
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage(), url), durationMs: 5 };
    }

    const body = parseFormBody(init);
    if (body.action === 'vd_load_encoded') {
      loadCalls += 1;
      if (loadCalls === 1) {
        return {
          response: makeResponse(200, {
            success: true,
            data: {
              questions: [{
                id: 11,
                question: 'Cao Ảnh trong 《Nam Đình Cốc Vi》 học tại đại học nào?',
                options: ['Học viện Mỹ thuật Quảng Châu', 'Học viện Mỹ thuật Giang Châu'],
                is_correct: 0
              }],
              correct_answers: 0,
              completed: false
            }
          }, url),
          durationMs: 6
        };
      }
      return {
        response: makeResponse(200, {
          success: true,
          data: {
            questions: [{ id: 11, question: '...', options: [], is_correct: 1 }],
            correct_answers: 1,
            completed: true
          }
        }, url),
        durationMs: 5
      };
    }
    if (body.action === 'vd_save_encoded') {
      saveCalls += 1;
      assert.equal(body.security_token, 'tokenPhase12');
      assert.equal(body.question_id, '11');
      assert.equal(body.answer, '1');
      assert.equal(init.headers['X-WP-Nonce'], 'noncePhase12');
      return {
        response: makeResponse(200, {
          success: true,
          message: 'Trả lời chính xác',
          data: { is_correct: 1 }
        }, url),
        durationMs: 7
      };
    }
    throw new Error(`Unexpected request: ${url} ${JSON.stringify(body)}`);
  });

  const result = await runQuiz(context);
  assert.equal(result.outcome, 'success');
  assert.equal(result.data.completed, true);
  assert.equal(result.data.submitted, 1);
  assert.equal(result.data.correctThisSession, 1);
  assert.equal(result.data.wrongThisSession, 0);
  assert.equal(result.data.skipped, 0);
  assert.equal(result.data.loadAction, 'vd_load_encoded');
  assert.equal(result.data.saveAction, 'vd_save_encoded');
  assert.equal(saveCalls, 1);
  assert(context.logs.some(log => log.action === 'VAN_DAP_QA_READY'));
  assert(context.logs.some(log => log.action === 'VAN_DAP_ANSWER_ACCEPTED'));
}

async function testAlreadyCompleted() {
  clearQuestionBankCache();
  let saveCalls = 0;
  const result = await runQuiz(createContext(async (_profile, url, init = {}) => {
    if (url.startsWith(QUESTION_DATA_URL)) {
      return { response: makeResponse(200, QA_DATA, url), durationMs: 1 };
    }
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage(), url), durationMs: 1 };
    }
    const body = parseFormBody(init);
    if (body.action === 'vd_save_encoded') saveCalls += 1;
    return {
      response: makeResponse(200, {
        success: true,
        data: {
          questions: [{ id: 1, question: 'Done', options: [], is_correct: 1 }],
          correct_answers: 1,
          completed: true
        }
      }, url),
      durationMs: 1
    };
  }));
  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.submitted, 0);
  assert.equal(saveCalls, 0);
}

async function testLowConfidenceIsSkipped() {
  clearQuestionBankCache();
  let loadCalls = 0;
  let saveCalls = 0;
  const context = createContext(async (_profile, url, init = {}) => {
    if (url.startsWith(QUESTION_DATA_URL)) {
      return { response: makeResponse(200, QA_DATA, url), durationMs: 1 };
    }
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage(), url), durationMs: 1 };
    }
    const body = parseFormBody(init);
    if (body.action === 'vd_save_encoded') {
      saveCalls += 1;
      throw new Error('Low-confidence answer must never be submitted.');
    }
    loadCalls += 1;
    return {
      response: makeResponse(200, {
        success: true,
        data: {
          questions: [{
            id: 99,
            question: 'Câu hoàn toàn mới chưa có trong ngân hàng?',
            options: ['A', 'B', 'C'],
            is_correct: 0
          }],
          correct_answers: 0,
          completed: false
        }
      }, url),
      durationMs: 1
    };
  });

  const result = await runQuiz(context);
  assert.equal(result.outcome, 'partial');
  assert.equal(result.data.skipped, 1);
  assert.equal(result.data.submitted, 0);
  assert.equal(saveCalls, 0);
  assert(loadCalls >= 2);
  assert(context.logs.some(log => log.action === 'VAN_DAP_SKIPPED'));
}

async function testSecurityContextRetry() {
  clearQuestionBankCache();
  let pageCalls = 0;
  let loadCalls = 0;
  const result = await runQuiz(createContext(async (_profile, url, init = {}) => {
    if (url.startsWith(QUESTION_DATA_URL)) {
      return { response: makeResponse(200, QA_DATA, url), durationMs: 1 };
    }
    if ((init.method || 'GET') === 'GET') {
      pageCalls += 1;
      return {
        response: makeResponse(200, contextPage(
          `nonceRetry${pageCalls}`,
          `tokenRetry${pageCalls}`,
          `loadRetry${pageCalls}`,
          `saveRetry${pageCalls}`
        ), url),
        durationMs: 1
      };
    }
    const body = parseFormBody(init);
    if (String(body.action).startsWith('loadRetry')) {
      loadCalls += 1;
      if (loadCalls === 1) {
        return {
          response: makeResponse(403, { success: false, message: 'Security token không hợp lệ hoặc đã hết hạn' }, url),
          durationMs: 1
        };
      }
      assert.equal(body.security_token, 'tokenRetry2');
      assert.equal(init.headers['X-WP-Nonce'], 'nonceRetry2');
      return {
        response: makeResponse(200, {
          success: true,
          data: { questions: [], correct_answers: 5, completed: true }
        }, url),
        durationMs: 1
      };
    }
    throw new Error(`Unexpected action ${body.action}`);
  }));

  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.tokenRefreshes, 1);
  assert.equal(pageCalls, 2);
  assert.equal(loadCalls, 2);
}

async function testLoginRequired() {
  clearQuestionBankCache();
  let error;
  try {
    await runQuiz(createContext(async (_profile, url) => {
      if (url.startsWith(QUESTION_DATA_URL)) {
        return { response: makeResponse(200, QA_DATA, url), durationMs: 1 };
      }
      return {
        response: makeResponse(
          200,
          '<form id="loginform"><input name="user_login"></form>',
          'https://hoathinh3d.st/wp-login.php'
        ),
        durationMs: 1
      };
    }));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'WORKER_LOGIN_REQUIRED');
}

async function testRunnerIntegrationAndOrder() {
  clearQuestionBankCache();
  const registry = new ModuleRegistry();
  registry.registerHandler('van_dap', runQuiz);
  const manifest = registry.getManifest('van_dap');
  assert.equal(manifest.implementationState, 'ready');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(registry.listCatalog().find(item => item.code === 'van_dap').runnable, true);
  assert(registry.getManifest('diem_danh').order < manifest.order);
  assert(manifest.order < registry.getManifest('te_le').order);

  let loadCalls = 0;
  const httpClient = {
    buildWebsiteUrl(relativePath) {
      return new URL(relativePath, 'https://hoathinh3d.st/').toString();
    },
    async fetch(_profile, url, init = {}) {
      if (url.startsWith(QUESTION_DATA_URL)) {
        return { response: makeResponse(200, QA_DATA, url), durationMs: 1 };
      }
      if ((init.method || 'GET') === 'GET') {
        return { response: makeResponse(200, contextPage(), url), durationMs: 1 };
      }
      const body = parseFormBody(init);
      if (body.action === 'vd_load_encoded') {
        loadCalls += 1;
        return {
          response: makeResponse(200, {
            success: true,
            data: { questions: [], correct_answers: 5, completed: true }
          }, url),
          durationMs: 1
        };
      }
      throw new Error(`Unexpected action ${body.action}`);
    }
  };

  const recorded = [];
  const logs = [];
  const runner = new ModuleRunner({
    registry,
    settingsRepository: {
      async getProfileSettings() {
        return [{ moduleCode: 'van_dap', enabled: true, config: manifest.defaultConfig }];
      },
      async recordResult(profileId, moduleCode, result) {
        recorded.push({ profileId, moduleCode, result });
      }
    },
    profileRepo: {
      async getProfileById() {
        return { id: 'p1', uid: 'U1', displayName: 'Profile 1' };
      }
    },
    httpClient,
    logRepository: {
      async append(log) { logs.push(log); return log; },
      async listLogs() { return logs; }
    },
    websiteConfigService: {
      getTargetUrl() { return 'https://hoathinh3d.st/'; }
    }
  });

  const result = await runner.runModule('p1', 'van_dap', { trigger: 'manual', force: true });
  assert.equal(result.state, 'success');
  assert.equal(result.outcome, 'already_done');
  assert.equal(loadCalls, 1);
  assert.equal(recorded.length, 1);
  assert(logs.some(log => log.action === 'VAN_DAP_QA_READY'));
  assert(logs.some(log => log.action === 'MODULE_SUCCESS'));
}

async function main() {
  testSmartMatcher();
  await testSuccessfulQuizFlow();
  await testAlreadyCompleted();
  await testLowConfidenceIsSkipped();
  await testSecurityContextRetry();
  await testLoginRequired();
  await testRunnerIntegrationAndOrder();

  console.log(JSON.stringify({
    status: 'PASS',
    module: 'van_dap',
    page: QUIZ_PAGE_PATH,
    endpoint: AJAX_PATH,
    questionDataUrl: QUESTION_DATA_URL,
    smartMatchVersion: '2.5.8.1',
    exactAndLooseMatching: true,
    highThresholdFuzzyMatching: true,
    numericMismatchBlocked: true,
    answerAliasMatching: true,
    lowConfidenceSkipped: true,
    oneQuestionPerRefresh: true,
    securityContextRetry: true,
    sharedQuestionBankCache: true,
    runnerIntegration: true
  }, null, 2));
}

const QUIZ_PAGE_PATH = '/van-dap-tong-mon';
const AJAX_PATH = '/wp-content/themes/halimmovies-child/hh3d-ajax.php';

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
