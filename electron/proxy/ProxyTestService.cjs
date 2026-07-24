/**
 * HH3D Desktop Tool - One-shot proxy connectivity tests using Chromium networking
 */

const crypto = require('crypto');
const { session, net } = require('electron');
const { buildProxyRules } = require('./proxyRules.cjs');
const { proxyError, validateProxyId, normalizeIdList } = require('./proxyValidation.cjs');

const TEST_URL = 'https://api.ipify.org?format=json';

class ProxyTestService {
  constructor({ proxyRepository, proxySecretStore, broadcastCallback, timeoutMs = 15000 }) {
    this.proxyRepository = proxyRepository;
    this.proxySecretStore = proxySecretStore;
    this.broadcastCallback = broadcastCallback || (() => {});
    this.timeoutMs = timeoutMs;
    this.results = new Map();
  }

  getRuntimeResults() {
    return this.results;
  }

  emit(result) {
    this.results.set(result.proxyId, result);
    try {
      this.broadcastCallback('proxy-test:status-changed', { ...result });
    } catch (error) {
      console.error('[ProxyTestService] Result broadcast failed:', error.message);
    }
    return result;
  }

  createTestPartition(proxyId) {
    const hash = crypto.createHash('sha256').update(proxyId).digest('hex').slice(0, 10);
    return `hh3d-proxy-test-${hash}-${crypto.randomBytes(4).toString('hex')}`;
  }

  async testProxy(proxyId) {
    const id = validateProxyId(proxyId);
    const proxy = this.proxyRepository.getRawProxyById(id);
    if (!proxy) throw proxyError('PROXY_NOT_FOUND', `Không tìm thấy proxy ID "${id}".`);
    if (!proxy.enabled) throw proxyError('PROXY_DISABLED', `Proxy "${proxy.name}" đang bị tắt.`);

    this.emit({
      proxyId: id,
      testState: 'testing',
      checkedAt: new Date().toISOString()
    });

    const partition = this.createTestPartition(id);
    const ses = session.fromPartition(partition, { cache: false });
    const startedAt = Date.now();
    let resolvedRule = '';

    try {
      await ses.setProxy(buildProxyRules(proxy));
      if (typeof ses.forceReloadProxyConfig === 'function') {
        await ses.forceReloadProxyConfig();
      }
      await ses.closeAllConnections();
      resolvedRule = await ses.resolveProxy(TEST_URL);

      if (!resolvedRule || /(^|;)\s*DIRECT\s*($|;)/i.test(resolvedRule)) {
        throw proxyError('PROXY_DIRECT_FALLBACK_DETECTED', 'Proxy test resolved to DIRECT.');
      }

      const response = await this.performRequest(ses, proxy);
      const latencyMs = Date.now() - startedAt;
      let publicIp;
      try {
        const parsed = JSON.parse(response.body);
        publicIp = parsed.ip;
      } catch {
        publicIp = undefined;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw proxyError('PROXY_CONNECTION_FAILED', `Proxy test HTTP status ${response.statusCode}.`);
      }

      return this.emit({
        proxyId: id,
        testState: 'online',
        publicIp,
        latencyMs,
        resolvedRule,
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      const code = error.code || 'PROXY_CONNECTION_FAILED';
      const state = code === 'PROXY_TEST_TIMEOUT' ? 'timeout' :
        ['PROXY_AUTH_REQUIRED', 'PROXY_AUTH_FAILED', 'PROXY_CREDENTIAL_DECRYPT_FAILED'].includes(code) ? 'auth_error' :
        ['PROXY_INVALID_CONFIGURATION', 'PROXY_DIRECT_FALLBACK_DETECTED'].includes(code) ? 'configuration_error' : 'offline';

      return this.emit({
        proxyId: id,
        testState: state,
        latencyMs: Date.now() - startedAt,
        resolvedRule,
        testError: error.message || String(error),
        checkedAt: new Date().toISOString()
      });
    } finally {
      try { await ses.closeAllConnections(); } catch {}
      try { await ses.clearStorageData(); } catch {}
      try { await ses.clearCache(); } catch {}
    }
  }

  performRequest(ses, proxy) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let authAttempts = 0;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };

      const timer = setTimeout(() => {
        try { request.abort(); } catch {}
        finish(reject, proxyError('PROXY_TEST_TIMEOUT', `Proxy test quá ${this.timeoutMs / 1000} giây.`));
      }, this.timeoutMs);

      const request = net.request({
        method: 'GET',
        url: TEST_URL,
        session: ses,
        redirect: 'follow'
      });

      request.on('login', (authInfo, callback) => {
        if (!authInfo?.isProxy) {
          // Never send proxy credentials to origin-server HTTP authentication.
          callback();
          return;
        }

        const authHost = String(authInfo.host || '').toLowerCase();
        if (
          authHost !== String(proxy.host).toLowerCase() ||
          Number(authInfo.port) !== Number(proxy.port)
        ) {
          callback();
          finish(reject, proxyError('PROXY_AUTH_FAILED', 'Yêu cầu xác thực không khớp proxy đang test.'));
          return;
        }

        authAttempts += 1;
        if (authAttempts > 2) {
          callback();
          finish(reject, proxyError('PROXY_AUTH_FAILED', 'Proxy authentication failed.'));
          return;
        }

        try {
          const credentials = this.proxySecretStore.getCredentials(proxy.id);
          if (!credentials) {
            callback();
            finish(reject, proxyError('PROXY_AUTH_REQUIRED', 'Proxy chưa có credential.'));
            return;
          }
          callback(credentials.username, credentials.password);
        } catch (error) {
          callback();
          finish(reject, error);
        }
      });

      request.on('response', response => {
        const chunks = [];
        let receivedBytes = 0;
        response.on('data', chunk => {
          const buffer = Buffer.from(chunk);
          if (receivedBytes + buffer.length <= 1024 * 1024) {
            chunks.push(buffer);
            receivedBytes += buffer.length;
          }
        });
        response.on('end', () => {
          finish(resolve, {
            statusCode: response.statusCode,
            body: Buffer.concat(chunks).toString('utf-8')
          });
        });
        response.on('error', error => finish(reject, error));
      });

      request.on('error', error => finish(reject, error));
      request.end();
    });
  }

  async testManyProxies(proxyIds) {
    const ids = normalizeIdList(proxyIds, 'Danh sách proxy ID');
    const results = new Array(ids.length);
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= ids.length) return;
        try {
          results[index] = await this.testProxy(ids[index]);
        } catch (error) {
          results[index] = this.emit({
            proxyId: ids[index],
            testState: 'configuration_error',
            testError: error.message || String(error),
            checkedAt: new Date().toISOString()
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(5, ids.length) }, () => worker()));
    return results;
  }
}

module.exports = ProxyTestService;
