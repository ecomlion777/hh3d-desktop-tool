const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const Module = require('module');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hh3d-phase05-'));

class FakeSession {
  constructor(partition) {
    this.partition = partition;
    this.proxyConfig = null;
    this.resolvedRule = 'DIRECT';
    this.closedConnections = 0;
  }
  async setProxy(config) { this.proxyConfig = config; }
  async forceReloadProxyConfig() {}
  async closeAllConnections() { this.closedConnections += 1; }
  async resolveProxy() { return this.resolvedRule; }
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
const app = {
  getPath(name) { assert.equal(name, 'userData'); return tempRoot; },
  isReady() { return true; }
};
const safeStorage = {
  isEncryptionAvailable() { return true; },
  encryptString(value) { return Buffer.from(`enc:${value}`, 'utf8'); },
  decryptString(buffer) {
    const value = buffer.toString('utf8');
    if (!value.startsWith('enc:')) throw new Error('bad ciphertext');
    return value.slice(4);
  }
};
const net = {
  request() { throw new Error('not used in this test'); }
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return { app, safeStorage, session, net };
  return originalLoad.apply(this, arguments);
};

const base = path.resolve(__dirname, '..', 'electron');
const JsonDatabase = require(`${base}/storage/JsonDatabase.cjs`);
const ProxySecretStore = require(`${base}/proxy/ProxySecretStore.cjs`);
const ProxyRepository = require(`${base}/proxy/ProxyRepository.cjs`);
const ProxySessionManager = require(`${base}/proxy/ProxySessionManager.cjs`);
const { buildProxyRules } = require(`${base}/proxy/proxyRules.cjs`);
const { validateProxyInput } = require(`${base}/proxy/proxyValidation.cjs`);
const { getPartitionForProfile } = require(`${base}/browser/browserValidation.cjs`);

async function main() {
  // Validation and rule generation.
  const validated = validateProxyInput({ name: 'P1', protocol: 'socks5', host: '127.0.0.1', port: 1080, enabled: true });
  assert.equal(validated.protocol, 'socks5');
  assert.deepEqual(buildProxyRules(validated), {
    mode: 'fixed_servers',
    proxyRules: 'socks5://127.0.0.1:1080',
    proxyBypassRules: '<local>'
  });
  assert.throws(() => validateProxyInput({ name: 'bad', protocol: 'http', host: 'http://x', port: 80 }), /PROXY_INVALID_CONFIGURATION/);

  // Prepare a legacy v1 database with fake display-only proxy IDs.
  const dataDir = path.join(tempRoot, 'hh3d-data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'app-data.json'), JSON.stringify({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    groups: [{ id: 'g1', name: 'G1', description: '', color: '#000' }],
    profiles: [
      { id: 'p1', uid: 'U1', groupId: 'g1', group: 'G1', proxyId: 'proxy_1' },
      { id: 'p2', uid: 'U2', groupId: 'g1', group: 'G1', proxyId: null }
    ]
  }, null, 2));

  const db = new JsonDatabase();
  await db.init();
  assert.equal(db.getData().schemaVersion, 4);
  assert.deepEqual(db.getData().moduleSettings, []);
  assert.deepEqual(db.getData().proxies, []);
  assert.deepEqual(db.getData().batches, []);
  assert.deepEqual(db.getData().logs, []);
  assert.equal(db.getData().profiles[0].proxyId, null);
  assert.equal(db.getData().profiles[0].legacyProxyId, 'proxy_1');

  const secretStore = new ProxySecretStore();
  await secretStore.init();
  await Promise.all([
    secretStore.setCredentials('proxy_a', 'userA', 'passA'),
    secretStore.setCredentials('proxy_b', 'userB', 'passB')
  ]);
  assert.equal(secretStore.getCredentials('proxy_a').password, 'passA');
  assert.equal(secretStore.getCredentials('proxy_b').username, 'userB');
  await secretStore.setCredentials('proxy_a', 'userA2', '');
  assert.deepEqual(secretStore.getCredentials('proxy_a'), { username: 'userA2', password: 'passA' });
  const secretRaw = fs.readFileSync(path.join(dataDir, 'proxy-secrets.json'), 'utf8');
  assert(!secretRaw.includes('passA'));
  assert(!secretRaw.includes('userA2'));

  const repo = new ProxyRepository(db, secretStore);
  const pHttp = await repo.createProxy({
    name: 'HTTP A', protocol: 'http', host: '10.0.0.1', port: 8080,
    enabled: true, authRequired: false, notes: ''
  });
  const pAuth = await repo.createProxy({
    name: 'SOCKS Auth', protocol: 'socks5', host: '10.0.0.2', port: 1080,
    enabled: true, authRequired: true, username: 'proxyUser', password: 'proxyPass', notes: ''
  });
  assert.equal(pAuth.hasCredentials, true);
  assert(!JSON.stringify(db.getData()).includes('proxyPass'));
  const list = await repo.listProxies();
  assert.equal(list.length, 2);
  assert(!Object.prototype.hasOwnProperty.call(list[1], 'password'));

  await repo.assignProxyToProfiles(['p1', 'p2'], pHttp.id);
  assert(db.getData().profiles.every(p => p.proxyId === pHttp.id));
  await repo.unassignProxyFromProfiles(['p2']);
  assert.equal(db.getData().profiles.find(p => p.id === 'p2').proxyId, null);

  // Disabled proxies may be unassigned from their existing profiles, but may
  // not receive new assignments.
  await repo.updateProxy(pHttp.id, { enabled: false });
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (!String(args[1] || args[0] || '').includes('PROXY_DISABLED')) {
      originalConsoleError(...args);
    }
  };
  try {
    await assert.rejects(
      () => repo.replaceProfilesForProxy(pHttp.id, ['p1', 'p2']),
      /PROXY_DISABLED/
    );
  } finally {
    console.error = originalConsoleError;
  }
  await repo.replaceProfilesForProxy(pHttp.id, []);
  assert.equal(db.getData().profiles.find(p => p.id === 'p1').proxyId, null);
  await repo.updateProxy(pHttp.id, { enabled: true });

  await repo.updateProxy(pAuth.id, { username: 'proxyUser2', password: '' });
  assert.deepEqual(secretStore.getCredentials(pAuth.id), { username: 'proxyUser2', password: 'proxyPass' });

  const imported = await repo.importProxies([
    { name: 'Import A', protocol: 'http', host: '10.0.0.3', port: 8001, enabled: true, authRequired: false },
    { name: 'Import B', protocol: 'http', host: '10.0.0.4', port: 8002, enabled: true, authRequired: true, username: 'u', password: 'p' }
  ]);
  assert.equal(imported.length, 2);
  assert.equal(secretStore.getCredentials(imported[1].id).password, 'p');

  const oneToOne = await repo.assignProxiesOneToOne(
    ['p1', 'p2'],
    [pAuth.id, imported[0].id]
  );
  assert.equal(oneToOne.assignments.length, 2);
  assert.equal(db.getData().profiles.find(p => p.id === 'p1').proxyId, pAuth.id);
  assert.equal(db.getData().profiles.find(p => p.id === 'p2').proxyId, imported[0].id);
  await assert.rejects(
    () => repo.assignProxiesOneToOne(['p1', 'p2'], [pAuth.id, pAuth.id]),
    /PROXY_DUPLICATE_ONE_TO_ONE/
  );
  await assert.rejects(
    () => repo.assignProxiesOneToOne(['p1'], [pAuth.id, imported[0].id]),
    /PROXY_ONE_TO_ONE_COUNT_MISMATCH/
  );

  await repo.unassignProxyFromProfiles(['p2']);

  const profileRepo = {
    async getProfileById(id) { return db.getData().profiles.find(p => p.id === id) || null; }
  };
  const manager = new ProxySessionManager({ profileRepo, proxyRepository: repo, proxySecretStore: secretStore });

  // Direct session.
  const directState = await manager.applyProxyToProfileSession('p2');
  assert.equal(directState.mode, 'direct');

  // Proxy session.
  await repo.assignProxyToProfiles(['p1'], pHttp.id);
  const p1Session = session.fromPartition(getPartitionForProfile('p1'));
  p1Session.resolvedRule = 'PROXY 10.0.0.1:8080';
  const proxyState = await manager.applyProxyToProfileSession('p1');
  assert.equal(proxyState.mode, 'proxy');
  assert.equal(proxyState.state, 'ready');
  assert.equal(p1Session.proxyConfig.mode, 'fixed_servers');

  // No silent direct fallback.
  p1Session.resolvedRule = 'DIRECT';
  await assert.rejects(() => manager.applyProxyToProfileSession('p1'), /PROXY_DIRECT_FALLBACK_DETECTED/);

  const deletion = await repo.deleteProxy(pHttp.id);
  assert(deletion.affectedProfileIds.includes('p1'));
  assert.equal(db.getData().profiles.find(p => p.id === 'p1').proxyId, null);

  console.log(JSON.stringify({
    status: 'PASS',
    schemaVersion: db.getData().schemaVersion,
    proxies: db.getData().proxies.length,
    profiles: db.getData().profiles.length,
    secretsEncrypted: true,
    oneToOneAssignment: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
