const assert = require('assert/strict');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const runBlessingRedPacket = require(`${base}/modules/builtin/BlessingRedPacketModule.cjs`);

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

function contextPage(nonce = 'noncePhase11', token = 'tokenPhase11') {
  return `
    <html><body>Tiên Duyên</body>
    <script>
      const customRestNonce = "${nonce}";
      window.hh3dData = { "securityToken": "${token}" };
    </script></html>
  `;
}

function createContext(fetchImpl, config = {}) {
  return {
    profile: { id: 'p1', uid: 'U1', displayName: 'Profile 1' },
    manifest: { code: 'chuc_phuc', label: 'Chúc Phúc' },
    config: {
      roomDelayMs: 0,
      checkIntervalMinutes: 30,
      retrySecurityContextOnce: true,
      receiveRedPackets: true,
      processHongNhan: true,
      ...config
    },
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

function parseJsonBody(init) {
  return JSON.parse(String(init.body || '{}'));
}

async function testDaoLuBlessingAndRedPacket() {
  const actions = [];
  const result = await runBlessingRedPacket(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage(), url), durationMs: 3 };
    }

    const body = parseJsonBody(init);
    actions.push({ url, body });
    if (body.action === 'show_all_wedding') {
      assert.equal(body.security_token, 'tokenPhase11');
      assert.equal(init.headers['X-WP-Nonce'], 'noncePhase11');
      return {
        response: makeResponse(200, {
          success: true,
          data: [
            {
              wedding_room_id: 101,
              room_type: 'dao_lu',
              user1_name: 'A',
              user2_name: 'B',
              has_blessed: false,
              has_li_xi: true
            },
            {
              wedding_room_id: 102,
              room_type: 'dao_lu',
              has_blessed: true,
              has_li_xi: false
            }
          ]
        }, url),
        durationMs: 5
      };
    }
    if (body.action === 'hh3d_add_blessing') {
      assert.equal(body.wedding_room_id, '101');
      assert.match(body.message, /Chúc phúc/);
      return {
        response: makeResponse(200, { success: true, message: 'Chúc phúc thành công' }, url),
        durationMs: 7
      };
    }
    if (body.action === 'hh3d_receive_li_xi') {
      assert.equal(body.wedding_room_id, '101');
      return {
        response: makeResponse(200, {
          success: true,
          message: 'Nhận lì xì thành công',
          data: { amount: 50, name: 'Xu' }
        }, url),
        durationMs: 8
      };
    }
    throw new Error(`Unexpected action ${body.action}`);
  }));

  assert.equal(result.outcome, 'success');
  assert.equal(result.data.totalRooms, 2);
  assert.equal(result.data.processedRooms, 2);
  assert.equal(result.data.blessingsSent, 1);
  assert.equal(result.data.redPacketsReceived, 1);
  assert.deepEqual(result.data.rewards, [{ amount: 50, name: 'Xu' }]);
  assert.match(result.summary, /1 lời chúc/);
  assert.match(result.summary, /1 lì xì/);
  assert.match(result.summary, /50 Xu/);
  assert(result.nextRunAt);
  const nextMs = Date.parse(result.nextRunAt) - Date.now();
  assert(nextMs > 29 * 60_000 && nextMs <= 31 * 60_000);
  assert.equal(actions.length, 3);
}

async function testHongNhanUsesDedicatedEndpoint() {
  let hongNhanCalls = 0;
  const result = await runBlessingRedPacket(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage('nonceHong11', 'tokenHong11'), url), durationMs: 3 };
    }

    const body = parseJsonBody(init);
    if (body.action === 'show_all_wedding') {
      return {
        response: makeResponse(200, {
          success: true,
          data: [{
            wedding_room_id: 'HN-11',
            room_type: 'hong_nhan',
            has_blessed: true,
            has_li_xi: false,
            nguyen_chu_name: 'Nguyên Chủ',
            hong_nhan_name: 'Hồng Nhan'
          }]
        }, url),
        durationMs: 4
      };
    }

    assert.equal(url, 'https://hoathinh3d.st/wp-json/hh3d/v1/hong-nhan/bless');
    assert.equal(body.wedding_room_id, 'HN-11');
    assert.match(body.message, /hồng duyên/i);
    hongNhanCalls += 1;
    return {
      response: makeResponse(200, { success: true, message: 'Chúc phúc Hồng Nhan thành công' }, url),
      durationMs: 6
    };
  }));

  assert.equal(hongNhanCalls, 1);
  assert.equal(result.data.hongNhanRooms, 1);
  assert.equal(result.data.blessingsSent, 1);
}

async function testAlreadyCompletedIsBenign() {
  const result = await runBlessingRedPacket(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage(), url), durationMs: 2 };
    }
    const body = parseJsonBody(init);
    if (body.action === 'show_all_wedding') {
      return {
        response: makeResponse(200, {
          success: true,
          data: [{ wedding_room_id: 201, has_blessed: false, has_li_xi: true }]
        }, url),
        durationMs: 3
      };
    }
    if (body.action === 'hh3d_add_blessing') {
      return {
        response: makeResponse(400, { success: false, message: 'Bạn đã chúc phúc phòng này rồi' }, url),
        durationMs: 3
      };
    }
    return {
      response: makeResponse(400, { success: false, message: 'Bạn đã nhận lì xì trước đó rồi' }, url),
      durationMs: 3
    };
  }));

  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.blessingsAlreadyDone, 1);
  assert.equal(result.data.redPacketsAlreadyDone, 1);
  assert.equal(result.data.blessingFailures, 0);
  assert.equal(result.data.redPacketFailures, 0);
}

async function testNoRooms() {
  const result = await runBlessingRedPacket(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return { response: makeResponse(200, contextPage(), url), durationMs: 2 };
    }
    return {
      response: makeResponse(200, { data: [] }, url),
      durationMs: 3
    };
  }));

  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.totalRooms, 0);
  assert.match(result.summary, /Không có phòng cưới mới/);
}

async function testContextRetry() {
  let getCount = 0;
  let listCount = 0;
  const result = await runBlessingRedPacket(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      getCount += 1;
      return {
        response: makeResponse(200, contextPage(`nonce${getCount}Phase11`, `token${getCount}Phase11`), url),
        durationMs: 2
      };
    }

    const body = parseJsonBody(init);
    assert.equal(body.action, 'show_all_wedding');
    listCount += 1;
    if (listCount === 1) {
      assert.equal(init.headers['X-WP-Nonce'], 'nonce1Phase11');
      return {
        response: makeResponse(403, { success: false, message: 'Nonce không hợp lệ hoặc đã hết hạn' }, url),
        durationMs: 3
      };
    }
    assert.equal(init.headers['X-WP-Nonce'], 'nonce2Phase11');
    assert.equal(body.security_token, 'token2Phase11');
    return {
      response: makeResponse(200, { success: true, data: [] }, url),
      durationMs: 3
    };
  }));

  assert.equal(result.outcome, 'already_done');
  assert.equal(getCount, 2);
  assert.equal(listCount, 2);
}

async function testLoginRequired() {
  let error;
  try {
    await runBlessingRedPacket(createContext(async (_profile, url) => ({
      response: makeResponse(
        200,
        '<form id="loginform"><input name="user_login"></form>',
        'https://hoathinh3d.st/wp-login.php'
      ),
      durationMs: 3
    })));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'WORKER_LOGIN_REQUIRED');
}

async function testMissingSecurityContext() {
  let error;
  try {
    await runBlessingRedPacket(createContext(async (_profile, url) => ({
      response: makeResponse(200, '<html><body>Tiên Duyên</body></html>', url),
      durationMs: 3
    })));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'CHUC_PHUC_NONCE_NOT_FOUND');
}

async function testRunnerIntegrationAndOrder() {
  const registry = new ModuleRegistry();
  registry.registerHandler('chuc_phuc', runBlessingRedPacket);
  const manifest = registry.getManifest('chuc_phuc');
  assert.equal(manifest.implementationState, 'ready');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(registry.listCatalog().find(item => item.code === 'chuc_phuc').runnable, true);
  assert(manifest.order < registry.getManifest('diem_danh').order);
  assert(registry.getManifest('diem_danh').order < registry.getManifest('van_dap').order);
  assert(registry.getManifest('van_dap').order < registry.getManifest('te_le').order);
  assert(registry.getManifest('te_le').order < registry.getManifest('hoang_vuc').order);
  assert(registry.getManifest('hoang_vuc').order < registry.getManifest('thi_luyen').order);
  assert(registry.getManifest('thi_luyen').order < registry.getManifest('phuc_loi').order);

  const recorded = [];
  const logs = [];
  const settingsRepository = {
    async getProfileSettings() {
      return [{ moduleCode: 'chuc_phuc', enabled: true, config: { roomDelayMs: 0 } }];
    },
    async recordResult(_profileId, moduleCode, result) {
      recorded.push({ moduleCode, result });
    }
  };
  const profileRepo = {
    async getProfileById() { return { id: 'p1', uid: 'U1', displayName: 'Profile 1' }; }
  };
  const httpClient = {
    buildWebsiteUrl(relativePath) {
      return new URL(relativePath, 'https://hoathinh3d.st/').toString();
    },
    async fetch(_profile, url, init) {
      if ((init.method || 'GET') === 'GET') {
        return { response: makeResponse(200, contextPage(), url), durationMs: 2 };
      }
      return {
        response: makeResponse(200, { success: true, data: [] }, url),
        durationMs: 3
      };
    }
  };
  const logRepository = {
    async append(log) { logs.push(log); return log; },
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

  const result = await runner.runModule('p1', 'chuc_phuc', {
    trigger: 'manual',
    force: true,
    timeoutMs: 5000
  });
  assert.equal(result.state, 'success');
  assert.equal(result.moduleCode, 'chuc_phuc');
  assert.equal(recorded.length, 1);
  assert(logs.some(log => log.action === 'MODULE_SUCCESS'));
}

async function main() {
  await testDaoLuBlessingAndRedPacket();
  await testHongNhanUsesDedicatedEndpoint();
  await testAlreadyCompletedIsBenign();
  await testNoRooms();
  await testContextRetry();
  await testLoginRequired();
  await testMissingSecurityContext();
  await testRunnerIntegrationAndOrder();

  console.log(JSON.stringify({
    status: 'PASS',
    module: 'chuc_phuc',
    page: '/tien-duyen',
    listAction: 'show_all_wedding',
    blessingAction: 'hh3d_add_blessing',
    hongNhanEndpoint: '/wp-json/hh3d/v1/hong-nhan/bless',
    redPacketAction: 'hh3d_receive_li_xi',
    daoLuBlessing: true,
    hongNhanBlessing: true,
    redPacketReceiving: true,
    contextRetry: true,
    recurringCheckMinutes: 30,
    defaultOrderBeforeDailyCheckin: true,
    runnerIntegration: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
