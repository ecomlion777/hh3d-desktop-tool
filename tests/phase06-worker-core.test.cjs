const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hh3d-phase06-'));
let fetchCount = 0;

class FakeSession {
  constructor(partition) {
    this.partition = partition;
    this.proxyConfig = { mode: 'direct' };
    this.resolvedRule = 'DIRECT';
    this.fetchMode = 'ok';
  }
  async setProxy(config) { this.proxyConfig = config; }
  async forceReloadProxyConfig() {}
  async closeAllConnections() {}
  async resolveProxy() { return this.resolvedRule; }
  setPermissionRequestHandler() {}
  setPermissionCheckHandler() {}
  setDevicePermissionHandler() {}
  async clearStorageData() {}
  async clearCache() {}
  flushStorageData() {}
}

const sessions = new Map();
const session = {
  fromPartition(partition) {
    if (!sessions.has(partition)) sessions.set(partition, new FakeSession(partition));
    return sessions.get(partition);
  }
};

class FakeIncomingMessage extends EventEmitter {
  constructor({ statusCode = 200, url, body = '<html>ok</html>' }) {
    super();
    this.statusCode = statusCode;
    this.url = url;
    this.headers = { 'content-type': ['text/html'] };
    this.body = Buffer.from(body);
  }
  start() {
    queueMicrotask(() => {
      this.emit('data', this.body);
      this.emit('end');
    });
  }
}

class FakeClientRequest extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.body = [];
    this.aborted = false;
  }
  write(chunk) { this.body.push(Buffer.from(chunk)); }
  abort() {
    if (this.aborted) return;
    this.aborted = true;
    queueMicrotask(() => {
      this.emit('abort');
      this.emit('close');
    });
  }
  end() {
    if (this.aborted) return;
    fetchCount += 1;
    const ses = this.options.session;
    queueMicrotask(() => {
      if (this.aborted) return;
      if (ses.fetchMode === 'error') {
        this.emit('error', new Error('ERR_CONNECTION_FAILED'));
        this.emit('close');
        return;
      }

      const deliverResponse = () => {
        if (this.aborted) return;
        const incoming = new FakeIncomingMessage({
          statusCode: ses.fetchMode === 'login' ? 403 : 200,
          url: this.options.url
        });
        this.emit('response', incoming);
        incoming.once('end', () => this.emit('close'));
        incoming.start();
      };

      if (ses.proxyAuthChallenge) {
        this.emit('login', {
          isProxy: true,
          host: ses.proxyAuthChallenge.host,
          port: ses.proxyAuthChallenge.port,
          scheme: 'basic',
          realm: 'proxy'
        }, (username, password) => {
          if (
            username === ses.proxyAuthChallenge.username &&
            password === ses.proxyAuthChallenge.password
          ) {
            deliverResponse();
          } else {
            const incoming = new FakeIncomingMessage({
              statusCode: 407,
              url: this.options.url,
              body: 'proxy auth required'
            });
            this.emit('response', incoming);
            incoming.start();
          }
        });
        return;
      }

      deliverResponse();
    });
  }
}

const net = {
  request(options) {
    return new FakeClientRequest(options);
  }
};

const app = {
  getPath(name) {
    assert.equal(name, 'userData');
    return tempRoot;
  },
  isReady() { return true; }
};

const safeStorage = {
  isEncryptionAvailable() { return true; },
  encryptString(value) { return Buffer.from(`enc:${value}`, 'utf8'); },
  decryptString(buffer) {
    const raw = buffer.toString('utf8');
    if (!raw.startsWith('enc:')) throw new Error('invalid ciphertext');
    return raw.slice(4);
  }
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
const WorkerLogRepository = require(`${base}/worker/WorkerLogRepository.cjs`);
const WorkerSettingsRepository = require(`${base}/worker/WorkerSettingsRepository.cjs`);
const BatchRepository = require(`${base}/worker/BatchRepository.cjs`);
const WorkerHttpClient = require(`${base}/worker/WorkerHttpClient.cjs`);
const ProfileWorkerManager = require(`${base}/worker/ProfileWorkerManager.cjs`);
const ModuleRegistry = require(`${base}/modules/ModuleRegistry.cjs`);
const ModuleSettingsRepository = require(`${base}/modules/ModuleSettingsRepository.cjs`);
const ModuleRunner = require(`${base}/modules/ModuleRunner.cjs`);
const runSessionCheck = require(`${base}/modules/builtin/SessionCheckModule.cjs`);
const runFrameworkDiagnostic = require(`${base}/modules/builtin/FrameworkDiagnosticModule.cjs`);
const { getPartitionForProfile } = require(`${base}/browser/browserValidation.cjs`);

async function waitFor(predicate, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for condition.');
}

async function main() {
  const dataDir = path.join(tempRoot, 'hh3d-data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'app-data.json'), JSON.stringify({
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    groups: [{ id: 'g1', name: 'Group 1', description: '', color: '#000' }],
    proxies: [],
    profiles: [
      { id: 'p1', uid: 'U1', displayName: 'P1', groupId: 'g1', group: 'Group 1', proxyId: null, status: 'stopped' },
      { id: 'p2', uid: 'U2', displayName: 'P2', groupId: 'g1', group: 'Group 1', proxyId: null, status: 'stopped' }
    ]
  }, null, 2));

  const db = new JsonDatabase();
  await db.init();
  assert.equal(db.getData().schemaVersion, 4);
  assert(Array.isArray(db.getData().moduleSettings));
  assert(Array.isArray(db.getData().batches));
  assert(Array.isArray(db.getData().logs));
  assert.equal(db.getData().workerSettings.maxConcurrency, 40);
  assert.equal(fetchCount, 0, 'Worker must not make requests at startup.');

  const profileRepo = new ProfileRepository(db);
  const secretStore = new ProxySecretStore();
  await secretStore.init();
  const proxyRepo = new ProxyRepository(db, secretStore);
  const proxyManager = new ProxySessionManager({
    profileRepo,
    proxyRepository: proxyRepo,
    proxySecretStore: secretStore
  });
  const settingsRepo = new WorkerSettingsRepository(db);
  await settingsRepo.saveWorkerSettings({
    maxConcurrency: 1,
    requestTimeoutMs: 3000,
    maxRetries: 0,
    retryDelayMs: 250,
    heartbeatIntervalMs: 1000
  });
  const logRepo = new WorkerLogRepository(db);
  const batchRepo = new BatchRepository(db);
  const httpClient = new WorkerHttpClient({
    proxySessionManager: proxyManager,
    settingsRepository: settingsRepo
  });
  const moduleRegistry = new ModuleRegistry();
  moduleRegistry.registerHandler('session_check', runSessionCheck);
  moduleRegistry.registerHandler('framework_diagnostic', runFrameworkDiagnostic);
  const moduleSettingsRepo = new ModuleSettingsRepository(db, profileRepo, moduleRegistry);
  const events = [];
  const moduleRunner = new ModuleRunner({
    registry: moduleRegistry,
    settingsRepository: moduleSettingsRepo,
    profileRepo,
    httpClient,
    logRepository: logRepo,
    broadcastCallback(channel, payload) { events.push({ channel, payload }); }
  });
  const worker = new ProfileWorkerManager({
    profileRepo,
    httpClient,
    logRepository: logRepo,
    batchRepository: batchRepo,
    settingsRepository: settingsRepo,
    moduleRunner,
    broadcastCallback(channel, payload) {
      events.push({ channel, payload });
    }
  });
  await worker.init();

  const startResult = await worker.startProfiles(['p1', 'p2']);
  assert.equal(startResult.accepted, 2);

  await waitFor(() => worker.getStatus('p1').state === 'running');
  assert.equal(worker.getStatus('p2').state, 'queued');
  assert.equal(worker.getSummary().activeCount, 1);
  assert.equal(fetchCount, 1);

  await worker.stopProfiles(['p1']);
  await waitFor(() => worker.getStatus('p2').state === 'running');
  assert.equal(fetchCount, 2);
  await worker.stopProfiles(['p2']);
  await waitFor(() => worker.getSummary().activeCount === 0);
  assert.equal((await profileRepo.getProfileById('p1')).status, 'stopped');
  assert((await logRepo.listLogs()).some(log => log.action === 'WORKER_READY'));

  const batch = await batchRepo.create({
    name: 'Phase06 Batch',
    profileIds: ['p1', 'p2'],
    concurrency: 1,
    activityType: 'Worker Core Session Check'
  });
  await worker.startBatch(batch.id);
  await waitFor(() => worker.getStatus('p1').state === 'running');
  assert.equal(worker.getStatus('p2').state, 'queued');
  await worker.stopBatch(batch.id);
  assert.equal((await batchRepo.getById(batch.id)).status, 'Cancelled');

  const proxy = await proxyRepo.createProxy({
    name: 'Broken Proxy',
    protocol: 'http',
    host: '127.0.0.1',
    port: 1,
    enabled: true,
    authRequired: false,
    notes: ''
  });
  await proxyRepo.assignProxyToProfiles(['p1'], proxy.id);
  const proxySession = session.fromPartition(getPartitionForProfile('p1'));
  proxySession.resolvedRule = 'DIRECT';

  await worker.startProfiles(['p1']);
  await waitFor(() => worker.getStatus('p1').state === 'proxy_error');
  assert.equal((await profileRepo.getProfileById('p1')).status, 'proxy_error');
  assert.equal(worker.getSummary().activeCount, 0);

  // Authenticated proxy requests use net.request with the same persistent
  // session and provide credentials only to a proxy authentication challenge.
  const authProxy = await proxyRepo.createProxy({
    name: 'Authenticated Proxy',
    protocol: 'http',
    host: '127.0.0.2',
    port: 8080,
    enabled: true,
    authRequired: true,
    username: 'worker-user',
    password: 'worker-pass',
    notes: ''
  });
  await proxyRepo.assignProxyToProfiles(['p2'], authProxy.id);
  const authSession = session.fromPartition(getPartitionForProfile('p2'));
  authSession.resolvedRule = 'PROXY 127.0.0.2:8080';
  authSession.proxyAuthChallenge = {
    host: '127.0.0.2',
    port: 8080,
    username: 'worker-user',
    password: 'worker-pass'
  };

  await worker.startProfiles(['p2']);
  await waitFor(() => worker.getStatus('p2').state === 'running');
  assert.equal(worker.getStatus('p2').lastHttpStatus, 200);
  await worker.stopProfiles(['p2']);
  await waitFor(() => worker.getSummary().activeCount === 0);

  const activity = await settingsRepo.saveActivityConfig({
    ...settingsRepo.getActivityConfig(),
    maxConcurrentProfiles: 12,
    delayBetweenActions: 3
  });
  assert.equal(activity.maxConcurrentProfiles, 12);
  assert.equal(settingsRepo.getWorkerSettings().maxConcurrency, 12);

  assert(events.some(event => event.channel === 'workers:status-changed'));
  assert(events.some(event => event.channel === 'profiles:changed'));
  assert(!JSON.stringify(db.getData()).includes('plaintext-secret'));

  console.log(JSON.stringify({
    status: 'PASS',
    schemaVersion: db.getData().schemaVersion,
    moduleFramework: true,
    fetchCount,
    logs: db.getData().logs.length,
    batches: db.getData().batches.length,
    concurrencyQueue: true,
    proxyDirectFallbackBlocked: true,
    authenticatedProxyWorker: true,
    startupNetworkRequests: 0
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
