/**
 * HH3D Desktop Tool - Session-bound Chromium HTTP client.
 *
 * This client intentionally has no renderer-facing arbitrary request API.
 * Requests use Electron net.request with the profile persistent Session so
 * cookies and the assigned proxy configuration are shared with Mini Browser.
 */

const { net, session } = require('electron');
const { getPartitionForProfile } = require('../browser/browserValidation.cjs');
const { isAllowedWorkerUrl } = require('./workerValidation.cjs');

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function createWorkerError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function normalizeHeaders(headers = {}) {
  const result = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (value === undefined || value === null) continue;
    result[name] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return result;
}

function createResponseLike({ statusCode, headers, body, url }) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    url,
    headers: normalizeHeaders(headers),
    async text() {
      return buffer.toString('utf8');
    },
    async json() {
      return JSON.parse(buffer.toString('utf8'));
    },
    async arrayBuffer() {
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    }
  };
}

class WorkerHttpClient {
  constructor(options) {
    this.proxySessionManager = options.proxySessionManager;
    this.settingsRepository = options.settingsRepository;
  }

  async fetch(profile, url, init = {}) {
    if (!profile?.id) {
      throw createWorkerError('WORKER_PROFILE_REQUIRED', 'Thiếu profile hợp lệ.');
    }
    if (!isAllowedWorkerUrl(url)) {
      throw createWorkerError('WORKER_URL_NOT_ALLOWED', `URL không được phép: ${url}`);
    }

    // Apply Direct or the exact assigned proxy before every request. If an
    // assigned proxy fails, this rejects and never silently falls back Direct.
    await this.proxySessionManager.applyProxyToProfileSession(profile.id);

    const partition = getPartitionForProfile(profile.id);
    const ses = session.fromPartition(partition);
    const proxyAuth = await this.proxySessionManager.getProxyAuthenticationContext(profile.id);
    const settings = this.settingsRepository.getWorkerSettings();
    const timeoutMs = Math.min(
      Math.max(Number(init.timeoutMs || settings.requestTimeoutMs), 3000),
      60000
    );

    const startedAt = Date.now();
    const response = await this.requestWithSession({
      profileId: profile.id,
      session: ses,
      url,
      init,
      timeoutMs,
      proxyAuth
    });

    return {
      response,
      durationMs: Date.now() - startedAt,
      partition
    };
  }

  requestWithSession({ profileId, session: ses, url, init, timeoutMs, proxyAuth }) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      let authAttempts = 0;
      let pendingAuthError = null;
      let externalAbortHandler = null;
      const externalSignal = init.signal;

      const request = net.request({
        url,
        method: String(init.method || 'GET').toUpperCase(),
        session: ses,
        // credentials: include sends session cookies and cached authentication
        // data through Chromium's network stack.
        credentials: 'include',
        redirect: init.redirect || 'follow',
        cache: 'no-store',
        headers: {
          Accept: 'application/json,text/plain,text/html;q=0.9,*/*;q=0.8',
          ...(init.headers || {})
        }
      });

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (externalSignal && externalAbortHandler) {
          externalSignal.removeEventListener('abort', externalAbortHandler);
        }
      };

      const resolveOnce = value => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const rejectOnce = error => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const abortRequest = reason => {
        try {
          request.abort();
        } catch {}
        rejectOnce(reason);
      };

      request.on('login', (authInfo, callback) => {
        if (!authInfo?.isProxy) {
          // Never reuse proxy credentials for origin-server authentication.
          callback();
          return;
        }

        authAttempts += 1;
        if (authAttempts > 2) {
          pendingAuthError = createWorkerError(
            'PROXY_AUTH_FAILED',
            'Proxy xác thực thất bại quá số lần cho phép.'
          );
          callback();
          queueMicrotask(() => abortRequest(pendingAuthError));
          return;
        }

        if (!proxyAuth?.authRequired || !proxyAuth.username || !proxyAuth.password) {
          pendingAuthError = createWorkerError(
            'PROXY_AUTH_REQUIRED',
            'Proxy được gán chưa có credential hợp lệ.'
          );
          callback();
          queueMicrotask(() => abortRequest(pendingAuthError));
          return;
        }

        const authHost = String(authInfo.host || '').trim().toLowerCase();
        const expectedHost = String(proxyAuth.host || '').trim().toLowerCase();
        const authPort = Number(authInfo.port);
        const expectedPort = Number(proxyAuth.port);

        if (authHost !== expectedHost || authPort !== expectedPort) {
          pendingAuthError = createWorkerError(
            'PROXY_AUTH_FAILED',
            'Yêu cầu xác thực không khớp proxy được gán cho profile.'
          );
          callback();
          queueMicrotask(() => abortRequest(pendingAuthError));
          return;
        }

        callback(proxyAuth.username, proxyAuth.password);
      });

      request.on('response', incoming => {
        const chunks = [];
        let totalBytes = 0;

        // Register terminal listeners before data starts flowing.
        incoming.once('end', () => {
          const statusCode = Number(incoming.statusCode || 0);
          if (statusCode === 407) {
            rejectOnce(
              pendingAuthError || createWorkerError(
                'PROXY_AUTH_FAILED',
                'Proxy từ chối credential xác thực.'
              )
            );
            return;
          }

          resolveOnce(createResponseLike({
            statusCode,
            headers: incoming.headers || {},
            body: Buffer.concat(chunks),
            url: incoming.url || url
          }));
        });

        incoming.once('aborted', () => {
          rejectOnce(
            pendingAuthError || createWorkerError(
              'WORKER_RESPONSE_ABORTED',
              'Phản hồi Worker bị hủy trước khi hoàn tất.'
            )
          );
        });

        incoming.once('error', error => {
          rejectOnce(pendingAuthError || error);
        });

        incoming.on('data', chunk => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            const tooLarge = createWorkerError(
              'WORKER_RESPONSE_TOO_LARGE',
              `Phản hồi vượt quá giới hạn ${MAX_RESPONSE_BYTES} bytes.`
            );
            try {
              request.abort();
            } catch {}
            rejectOnce(tooLarge);
            return;
          }
          chunks.push(buffer);
        });
      });

      request.on('error', error => {
        rejectOnce(pendingAuthError || error);
      });

      request.on('abort', () => {
        rejectOnce(
          pendingAuthError || createWorkerError(
            'WORKER_REQUEST_ABORTED',
            'Yêu cầu Worker đã bị hủy.'
          )
        );
      });

      // Do not reject from ClientRequest `close`. In real Chromium proxy
      // traffic, Electron can emit close without a response/error callback even
      // though the network transaction is still being finalized. The explicit
      // response/error/abort listeners and timeout are the authoritative paths.

      timer = setTimeout(() => {
        abortRequest(
          createWorkerError(
            'WORKER_REQUEST_TIMEOUT',
            `Quá thời gian ${timeoutMs}ms mà không nhận được phản hồi.`
          )
        );
      }, timeoutMs);

      if (externalSignal) {
        externalAbortHandler = () => {
          const reason = externalSignal.reason;
          abortRequest(
            reason instanceof Error
              ? reason
              : createWorkerError('WORKER_REQUEST_ABORTED', 'Yêu cầu Worker đã bị hủy.')
          );
        };

        if (externalSignal.aborted) {
          externalAbortHandler();
          return;
        }
        externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
      }

      try {
        if (init.body !== undefined && init.body !== null) {
          if (Buffer.isBuffer(init.body) || typeof init.body === 'string') {
            request.write(init.body);
          } else if (init.body instanceof Uint8Array) {
            request.write(Buffer.from(init.body));
          } else {
            throw createWorkerError(
              'WORKER_INVALID_BODY',
              'Body chỉ hỗ trợ string, Buffer hoặc Uint8Array trong Phase 06A.'
            );
          }
        }
        request.end();
      } catch (error) {
        abortRequest(error);
      }
    });
  }
}

module.exports = WorkerHttpClient;
