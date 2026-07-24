const assert = require('assert/strict');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const runWelfareHall = require(`${base}/modules/builtin/WelfareHallModule.cjs`);
const {
  parseCountdownMs,
  isLastTwoDaysInVietnam
} = runWelfareHall;
const {
  parseHh3dActionContext,
  resolveHh3dAction
} = require(`${base}/modules/helpers/hh3dActionContext.cjs`);

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

function actionPage(options = {}) {
  const securityToken = options.securityToken || 'globalToken10';
  const actionMap = options.actionMap || {
    plTimer: 'timerHash10',
    plOpen: 'openHash10',
    plClaim: 'claimHash10'
  };
  return `
    <html><body>Phúc Lợi Đường</body>
    <script>
      window.hh3dData = {
        "securityToken":"${securityToken}",
        "act":${JSON.stringify(actionMap)}
      };
      const oldTimer = { action: 'get_next_time_pl', security: 'legacyTimer10' };
      const oldOpen = { action: 'open_chest_pl', security: 'legacyOpen10' };
      const oldClaim = { action: 'claim_bonus_reward', security: 'legacyClaim10' };
    </script></html>
  `;
}

function createContext(fetchImpl, config = {}) {
  return {
    profile: { id: 'p1', uid: 'U1', displayName: 'Profile 1' },
    manifest: { code: 'phuc_loi', label: 'Phúc Lợi' },
    config: { claimMonthlyBonus: false, ...config },
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

function decodeForm(body) {
  return Object.fromEntries(new URLSearchParams(String(body || '')).entries());
}

async function testWaiting() {
  const calls = [];
  const result = await runWelfareHall(createContext(async (_profile, url, init) => {
    calls.push({ url, init });
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, actionPage(), url), durationMs: 5 };
    }
    const form = decodeForm(init.body);
    assert.equal(form.action, 'timerHash10');
    assert.equal(form.security_token, 'globalToken10');
    assert.equal(form.security, 'legacyTimer10');
    return {
      response: makeResponse(200, { success: true, data: { time: '12:34', chest_level: '2' } }, url),
      durationMs: 9
    };
  }));
  assert.equal(result.outcome, 'waiting');
  assert.equal(result.data.chestLevel, 2);
  assert.equal(result.data.waitTime, '12:34');
  assert(result.nextRunAt);
  assert.equal(calls.length, 2);
}

async function testOpenAndRefresh() {
  let postCount = 0;
  const result = await runWelfareHall(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, actionPage(), url), durationMs: 4 };
    }
    postCount += 1;
    const form = decodeForm(init.body);
    if (postCount === 1) {
      assert.equal(form.action, 'timerHash10');
      return {
        response: makeResponse(200, { success: true, data: { time: '00:00', chest_level: '1' } }, url),
        durationMs: 6
      };
    }
    if (postCount === 2) {
      assert.equal(form.action, 'openHash10');
      assert.equal(form.chest_id, '2');
      assert.equal(form.security, 'legacyOpen10');
      return {
        response: makeResponse(200, { success: true, data: { message: 'Mở rương cấp 2 thành công' } }, url),
        durationMs: 8
      };
    }
    assert.equal(form.action, 'timerHash10');
    return {
      response: makeResponse(200, { success: true, data: { time: '07:33', chest_level: '2' } }, url),
      durationMs: 7
    };
  }));
  assert.equal(result.outcome, 'opened');
  assert.equal(result.data.openedChestId, 2);
  assert.equal(result.data.chestLevel, 2);
  assert.equal(result.data.waitTime, '07:33');
  assert.equal(postCount, 3);
}

async function testComplete() {
  const result = await runWelfareHall(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, actionPage(), url), durationMs: 3 };
    }
    return {
      response: makeResponse(200, { success: true, data: { time: '00:00', chest_level: '4' } }, url),
      durationMs: 5
    };
  }));
  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.completed, true);
  assert.equal(result.data.chestLevel, 4);
}

async function testContextRetry() {
  let getCount = 0;
  let postCount = 0;
  const result = await runWelfareHall(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      getCount += 1;
      const suffix = getCount === 1 ? 'Old' : 'New';
      return {
        response: makeResponse(200, actionPage({
          securityToken: `token${suffix}10`,
          actionMap: { plTimer: `timer${suffix}10`, plOpen: `open${suffix}10`, plClaim: `claim${suffix}10` }
        }), url),
        durationMs: 3
      };
    }
    postCount += 1;
    const form = decodeForm(init.body);
    if (postCount === 1) {
      assert.equal(form.action, 'timerOld10');
      return {
        response: makeResponse(403, { success: false, message: 'Security token không hợp lệ hoặc đã hết hạn' }, url),
        durationMs: 4
      };
    }
    assert.equal(form.action, 'timerNew10');
    assert.equal(form.security_token, 'tokenNew10');
    return {
      response: makeResponse(200, { success: true, data: { time: '05:00', chest_level: '3' } }, url),
      durationMs: 5
    };
  }));
  assert.equal(result.outcome, 'waiting');
  assert.equal(postCount, 2);
  assert.equal(getCount, 2);
}

async function testLoginRequired() {
  let error;
  try {
    await runWelfareHall(createContext(async (_profile, url) => ({
      response: makeResponse(200, '<form id="loginform"><input name="user_login"></form>', 'https://hoathinh3d.st/wp-login.php'),
      durationMs: 4
    })));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'WORKER_LOGIN_REQUIRED');
}

async function testMonthlyBonus() {
  const originalDate = global.Date;
  const fixed = new originalDate('2026-07-30T10:00:00+07:00');
  class FixedDate extends originalDate {
    constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); }
    static now() { return fixed.getTime(); }
  }
  global.Date = FixedDate;
  try {
    const bonusCalls = [];
    const result = await runWelfareHall(createContext(async (_profile, url, init) => {
      if ((init.method || 'GET') === 'GET') {
        return { response: makeResponse(200, actionPage(), url), durationMs: 3 };
      }
      const form = decodeForm(init.body);
      if (form.action === 'timerHash10') {
        return {
          response: makeResponse(200, { success: true, data: { time: '01:00', chest_level: '4' } }, url),
          durationMs: 4
        };
      }
      assert.equal(form.action, 'claimHash10');
      assert.equal(form.security, 'legacyClaim10');
      bonusCalls.push(Number(form.chest_id));
      const chestId = Number(form.chest_id);
      if (chestId <= 2) {
        return {
          response: makeResponse(200, { success: true, data: { message: `Nhận bonus ${chestId}` } }, url),
          durationMs: 4
        };
      }
      return {
        response: makeResponse(400, { success: false, data: { message: 'Chưa đủ yêu cầu nhận thưởng.' } }, url),
        durationMs: 4
      };
    }, { claimMonthlyBonus: true }));
    assert.deepEqual(bonusCalls, [1, 2, 3]);
    assert.deepEqual(result.data.monthlyBonus.claimed, [1, 2]);
    assert.equal(result.data.monthlyBonus.notEligibleFrom, 3);
  } finally {
    global.Date = originalDate;
  }
}

async function testRunnerIntegration() {
  const registry = new ModuleRegistry();
  registry.registerHandler('session_check', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('framework_diagnostic', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('diem_danh', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('te_le', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('phuc_loi', runWelfareHall);

  const manifest = registry.getManifest('phuc_loi');
  assert.equal(manifest.implementationState, 'ready');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(registry.listCatalog().find(item => item.code === 'phuc_loi').runnable, true);

  const recorded = [];
  const logs = [];
  const settingsRepository = {
    async getProfileSettings() {
      return [{ moduleCode: 'phuc_loi', enabled: true, config: { claimMonthlyBonus: false } }];
    },
    async recordResult(_profileId, moduleCode, result) { recorded.push({ moduleCode, result }); },
    async listEnabledRunnable() { return [{ moduleCode: 'phuc_loi' }]; }
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
        return { response: makeResponse(200, actionPage(), url), durationMs: 3 };
      }
      return {
        response: makeResponse(200, { success: true, data: { time: '10:00', chest_level: '3' } }, url),
        durationMs: 8
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
    websiteConfigService: { getTargetUrl() { return 'https://hoathinh3d.st/'; } }
  });

  const result = await runner.runModule('p1', 'phuc_loi', { trigger: 'manual' });
  assert.equal(result.state, 'success');
  assert.equal(result.outcome, 'waiting');
  assert.equal(result.data.chestLevel, 3);
  assert.equal(recorded[0].moduleCode, 'phuc_loi');
  assert(logs.some(log => log.action === 'MODULE_SUCCESS'));
}

async function main() {
  const parsed = parseHh3dActionContext(actionPage());
  assert.equal(parsed.actionMap.plTimer, 'timerHash10');
  assert.equal(parsed.actionMap.plOpen, 'openHash10');
  assert.equal(parsed.actionMap.plClaim, 'claimHash10');
  assert.equal(parsed.legacySecurity.get_next_time_pl, 'legacyTimer10');
  assert.equal(resolveHh3dAction('open_chest_pl', parsed.actionMap), 'openHash10');
  assert.equal(parseCountdownMs('07:33'), 453000);
  assert.equal(parseCountdownMs('01:02:03'), 3723000);
  assert.equal(parseCountdownMs('00:00'), 0);
  assert.equal(isLastTwoDaysInVietnam(new Date('2026-07-29T12:00:00+07:00')), false);
  assert.equal(isLastTwoDaysInVietnam(new Date('2026-07-30T12:00:00+07:00')), true);

  await testWaiting();
  await testOpenAndRefresh();
  await testComplete();
  await testContextRetry();
  await testLoginRequired();
  await testMonthlyBonus();
  await testRunnerIntegration();

  console.log(JSON.stringify({
    status: 'PASS',
    module: 'phuc_loi',
    page: '/phuc-loi-duong',
    endpoint: '/wp-content/themes/halimmovies-child/hh3d-ajax.php',
    timerAction: 'get_next_time_pl',
    openAction: 'open_chest_pl',
    bonusAction: 'claim_bonus_reward',
    dynamicActionMap: true,
    legacySecurityFallback: true,
    contextRetry: true,
    waitingState: true,
    chestOpen: true,
    monthlyBonusLastTwoDays: true,
    loginRequiredDetected: true,
    runnerIntegration: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
