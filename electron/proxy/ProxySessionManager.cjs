/**
 * HH3D Desktop Tool - Applies per-profile proxy configuration to persistent sessions
 */

const { session } = require('electron');
const { TARGET_URL } = require('../browser/browserConstants.cjs');
const { getPartitionForProfile } = require('../browser/browserValidation.cjs');
const { buildProxyRules } = require('./proxyRules.cjs');
const { proxyError } = require('./proxyValidation.cjs');

class ProxySessionManager {
  constructor({ profileRepo, proxyRepository, proxySecretStore, broadcastCallback }) {
    this.profileRepo = profileRepo;
    this.proxyRepository = proxyRepository;
    this.proxySecretStore = proxySecretStore;
    this.broadcastCallback = broadcastCallback || (() => {});
    this.profileBrowserManager = null;
    this.runtimeStates = new Map();
  }

  setProfileBrowserManager(manager) {
    this.profileBrowserManager = manager;
  }

  setState(profileId, patch) {
    const next = {
      profileId,
      proxyId: null,
      mode: 'direct',
      state: 'idle',
      updatedAt: new Date().toISOString(),
      ...(this.runtimeStates.get(profileId) || {}),
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.runtimeStates.set(profileId, next);
    try {
      this.broadcastCallback('profile-proxy:state-changed', { ...next });
    } catch (error) {
      console.error('[ProxySessionManager] State broadcast failed:', error.message);
    }
    return next;
  }

  getProfileProxyState(profileId) {
    return this.runtimeStates.get(profileId) || {
      profileId,
      proxyId: null,
      mode: 'direct',
      state: 'idle',
      updatedAt: new Date().toISOString()
    };
  }

  clearRuntimeState(profileId) {
    this.runtimeStates.delete(profileId);
  }

  async applyDirectToProfileSession(profileId) {
    const partition = getPartitionForProfile(profileId);
    const ses = session.fromPartition(partition);
    this.setState(profileId, { proxyId: null, mode: 'direct', state: 'applying', error: undefined });

    await ses.setProxy({ mode: 'direct' });
    if (typeof ses.forceReloadProxyConfig === 'function') {
      await ses.forceReloadProxyConfig();
    }
    await ses.closeAllConnections();

    return this.setState(profileId, {
      proxyId: null,
      mode: 'direct',
      state: 'ready',
      resolvedRule: 'DIRECT',
      error: undefined
    });
  }

  async applyProxyToProfileSession(profileId) {
    const profile = await this.profileRepo.getProfileById(profileId);
    if (!profile) {
      throw proxyError('PROXY_INVALID_CONFIGURATION', `Profile ID "${profileId}" không tồn tại.`);
    }

    if (!profile.proxyId) {
      return this.applyDirectToProfileSession(profileId);
    }

    const proxy = this.proxyRepository.getRawProxyById(profile.proxyId);
    if (!proxy) {
      const error = proxyError('PROXY_NOT_FOUND', `Proxy được gán cho profile không còn tồn tại.`);
      this.setState(profileId, {
        proxyId: profile.proxyId,
        mode: 'proxy',
        state: 'error',
        error: error.message
      });
      throw error;
    }

    if (!proxy.enabled) {
      const error = proxyError('PROXY_DISABLED', `Proxy "${proxy.name}" đang bị tắt.`);
      this.setState(profileId, {
        proxyId: proxy.id,
        mode: 'proxy',
        state: 'error',
        error: error.message
      });
      throw error;
    }

    if (proxy.authRequired && !proxy.hasCredentials) {
      const error = proxyError('PROXY_AUTH_REQUIRED', `Proxy "${proxy.name}" chưa có credential đã lưu.`);
      this.setState(profileId, {
        proxyId: proxy.id,
        mode: 'proxy',
        state: 'error',
        error: error.message
      });
      throw error;
    }

    const partition = getPartitionForProfile(profileId);
    const ses = session.fromPartition(partition);
    const proxyConfig = buildProxyRules(proxy);
    this.setState(profileId, {
      proxyId: proxy.id,
      mode: 'proxy',
      state: 'applying',
      error: undefined
    });

    try {
      await ses.setProxy(proxyConfig);
      if (typeof ses.forceReloadProxyConfig === 'function') {
        await ses.forceReloadProxyConfig();
      }
      await ses.closeAllConnections();
      const resolvedRule = await ses.resolveProxy(TARGET_URL);

      if (!resolvedRule || /(^|;)\s*DIRECT\s*($|;)/i.test(resolvedRule)) {
        throw proxyError(
          'PROXY_DIRECT_FALLBACK_DETECTED',
          'Chromium trả về DIRECT dù profile đang được gán proxy.'
        );
      }

      return this.setState(profileId, {
        proxyId: proxy.id,
        mode: 'proxy',
        state: 'ready',
        resolvedRule,
        error: undefined
      });
    } catch (error) {
      const safeError = error.code ? error : proxyError('PROXY_CONNECTION_FAILED', error.message || 'Không thể áp dụng proxy.');
      this.setState(profileId, {
        proxyId: proxy.id,
        mode: 'proxy',
        state: 'error',
        error: safeError.message
      });
      throw safeError;
    }
  }

  async refreshProfileProxy(profileId) {
    if (this.profileBrowserManager) {
      await this.profileBrowserManager.closeProfileBrowser(profileId);
    }
    return this.applyProxyToProfileSession(profileId);
  }

  async handleProxyAuthentication(profileId, event, authInfo, callback, browserEntry) {
    if (!authInfo?.isProxy) {
      return false;
    }

    event.preventDefault();

    try {
      const profile = await this.profileRepo.getProfileById(profileId);
      if (!profile?.proxyId) {
        callback();
        throw proxyError('PROXY_AUTH_REQUIRED', 'Profile không được gán proxy xác thực.');
      }

      const proxy = this.proxyRepository.getRawProxyById(profile.proxyId);
      if (!proxy || !proxy.enabled) {
        callback();
        throw proxyError(proxy ? 'PROXY_DISABLED' : 'PROXY_NOT_FOUND', 'Proxy xác thực không khả dụng.');
      }

      const authHost = String(authInfo.host || '').toLowerCase();
      if (authHost !== String(proxy.host).toLowerCase() || Number(authInfo.port) !== Number(proxy.port)) {
        callback();
        throw proxyError('PROXY_AUTH_FAILED', 'Yêu cầu xác thực không khớp proxy đã gán.');
      }

      browserEntry.proxyAuthAttempts = (browserEntry.proxyAuthAttempts || 0) + 1;
      if (browserEntry.proxyAuthAttempts > 2) {
        callback();
        throw proxyError('PROXY_AUTH_FAILED', 'Proxy xác thực thất bại quá số lần cho phép.');
      }

      const credentials = this.proxySecretStore.getCredentials(proxy.id);
      if (!credentials) {
        callback();
        throw proxyError('PROXY_AUTH_REQUIRED', 'Proxy chưa có credential đã lưu.');
      }

      callback(credentials.username, credentials.password);
      return true;
    } catch (error) {
      const safeError = error.code ? error : proxyError('PROXY_AUTH_FAILED', error.message || 'Xác thực proxy thất bại.');
      this.setState(profileId, {
        proxyId: (await this.profileRepo.getProfileById(profileId))?.proxyId || null,
        mode: 'proxy',
        state: 'error',
        error: safeError.message
      });
      throw safeError;
    }
  }
}

module.exports = ProxySessionManager;
