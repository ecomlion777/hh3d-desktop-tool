const assert = require('assert/strict');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const runClanWorship = require(`${base}/modules/builtin/ClanWorshipModule.cjs`);
const { extractSecurityToken } = require(`${base}/modules/helpers/securityToken.cjs`);

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
    manifest: { code: 'te_le', label: 'Tế Lễ' },
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

function memberPage(nonce, token) {
  return `
    <html><body>
      <script>
        const customRestNonce = "${nonce}";
        const hh3dData = { securityToken: "${token}" };
      </script>
    </body></html>
  `;
}

async function testSuccess() {
  const calls = [];
  const result = await runClanWorship(createContext(async (_profile, url, init) => {
    calls.push({ url, init });
    if ((init.method || 'GET') === 'GET') {
      return {
        response: makeResponse(200, memberPage('nonceABC123', 'securityTOKEN123'), url),
        durationMs: 10
      };
    }

    assert.equal(url, 'https://hoathinh3d.st/wp-json/tong-mon/v1/te-le-tong-mon');
    assert.equal(init.headers['X-WP-Nonce'], 'nonceABC123');
    assert.equal(init.headers.security_token, 'securityTOKEN123');
    assert.equal(init.headers.Referer, 'https://hoathinh3d.st/danh-sach-thanh-vien-tong-mon');
    assert.deepEqual(JSON.parse(init.body), {
      action: 'te_le_tong_mon',
      security_token: 'securityTOKEN123'
    });

    return {
      response: makeResponse(200, {
        success: true,
        message: 'Tế lễ thành công',
        cong_hien_points: 20
      }, url),
      durationMs: 31
    };
  }));

  assert.equal(result.outcome, 'success');
  assert.equal(result.httpStatus, 200);
  assert.equal(result.data.contributionPoints, 20);
  assert.equal(result.data.alreadyDone, false);
  assert.match(result.summary, /20 cống hiến/);
  assert.equal(calls.length, 2);
}

async function testAlreadyDone() {
  const result = await runClanWorship(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      return {
        response: makeResponse(200, memberPage('nonceDONE1', 'tokenDONE1'), url),
        durationMs: 5
      };
    }
    return {
      response: makeResponse(400, {
        success: false,
        message: 'Bạn đã tế lễ hôm nay rồi'
      }, url),
      durationMs: 9
    };
  }));

  assert.equal(result.outcome, 'already_done');
  assert.equal(result.data.alreadyDone, true);
}

async function testContextRetry() {
  let getCount = 0;
  let postCount = 0;

  const result = await runClanWorship(createContext(async (_profile, url, init) => {
    if ((init.method || 'GET') === 'GET') {
      getCount += 1;
      return {
        response: makeResponse(
          200,
          memberPage(
            getCount === 1 ? 'oldNonce09' : 'newNonce09',
            getCount === 1 ? 'oldToken09' : 'newToken09'
          ),
          url
        ),
        durationMs: 4
      };
    }

    postCount += 1;
    if (postCount === 1) {
      assert.equal(init.headers['X-WP-Nonce'], 'oldNonce09');
      assert.equal(init.headers.security_token, 'oldToken09');
      return {
        response: makeResponse(403, {
          success: false,
          message: 'security_token không hợp lệ hoặc nonce đã hết hạn'
        }, url),
        durationMs: 6
      };
    }

    assert.equal(init.headers['X-WP-Nonce'], 'newNonce09');
    assert.equal(init.headers.security_token, 'newToken09');
    return {
      response: makeResponse(200, {
        success: true,
        message: 'Tế lễ thành công',
        cong_hien_points: 15
      }, url),
      durationMs: 8
    };
  }));

  assert.equal(result.outcome, 'success');
  assert.equal(getCount, 2);
  assert.equal(postCount, 2);
}

async function testNonceFallbackToHome() {
  const calls = [];
  const result = await runClanWorship(createContext(async (_profile, url, init) => {
    calls.push(url);
    if ((init.method || 'GET') === 'GET' && url.includes('danh-sach-thanh-vien-tong-mon')) {
      return {
        response: makeResponse(200, '<input name="security_token" value="TOKEN-FROM-PAGE-09">', url),
        durationMs: 3
      };
    }
    if ((init.method || 'GET') === 'GET') {
      return {
        response: makeResponse(200, '<script>wpApiSettings={"nonce":"HOME-NONCE-09"}</script>', url),
        durationMs: 3
      };
    }
    assert.equal(init.headers['X-WP-Nonce'], 'HOME-NONCE-09');
    assert.equal(init.headers.security_token, 'TOKEN-FROM-PAGE-09');
    return {
      response: makeResponse(200, { success: true, message: 'Tế lễ thành công' }, url),
      durationMs: 7
    };
  }));

  assert.equal(result.outcome, 'success');
  assert.equal(calls.length, 3);
}

async function testSecurityTokenFallbackToHome() {
  const calls = [];
  const result = await runClanWorship(createContext(async (_profile, url, init) => {
    calls.push(url);

    if ((init.method || 'GET') === 'GET' && url.includes('danh-sach-thanh-vien-tong-mon')) {
      return {
        response: makeResponse(200, '<script>customRestNonce="MEMBER-NONCE-09"</script>', url),
        durationMs: 3
      };
    }

    if ((init.method || 'GET') === 'GET') {
      return {
        response: makeResponse(
          200,
          '<script>window.hh3dData={"securityToken":"HOME-CAMEL-TOKEN-09"};</script>',
          url
        ),
        durationMs: 3
      };
    }

    assert.equal(init.headers['X-WP-Nonce'], 'MEMBER-NONCE-09');
    assert.equal(init.headers.security_token, 'HOME-CAMEL-TOKEN-09');
    assert.equal(JSON.parse(init.body).security_token, 'HOME-CAMEL-TOKEN-09');

    return {
      response: makeResponse(200, { success: true, message: 'Tế lễ thành công' }, url),
      durationMs: 7
    };
  }));

  assert.equal(result.outcome, 'success');
  assert.equal(calls.length, 3);
}

async function testLoginRequired() {
  let error;
  try {
    await runClanWorship(createContext(async (_profile, url) => ({
      response: makeResponse(
        200,
        '<form id="loginform"><input name="user_login"></form>',
        'https://hoathinh3d.st/wp-login.php'
      ),
      durationMs: 4
    })));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'WORKER_LOGIN_REQUIRED');
}

async function testMissingSecurityToken() {
  let error;
  try {
    await runClanWorship(createContext(async (_profile, url) => ({
      response: makeResponse(200, 'customRestNonce="nonceWithoutToken"', url),
      durationMs: 4
    })));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'TE_LE_SECURITY_TOKEN_NOT_FOUND');
}

async function testNotInClan() {
  let error;
  try {
    await runClanWorship(createContext(async (_profile, url, init) => {
      if ((init.method || 'GET') === 'GET') {
        return {
          response: makeResponse(200, memberPage('nonceClan09', 'tokenClan09'), url),
          durationMs: 4
        };
      }
      return {
        response: makeResponse(400, {
          success: false,
          message: 'Bạn chưa gia nhập tông môn'
        }, url),
        durationMs: 6
      };
    }));
  } catch (caught) {
    error = caught;
  }
  assert(error);
  assert.equal(error.code, 'TE_LE_NOT_IN_CLAN');
}

async function testRunnerIntegration() {
  const registry = new ModuleRegistry();
  registry.registerHandler('session_check', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('framework_diagnostic', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('diem_danh', async () => ({ outcome: 'success', summary: 'ok' }));
  registry.registerHandler('te_le', runClanWorship);

  const manifest = registry.getManifest('te_le');
  assert.equal(manifest.implementationState, 'ready');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(registry.listCatalog().find(item => item.code === 'te_le').runnable, true);

  const recorded = [];
  const logs = [];
  const settingsRepository = {
    async getProfileSettings() {
      return [{ moduleCode: 'te_le', enabled: true, config: {} }];
    },
    async recordResult(_profileId, moduleCode, result) {
      recorded.push({ moduleCode, result });
    },
    async listEnabledRunnable() {
      return [{ moduleCode: 'te_le' }];
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
        return {
          response: makeResponse(200, memberPage('runnerNonce09', 'runnerToken09'), url),
          durationMs: 3
        };
      }
      return {
        response: makeResponse(200, {
          success: true,
          message: 'Tế lễ thành công',
          cong_hien_points: 25
        }, url),
        durationMs: 12
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

  const result = await runner.runModule('p1', 'te_le', { trigger: 'manual' });
  assert.equal(result.state, 'success');
  assert.equal(result.outcome, 'success');
  assert.equal(result.data.contributionPoints, 25);
  assert.equal(recorded[0].moduleCode, 'te_le');
  assert(logs.some(log => log.action === 'MODULE_SUCCESS'));
}

async function main() {
  assert.equal(
    extractSecurityToken('const config={security_token:"abcTOKEN123"};'),
    'abcTOKEN123'
  );
  assert.equal(
    extractSecurityToken('window.hh3dData={"securityToken":"camelTOKEN456"};'),
    'camelTOKEN456'
  );
  assert.equal(
    extractSecurityToken('window.payload={\"securityToken\":\"escapedTOKEN789\"};'),
    'escapedTOKEN789'
  );
  assert.equal(
    extractSecurityToken('&quot;securityToken&quot;:&quot;entityTOKEN012&quot;'),
    'entityTOKEN012'
  );
  assert.equal(
    extractSecurityToken('<input value="inputTOKEN456" name="security_token">'),
    'inputTOKEN456'
  );
  assert.equal(
    extractSecurityToken('<div data-security-token="dataTOKEN789"></div>'),
    'dataTOKEN789'
  );

  await testSuccess();
  await testAlreadyDone();
  await testContextRetry();
  await testNonceFallbackToHome();
  await testSecurityTokenFallbackToHome();
  await testLoginRequired();
  await testMissingSecurityToken();
  await testNotInClan();
  await testRunnerIntegration();

  console.log(JSON.stringify({
    status: 'PASS',
    module: 'te_le',
    endpoint: '/wp-json/tong-mon/v1/te-le-tong-mon',
    action: 'te_le_tong_mon',
    securityTokenExtraction: true,
    camelCaseSecurityToken: true,
    homepageTokenFallback: true,
    nonceExtraction: true,
    securityContextRetry: true,
    alreadyDoneAccepted: true,
    loginRequiredDetected: true,
    clanMembershipErrorDetected: true,
    runnerIntegration: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
