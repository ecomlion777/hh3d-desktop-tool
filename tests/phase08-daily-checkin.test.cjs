const assert = require('assert/strict');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const runDailyCheckin = require(`${base}/modules/builtin/DailyCheckinModule.cjs`);
const {
  extractWordPressRestNonce,
  looksLikeLoginPage
} = require(`${base}/modules/helpers/wordpressNonce.cjs`);

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

function createContext(fetchImpl) {
  return {
    profile: { id: 'p1', uid: 'U1', displayName: 'Profile 1' },
    manifest: { code: 'diem_danh', label: 'Điểm Danh' },
    config: {},
    trigger: 'manual',
    signal: new AbortController().signal,
    timeoutMs: 5000,
    websiteBaseUrl: 'https://hoathinh3d.st/',
    buildWebsiteUrl(relativePath) {
      return new URL(relativePath, 'https://hoathinh3d.st/').toString();
    },
    httpClient: { fetch: fetchImpl }
  };
}

async function testSuccess() {
  const calls = [];
  const result = await runDailyCheckin(createContext(async (_profile, url, init) => {
    calls.push({ url, init });
    if ((init.method || 'GET') === 'GET') {
      return {
        response: makeResponse(200, '<script>const customRestNonce = "abc123XYZ";</script>', url),
        durationMs: 10
      };
    }
    assert.equal(init.headers['X-WP-Nonce'], 'abc123XYZ');
    assert.equal(JSON.parse(init.body).action, 'daily_check_in');
    return {
      response: makeResponse(200, { success: true, message: 'Điểm danh thành công', streak: 7 }, url),
      durationMs: 25
    };
  }));

  assert.equal(result.outcome, 'success');
  assert.equal(result.httpStatus, 200);
  assert.equal(result.data.streak, 7);
  assert.equal(result.data.alreadyDone, false);
  assert.equal(calls.length, 2);
}

async function testAlreadyDone() {
  const result = await runDailyCheckin(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, '"restNonce":"nonce7890"', url), durationMs: 8 };
    }
    return {
      response: makeResponse(400, { success: false, message: 'Bạn đã điểm danh hôm nay rồi', streak: 9 }, url),
      durationMs: 12
    };
  }));
  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.alreadyDone, true);
  assert.equal(result.data.streak, 9);
}

async function testNonceRetry() {
  let getCount = 0;
  let postCount = 0;
  const result = await runDailyCheckin(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      getCount += 1;
      const nonce = getCount === 1 ? 'oldNonce1' : 'newNonce2';
      return { response: makeResponse(200, `customRestNonce='${nonce}'`, url), durationMs: 5 };
    }
    postCount += 1;
    if (postCount === 1) {
      assert.equal(init.headers['X-WP-Nonce'], 'oldNonce1');
      return {
        response: makeResponse(403, { success: false, message: 'Nonce không hợp lệ hoặc đã hết hạn' }, url),
        durationMs: 6
      };
    }
    assert.equal(init.headers['X-WP-Nonce'], 'newNonce2');
    return {
      response: makeResponse(200, { success: true, message: 'Điểm danh thành công' }, url),
      durationMs: 7
    };
  }));
  assert.equal(result.outcome, 'success');
  assert.equal(postCount, 2);
  assert.equal(getCount, 2);
}

async function testLoginRequired() {
  let error;
  try {
    await runDailyCheckin(createContext(async (_profile, url) => ({
      response: makeResponse(200, '<form id="loginform"><input name="user_login"></form>', 'https://hoathinh3d.st/wp-login.php'),
      durationMs: 4
    })));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'WORKER_LOGIN_REQUIRED');
}

async function testRunnerIntegration() {
  const registry = new ModuleRegistry();
  registry.registerHandler('session_check', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('framework_diagnostic', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('diem_danh', runDailyCheckin);

  const manifest = registry.getManifest('diem_danh');
  assert.equal(manifest.implementationState, 'ready');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(registry.listCatalog().find(item => item.code === 'diem_danh').runnable, true);

  const recorded = [];
  const logs = [];
  const settingsRepository = {
    async getProfileSettings() {
      return [{ moduleCode: 'diem_danh', enabled: true, config: {} }];
    },
    async recordResult(_profileId, moduleCode, result) {
      recorded.push({ moduleCode, result });
    },
    async listEnabledRunnable() {
      return [{ moduleCode: 'diem_danh' }];
    }
  };
  const profileRepo = {
    async getProfileById(id) {
      return id === 'p1' ? { id: 'p1', uid: 'U1', displayName: 'Profile 1' } : null;
    }
  };
  const httpClient = {
    buildWebsiteUrl(relativePath) {
      return new URL(relativePath, 'https://hoathinh3d.st/').toString();
    },
    async fetch(_profile, url, init) {
      if ((init.method || 'GET') === 'GET') {
        return { response: makeResponse(200, 'customRestNonce="runnerNonce"', url), durationMs: 3 };
      }
      return {
        response: makeResponse(200, { success: true, message: 'Điểm danh thành công', streak: 3 }, url),
        durationMs: 11
      };
    }
  };
  const logRepository = {
    async append(entry) { logs.push(entry); return entry; },
    async listLogs() { return logs; }
  };

  const runner = new ModuleRunner({
    registry,
    settingsRepository,
    profileRepo,
    httpClient,
    logRepository,
    websiteConfigService: {
      getTargetUrl() { return 'https://hoathinh3d.st/'; }
    }
  });

  const result = await runner.runModule('p1', 'diem_danh', { trigger: 'manual' });
  assert.equal(result.state, 'success');
  assert.equal(result.outcome, 'success');
  assert.equal(result.data.streak, 3);
  assert.equal(recorded[0].moduleCode, 'diem_danh');
  assert(logs.some(log => log.action === 'MODULE_SUCCESS'));
}

async function main() {
  assert.equal(extractWordPressRestNonce("customRestNonce='abcDEF123'"), 'abcDEF123');
  assert.equal(extractWordPressRestNonce('{"restNonce":"xyz987654"}'), 'xyz987654');
  assert.equal(looksLikeLoginPage('<form id="loginform"></form>'), true);
  assert.equal(looksLikeLoginPage('<html><body>Điểm Danh</body></html>'), false);

  await testSuccess();
  await testAlreadyDone();
  await testNonceRetry();
  await testLoginRequired();
  await testRunnerIntegration();

  console.log(JSON.stringify({
    status: 'PASS',
    module: 'diem_danh',
    endpoint: '/wp-json/hh3d/v1/action',
    action: 'daily_check_in',
    nonceExtraction: true,
    nonceRetry: true,
    alreadyDoneAccepted: true,
    loginRequiredDetected: true,
    runnerIntegration: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
