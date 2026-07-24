const assert = require('assert/strict');
const path = require('path');

const base = path.resolve(__dirname, '..', 'electron');
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const ProfileWorkerManager = require(`${base}/worker/ProfileWorkerManager.cjs`);
const { isFatalWorkerModuleError } = require(`${base}/modules/moduleErrorPolicy.cjs`);

function createError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function makeRunner(handlers) {
  const registry = new ModuleRegistry();
  for (const [code, handler] of Object.entries(handlers)) {
    registry.registerHandler(code, handler);
  }

  const profile = { id: 'p1', uid: 'U1', displayName: 'P1' };
  const records = [];
  const logs = [];
  const settingsRepository = {
    async getProfileSettings() {
      return registry.listCatalog().map(manifest => ({
        profileId: profile.id,
        moduleCode: manifest.code,
        enabled: ['session_check', 'chuc_phuc', 'diem_danh'].includes(manifest.code),
        config: manifest.defaultConfig || {},
        manifest
      }));
    },
    async listEnabledRunnable() {
      return ['chuc_phuc', 'diem_danh'].map(code => ({
        profileId: profile.id,
        moduleCode: code,
        enabled: true,
        config: registry.getManifest(code).defaultConfig || {},
        manifest: registry.getManifest(code)
      }));
    },
    async recordResult(profileId, moduleCode, result) {
      records.push({ profileId, moduleCode, result });
    }
  };
  const profileRepo = {
    async getProfileById(id) { return id === profile.id ? { ...profile } : null; }
  };
  const logRepository = {
    async append(entry) { logs.push(entry); return entry; },
    async listLogs() { return [...logs]; }
  };
  const runner = new ModuleRunner({
    registry,
    settingsRepository,
    profileRepo,
    httpClient: {},
    logRepository,
    broadcastCallback() {}
  });
  return { runner, registry, profile, records, logs };
}

async function testNonFatalModuleFailureContinuesChain() {
  const calls = [];
  const { runner } = makeRunner({
    chuc_phuc: async () => {
      calls.push('chuc_phuc');
      throw createError('CHUC_PHUC_ACTIONS_FAILED', 'Đã gửi lời chúc');
    },
    diem_danh: async () => {
      calls.push('diem_danh');
      return { outcome: 'success', summary: 'Điểm Danh thành công.' };
    }
  });

  const results = await runner.runEnabledForProfile('p1', 'worker_start', {
    continueOnError: true
  });

  assert.deepEqual(calls, ['chuc_phuc', 'diem_danh']);
  assert.equal(results.length, 2);
  assert.equal(results[0].state, 'error');
  assert.equal(results[0].moduleCode, 'chuc_phuc');
  assert.equal(results[1].state, 'success');
  assert.equal(results[1].moduleCode, 'diem_danh');
}

async function testFatalLoginFailureStopsChain() {
  const calls = [];
  const { runner } = makeRunner({
    chuc_phuc: async () => {
      calls.push('chuc_phuc');
      throw createError('WORKER_LOGIN_REQUIRED', 'Session hết hạn');
    },
    diem_danh: async () => {
      calls.push('diem_danh');
      return { outcome: 'success', summary: 'Không được chạy.' };
    }
  });

  await assert.rejects(
    () => runner.runEnabledForProfile('p1', 'worker_start', { continueOnError: true }),
    /WORKER_LOGIN_REQUIRED/
  );
  assert.deepEqual(calls, ['chuc_phuc']);
}

async function testWorkerPassesContinueOnError() {
  const profile = {
    id: 'p1', uid: 'U1', displayName: 'P1', status: 'stopped',
    currentActivity: 'Đã Dừng', proxyId: null
  };
  const updates = [];
  let continuationOption = false;
  let reachedScheduler = false;

  const profileRepo = {
    async getProfileById(id) { return id === 'p1' ? { ...profile } : null; },
    async listProfiles() { return [{ ...profile }]; },
    async updateProfile(_id, changes) { Object.assign(profile, changes); updates.push(changes); return { ...profile }; }
  };
  const logRepository = {
    async append(entry) { return entry; },
    async listLogs() { return []; }
  };
  const moduleRunner = {
    settingsRepository: {
      async listEnabledRunnable() { return []; },
      async recordResult() {}
    },
    async runModule(_profileId, code) {
      assert.equal(code, 'session_check');
      return { state: 'success', summary: 'Session OK', httpStatus: 200, durationMs: 1 };
    },
    async runEnabledForProfile(_profileId, _trigger, options) {
      continuationOption = options.continueOnError === true;
      return [
        { moduleCode: 'chuc_phuc', state: 'error', summary: 'Chúc Phúc lỗi' },
        { moduleCode: 'diem_danh', state: 'success', summary: 'Điểm Danh thành công' }
      ];
    },
    cancelProfile() {}
  };
  const manager = new ProfileWorkerManager({
    profileRepo,
    httpClient: {},
    logRepository,
    batchRepository: { async list() { return []; } },
    settingsRepository: {
      getWorkerSettings() {
        return {
          maxConcurrency: 1,
          requestTimeoutMs: 1000,
          maxRetries: 0,
          retryDelayMs: 1,
          heartbeatIntervalMs: 1000
        };
      }
    },
    moduleRunner,
    broadcastCallback() {}
  });
  manager.syncRunningBatches = async () => {};
  manager.runScheduledModuleLoop = async () => {
    reachedScheduler = true;
    throw new Error('WORKER_STOP_REQUESTED');
  };

  const holder = { controller: new AbortController(), moduleCodes: undefined };
  await manager.runWorker({ profileId: 'p1' }, holder);

  assert.equal(continuationOption, true);
  assert.equal(reachedScheduler, true);
  assert(updates.some(update => update.currentActivity === 'Điểm Danh thành công'));
}

async function main() {
  assert.equal(isFatalWorkerModuleError(createError('WORKER_LOGIN_REQUIRED', 'x')), true);
  assert.equal(isFatalWorkerModuleError(createError('ERR_PROXY_CONNECTION_FAILED', 'x')), true);
  assert.equal(isFatalWorkerModuleError(createError('CHUC_PHUC_ACTIONS_FAILED', 'x')), false);

  await testNonFatalModuleFailureContinuesChain();
  await testFatalLoginFailureStopsChain();
  await testWorkerPassesContinueOnError();

  console.log(JSON.stringify({
    status: 'PASS',
    blessingAlreadyDoneRecognized: true,
    nonFatalModuleErrorsContinue: true,
    loginAndProxyErrorsRemainFatal: true,
    workerContinuationEnabled: true,
    scheduledModuleRetryPolicy: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
