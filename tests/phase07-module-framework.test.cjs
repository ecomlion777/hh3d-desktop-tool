const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hh3d-phase07-'));
let requestCount = 0;

class FakeSession {
  constructor(partition) {
    this.partition = partition;
    this.resolvedRule = 'DIRECT';
  }
  async setProxy() {}
  async forceReloadProxyConfig() {}
  async closeAllConnections() {}
  async resolveProxy() { return this.resolvedRule; }
  setPermissionRequestHandler() {}
  setPermissionCheckHandler() {}
  setDevicePermissionHandler() {}
}
const sessions = new Map();
const session = {
  fromPartition(partition) {
    if (!sessions.has(partition)) sessions.set(partition, new FakeSession(partition));
    return sessions.get(partition);
  }
};

class FakeIncoming extends EventEmitter {
  constructor(url) {
    super();
    this.statusCode = 200;
    this.url = url;
    this.headers = { 'content-type': ['application/json'] };
  }
  start() {
    queueMicrotask(() => {
      this.emit('data', Buffer.from('{"ip":"203.0.113.10"}'));
      this.emit('end');
    });
  }
}
class FakeRequest extends EventEmitter {
  constructor(options) { super(); this.options = options; this.aborted = false; }
  write() {}
  abort() { this.aborted = true; this.emit('abort'); }
  end() {
    requestCount += 1;
    queueMicrotask(() => {
      if (this.aborted) return;
      const incoming = new FakeIncoming(this.options.url);
      this.emit('response', incoming);
      incoming.start();
    });
  }
}
const net = { request(options) { return new FakeRequest(options); } };
const app = { getPath(name) { assert.equal(name, 'userData'); return tempRoot; }, isReady() { return true; } };
const safeStorage = {
  isEncryptionAvailable() { return true; },
  encryptString(value) { return Buffer.from(`enc:${value}`); },
  decryptString(buffer) { return buffer.toString().replace(/^enc:/, ''); }
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return { app, safeStorage, session, net };
  return originalLoad.apply(this, arguments);
};

const base = path.resolve(__dirname, '..', 'electron');
const JsonDatabase = require(`${base}/storage/JsonDatabase.cjs`);
const ProfileRepository = require(`${base}/storage/ProfileRepository.cjs`);
const ProxySecretStore = require(`${base}/proxy/ProxySecretStore.cjs`);
const ProxyRepository = require(`${base}/proxy/ProxyRepository.cjs`);
const ProxySessionManager = require(`${base}/proxy/ProxySessionManager.cjs`);
const WorkerSettingsRepository = require(`${base}/worker/WorkerSettingsRepository.cjs`);
const WorkerLogRepository = require(`${base}/worker/WorkerLogRepository.cjs`);
const BatchRepository = require(`${base}/worker/BatchRepository.cjs`);
const WorkerHttpClient = require(`${base}/worker/WorkerHttpClient.cjs`);
const ProfileWorkerManager = require(`${base}/worker/ProfileWorkerManager.cjs`);
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleSettingsRepository = require(`${base}/modules/ModuleSettingsRepository.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const runSessionCheck = require(`${base}/modules/builtin/SessionCheckModule.cjs`);
const runFrameworkDiagnostic = require(`${base}/modules/builtin/FrameworkDiagnosticModule.cjs`);

async function waitFor(predicate, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for condition.');
}

async function main() {
  const dataDir = path.join(tempRoot, 'hh3d-data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'app-data.json'), JSON.stringify({
    schemaVersion: 3,
    updatedAt: new Date().toISOString(),
    profiles: [
      { id: 'p1', uid: 'U1', displayName: 'Profile 1', groupId: 'g1', group: 'Group', proxyId: null, status: 'stopped', enabledModules: ['daily_quest', 'dungeon'] },
      { id: 'p2', uid: 'U2', displayName: 'Profile 2', groupId: 'g1', group: 'Group', proxyId: null, status: 'stopped', enabledModules: [] }
    ],
    groups: [{ id: 'g1', name: 'Group', description: '', color: '#000' }],
    proxies: [],
    batches: [],
    logs: [],
    workerSettings: { maxConcurrency: 2, requestTimeoutMs: 3000, maxRetries: 0, retryDelayMs: 250, heartbeatIntervalMs: 500 },
    activityConfig: {},
    generalSettings: { websiteBaseUrl: 'https://hoathinh3d.co/', websiteAllowedHosts: ['hoathinh3d.co', 'hoathinh3d.st'] }
  }, null, 2));

  const db = new JsonDatabase();
  await db.init();
  assert.equal(db.getData().schemaVersion, 4);
  assert(Array.isArray(db.getData().moduleSettings));
  assert.deepEqual(db.getData().profiles.find(item => item.id === 'p1').enabledModules, []);

  const profileRepo = new ProfileRepository(db);
  const secretStore = new ProxySecretStore();
  await secretStore.init();
  const proxyRepo = new ProxyRepository(db, secretStore);
  const proxyManager = new ProxySessionManager({ profileRepo, proxyRepository: proxyRepo, proxySecretStore: secretStore });
  const settingsRepo = new WorkerSettingsRepository(db);
  const logRepo = new WorkerLogRepository(db);
  const batchRepo = new BatchRepository(db);
  const httpClient = new WorkerHttpClient({ proxySessionManager: proxyManager, settingsRepository: settingsRepo });

  const registry = new ModuleRegistry();
  registry.registerHandler('session_check', runSessionCheck);
  registry.registerHandler('framework_diagnostic', runFrameworkDiagnostic);
  const catalog = registry.listCatalog();
  assert(catalog.length >= 15);
  assert.equal(catalog.find(item => item.code === 'session_check').runnable, true);
  assert.equal(catalog.find(item => item.code === 'khoang_mach').implementationState, 'planned');
  assert.equal(catalog.find(item => item.code === 'khoang_mach').runnable, false);

  const moduleSettingsRepo = new ModuleSettingsRepository(db, profileRepo, registry);
  const events = [];
  const runner = new ModuleRunner({
    registry,
    settingsRepository: moduleSettingsRepo,
    profileRepo,
    httpClient,
    logRepository: logRepo,
    broadcastCallback(channel, payload) { events.push({ channel, payload }); }
  });

  const defaults = await moduleSettingsRepo.getProfileSettings('p1');
  assert.equal(defaults.find(item => item.moduleCode === 'session_check').enabled, true);
  assert.equal(defaults.find(item => item.moduleCode === 'framework_diagnostic').enabled, false);

  const applied = await moduleSettingsRepo.applyToProfiles(
    ['p1', 'p2'],
    ['daily_quest', 'dungeon', 'framework_diagnostic', 'khoang_mach'],
    'replace'
  );
  assert.equal(applied.updatedProfiles.length, 2);
  assert.deepEqual(applied.enabledModuleCodes.sort(), ['framework_diagnostic', 'khoang_mach'].sort());
  assert.deepEqual((await profileRepo.getProfileById('p1')).enabledModules.sort(), ['framework_diagnostic', 'khoang_mach'].sort());
  assert(db.getData().moduleSettings.some(item => item.profileId === 'p1' && item.moduleCode === 'khoang_mach' && item.enabled));

  const diagnostic = await runner.runModule('p1', 'framework_diagnostic', { trigger: 'manual' });
  assert.equal(diagnostic.state, 'success');
  assert.equal(requestCount, 0, 'Diagnostic module must not make a network request.');
  assert.equal(runner.getRuntimeStatus('p1', 'framework_diagnostic').state, 'success');

  // Activity Settings uses force=true for an explicit one-off diagnostic, so
  // a ready module can be tested without saving it as enabled first.
  await moduleSettingsRepo.applyToProfiles(['p2'], [], 'replace');
  const forcedDiagnostic = await runner.runModule('p2', 'framework_diagnostic', {
    trigger: 'manual',
    force: true
  });
  assert.equal(forcedDiagnostic.state, 'success');

  let plannedError;
  try { await runner.runModule('p1', 'khoang_mach', { trigger: 'manual' }); } catch (error) { plannedError = error; }
  assert(plannedError && plannedError.message.includes('MODULE_NOT_IMPLEMENTED'));
  assert.equal(requestCount, 0);

  const sessionResult = await runner.runModule('p1', 'session_check', { trigger: 'manual', force: true, timeoutMs: 3000 });
  assert.equal(sessionResult.httpStatus, 200);
  assert.equal(sessionResult.data.publicIp, '203.0.113.10');
  assert.equal(requestCount, 1);

  // Framework-level timeout must still reject even when a future handler
  // accidentally ignores AbortSignal.
  registry.registerManifest({
    code: 'timeout_probe',
    label: 'Timeout Probe',
    description: 'Test-only module.',
    category: 'test',
    version: '1.0.0',
    implementationState: 'ready',
    required: false,
    defaultEnabled: false,
    triggers: ['manual'],
    order: 9999,
    sourceVersion: 'test',
    defaultConfig: {}
  });
  registry.registerHandler('timeout_probe', async () => new Promise(() => {}));
  let timeoutError;
  try {
    await runner.runModule('p1', 'timeout_probe', { trigger: 'manual', force: true, timeoutMs: 1000 });
  } catch (error) {
    timeoutError = error;
  }
  assert(timeoutError && timeoutError.message.includes('MODULE_TIMEOUT'));
  assert.equal(runner.getRuntimeStatus('p1', 'timeout_probe').state, 'error');

  const worker = new ProfileWorkerManager({
    profileRepo,
    httpClient,
    logRepository: logRepo,
    batchRepository: batchRepo,
    settingsRepository: settingsRepo,
    moduleRunner: runner,
    broadcastCallback(channel, payload) { events.push({ channel, payload }); }
  });
  await worker.init();
  await worker.startProfiles(['p1']);
  await waitFor(() => worker.getStatus('p1').state === 'running');
  assert.equal(requestCount, 2, 'Worker start must run only the reviewed session_check network module.');
  await worker.stopProfiles(['p1']);
  await waitFor(() => worker.getSummary().activeCount === 0);

  assert(events.some(event => event.channel === 'modules:status-changed'));
  assert((await logRepo.listLogs()).some(log => log.action === 'MODULE_SUCCESS'));

  console.log(JSON.stringify({
    status: 'PASS',
    schemaVersion: db.getData().schemaVersion,
    catalogCount: catalog.length,
    runnableModules: catalog.filter(item => item.runnable).map(item => item.code),
    plannedModulesBlocked: true,
    bulkProfileSettings: true,
    diagnosticNoNetwork: true,
    workerUsesModuleRunner: true,
    requestCount
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
