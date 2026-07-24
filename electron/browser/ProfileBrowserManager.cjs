/**
 * HH3D Desktop Tool - Profile Browser Manager
 * Manages individual Mini Browser windows with persistent partitions per profile.
 */

const { BrowserWindow, session } = require('electron');
const { DEFAULT_TARGET_URL, DEFAULT_WINDOW_CONFIG, IPC_CHANNELS } = require('./browserConstants.cjs');
const { validateProfileId, getPartitionForProfile, isAllowedUrl, sanitizeProfileId } = require('./browserValidation.cjs');

/**
 * Reusable helper to force-close a BrowserWindow with a timeout fallback.
 * Guarantees window close resolution without blocking indefinitely.
 */
function forceCloseWindow(win, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed()) {
      resolve();
      return;
    }

    let timer = null;
    let fallbackTimer = null;
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try {
        win.removeListener('closed', onClosed);
      } catch {}
    };

    const finish = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve();
      }
    };

    const onClosed = () => {
      finish();
    };

    win.once('closed', onClosed);

    timer = setTimeout(() => {
      if (settled) return;

      try {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      } catch {
        finish();
        return;
      }

      fallbackTimer = setTimeout(() => {
        finish();
      }, 500);
    }, timeoutMs);

    try {
      win.close();
    } catch (err) {
      try {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      } catch {}
      fallbackTimer = setTimeout(() => {
        finish();
      }, 500);
    }
  });
}

class ProfileBrowserManager {
  /**
   * @param {object} optionsOrProfileRepo Repository or options object
   * @param {function} [broadcastCallback] Callback to emit IPC messages to renderer (channel, payload)
   */
  constructor(optionsOrProfileRepo, broadcastCallback) {
    if (optionsOrProfileRepo && typeof optionsOrProfileRepo === 'object' && optionsOrProfileRepo.profileRepo) {
      this.profileRepo = optionsOrProfileRepo.profileRepo;
      this.broadcastCallback = optionsOrProfileRepo.broadcastCallback || (() => {});
      this.isDevelopment = Boolean(optionsOrProfileRepo.isDevelopment);
      this.proxySessionManager = optionsOrProfileRepo.proxySessionManager || null;
      this.websiteConfigService = optionsOrProfileRepo.websiteConfigService || null;
    } else {
      this.profileRepo = optionsOrProfileRepo;
      this.broadcastCallback = broadcastCallback || (() => {});
      this.isDevelopment = false;
      this.proxySessionManager = null;
      this.websiteConfigService = null;
    }

    /**
     * Map of active profile browsers:
     * profileId -> {
     *   profileId,
     *   partition,
     *   window,
     *   openedAt,
     *   lastUrl,
     *   title,
     *   state: 'opening' | 'open' | 'loading' | 'closed' | 'error',
     *   error?: string,
     *   childWindows: Set<BrowserWindow>,
     *   closedWithError?: boolean,
     *   closingPromise?: Promise<any>,
     *   closeReason?: null | 'user' | 'error-cleanup' | 'app-quit'
     * }
     */
    this.browsers = new Map();

    /**
     * Map of last known statuses for closed profiles (e.g. persistent error states):
     * profileId -> MiniBrowserStatus
     */
    this.lastKnownStatuses = new Map();

    /**
     * Tracks persistent partitions whose permission policy has already been configured.
     */
    this.configuredPartitions = new Set();
  }

  setProxySessionManager(manager) {
    this.proxySessionManager = manager;
  }

  setWebsiteConfigService(service) {
    this.websiteConfigService = service;
  }

  getTargetUrl() {
    return this.websiteConfigService?.getTargetUrl?.() || DEFAULT_TARGET_URL;
  }

  isAllowedNavigationUrl(urlString) {
    if (this.websiteConfigService?.isAllowedUrl) {
      return this.websiteConfigService.isAllowedUrl(urlString);
    }
    return isAllowedUrl(urlString);
  }

  /**
   * Applies a deny-by-default permission policy to a persistent profile session.
   */
  configurePartitionSecurity(partition) {
    if (this.configuredPartitions.has(partition)) {
      return session.fromPartition(partition);
    }

    const sess = session.fromPartition(partition);

    sess.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });

    sess.setPermissionCheckHandler(() => false);

    if (typeof sess.setDevicePermissionHandler === 'function') {
      sess.setDevicePermissionHandler(() => false);
    }

    this.configuredPartitions.add(partition);
    return sess;
  }

  /**
   * Helper to create closed status object
   */
  createClosedStatus(profileId) {
    return {
      profileId,
      isOpen: false,
      state: 'closed',
      partition: getPartitionForProfile(profileId),
      currentUrl: '',
      title: ''
    };
  }

  /**
   * Emits status update event to renderer process
   */
  emitStatusChanged(profileId, stateOverride, errorMsg) {
    if (this.browsers.has(profileId)) {
      const entry = this.browsers.get(profileId);
      if (stateOverride) entry.state = stateOverride;
      if (errorMsg !== undefined) entry.error = errorMsg;
    }
    const statusObj = this.getProfileBrowserStatus(profileId);
    if (stateOverride) statusObj.state = stateOverride;
    if (errorMsg) statusObj.error = errorMsg;

    try {
      this.broadcastCallback(IPC_CHANNELS.STATUS_CHANGED, statusObj);
    } catch (err) {
      console.error('[ProfileBrowserManager] Broadcast status changed failed:', err);
    }
  }

  /**
   * Applies shared secure webContents event handlers to main or child windows
   */
  applyWebContentsSecurity(win, profileId, partition, browserEntry, isChild = false) {
    const contents = win.webContents;

    // Prevent page beforeunload handlers from blocking window close
    contents.on('will-prevent-unload', (event) => {
      event.preventDefault();
    });

    contents.on('login', async (event, _details, authInfo, callback) => {
      if (!authInfo?.isProxy || !this.proxySessionManager) {
        return;
      }

      try {
        await this.proxySessionManager.handleProxyAuthentication(
          profileId,
          event,
          authInfo,
          callback,
          browserEntry
        );
      } catch (error) {
        console.error('[ProfileBrowserManager] Proxy authentication failed:', error.message);
        browserEntry.state = 'error';
        browserEntry.error = error.message;
        this.emitStatusChanged(profileId, 'error', error.message);
      }
    });

    contents.on('will-navigate', (event, navUrl) => {
      if (!this.isAllowedNavigationUrl(navUrl)) {
        console.warn(`[ProfileBrowserManager] Blocked navigation to disallowed URL: ${navUrl}`);
        event.preventDefault();
      }
    });

    contents.on('will-redirect', (event, navUrl) => {
      if (!this.isAllowedNavigationUrl(navUrl)) {
        console.warn(`[ProfileBrowserManager] Blocked redirect to disallowed URL: ${navUrl}`);
        event.preventDefault();
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (this.isAllowedNavigationUrl(url)) {
        const childWin = new BrowserWindow({
          width: 1024,
          height: 720,
          show: false,
          webPreferences: {
            partition: partition,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            devTools: this.isDevelopment
          }
        });

        childWin.once('ready-to-show', () => {
          if (!childWin.isDestroyed()) {
            childWin.show();
          }
        });

        browserEntry.childWindows.add(childWin);
        this.applyWebContentsSecurity(childWin, profileId, partition, browserEntry, true);

        childWin.on('closed', () => {
          browserEntry.childWindows.delete(childWin);
        });

        childWin.loadURL(url).catch(err => {
          console.error(`[ProfileBrowserManager] Child window loadURL failed for ${url}:`, err);
          browserEntry.childWindows.delete(childWin);
          if (!childWin.isDestroyed()) {
            try { childWin.destroy(); } catch {}
          }
        });

        return { action: 'deny' };
      }

      console.warn(`[ProfileBrowserManager] Blocked popup to disallowed URL: ${url}`);
      return { action: 'deny' };
    });

    contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (errorCode === -3) {
        // Normal navigation cancellation, ignore
        return;
      }
      console.error(`[ProfileBrowserManager] did-fail-load for ${profileId}:`, {
        errorCode,
        errorDescription,
        validatedUrl,
        isMainFrame
      });
      if (!isChild && isMainFrame !== false) {
        browserEntry.state = 'error';
        browserEntry.error = `Tải trang thất bại (${errorCode}): ${errorDescription}`;

        // During the initial load, openProfileBrowser owns the final error lifecycle.
        // The permanent closed handler emits exactly one final error event.
        if (!browserEntry.initialLoadPending) {
          this.emitStatusChanged(profileId, 'error', browserEntry.error);
        }
      }
    });

    contents.on('render-process-gone', (_event, details) => {
      console.error(`[ProfileBrowserManager] render-process-gone for ${profileId}:`, details);
      if (!isChild) {
        browserEntry.state = 'error';
        browserEntry.error = `Tiến trình giao diện bị vô hiệu hóa (${details.reason})`;
        this.emitStatusChanged(profileId, 'error', browserEntry.error);
      }
    });

    contents.on('unresponsive', () => {
      console.error(`[ProfileBrowserManager] unresponsive for ${profileId}`);
      if (!isChild) {
        browserEntry.state = 'error';
        browserEntry.error = 'Cửa sổ trình duyệt không phản hồi';
        this.emitStatusChanged(profileId, 'error', browserEntry.error);
      }
    });
  }

  /**
   * Opens or focuses a Mini Browser for a given profile object
   */
  async openProfileBrowser(profile) {
    if (!profile || !profile.id) {
      throw new Error('Profile không hợp lệ hoặc thiếu profile.id.');
    }

    const profileId = validateProfileId(profile.id);

    // 1. If browser already exists for this profile, only focus it. Reapplying
    // the proxy on an active session would unnecessarily close live sockets.
    if (this.browsers.has(profileId)) {
      const existing = this.browsers.get(profileId);
      if (existing.window && !existing.window.isDestroyed()) {
        if (existing.window.isMinimized()) {
          existing.window.restore();
        }
        existing.window.show();
        existing.window.focus();

        this.emitStatusChanged(profileId, 'open');
        return this.getProfileBrowserStatus(profileId);
      } else {
        this.browsers.delete(profileId);
      }
    }

    // Apply direct/proxy configuration only when a new BrowserWindow is about
    // to be created. A configured proxy failure rejects the open operation and
    // never falls back to Direct.
    if (this.proxySessionManager) {
      await this.proxySessionManager.applyProxyToProfileSession(profileId);
    }

    const partition = getPartitionForProfile(profileId);
    this.configurePartitionSecurity(partition);

    // Reset any previous error state on a new open attempt.
    this.lastKnownStatuses.delete(profileId);

    // 2. Create new BrowserWindow instance
    const displayName = profile.displayName || profile.characterName || profile.uid || 'Profile';
    const windowTitle = `HH3D Mini Browser – ${displayName} – ${profile.uid}`;

    const win = new BrowserWindow({
      ...DEFAULT_WINDOW_CONFIG,
      title: windowTitle,
      show: false,
      webPreferences: {
        partition: partition,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: this.isDevelopment
      }
    });

    const browserEntry = {
      profileId,
      partition,
      window: win,
      openedAt: new Date().toISOString(),
      lastUrl: this.getTargetUrl(),
      title: windowTitle,
      state: 'opening',
      error: undefined,
      childWindows: new Set(),
      closedWithError: false,
      closeReason: null,
      initialLoadPending: true,
      proxyAuthAttempts: 0
    };

    this.browsers.set(profileId, browserEntry);
    this.emitStatusChanged(profileId, 'opening');

    // Apply security & handlers
    this.applyWebContentsSecurity(win, profileId, partition, browserEntry, false);

    win.once('ready-to-show', () => {
      if (!win.isDestroyed() && browserEntry.state !== 'error') {
        win.show();
        browserEntry.state = 'open';
        this.emitStatusChanged(profileId, 'open');
      }
    });

    win.on('page-title-updated', (_event, title) => {
      browserEntry.title = title;
      this.emitStatusChanged(profileId);
    });

    win.webContents.on('did-start-loading', () => {
      if (browserEntry.state !== 'error') {
        browserEntry.state = 'loading';
        this.emitStatusChanged(profileId, 'loading');
      }
    });

    win.webContents.on('did-stop-loading', () => {
      if (!win.isDestroyed()) {
        if (browserEntry.state !== 'error') {
          browserEntry.state = 'open';
          browserEntry.lastUrl = win.webContents.getURL();
          this.emitStatusChanged(profileId, 'open');
        }
      }
    });

    win.webContents.on('did-navigate', (_event, url) => {
      if (!win.isDestroyed()) {
        browserEntry.initialLoadPending = false;
        browserEntry.error = undefined;
        browserEntry.state = 'open';
        browserEntry.lastUrl = url;
        this.emitStatusChanged(profileId, 'open');
      }
    });

    win.on('close', () => {
      if (!browserEntry.closeReason) {
        browserEntry.closeReason = 'user';
      }
    });

    // Handle window closed
    win.on('closed', () => {
      for (const child of Array.from(browserEntry.childWindows)) {
        if (child && !child.isDestroyed()) {
          try { child.destroy(); } catch {}
        }
      }
      browserEntry.childWindows.clear();
      this.browsers.delete(profileId);

      if (browserEntry.closeReason === 'error-cleanup') {
        this.lastKnownStatuses.set(profileId, {
          profileId,
          isOpen: false,
          state: 'error',
          partition,
          currentUrl: '',
          title: browserEntry.title || '',
          error: browserEntry.error
        });
        this.emitStatusChanged(profileId, 'error', browserEntry.error);
      } else {
        this.lastKnownStatuses.delete(profileId);
        this.emitStatusChanged(profileId, 'closed');
      }
    });

    // Load target URL
    try {
      await win.loadURL(this.getTargetUrl());
      browserEntry.initialLoadPending = false;
    } catch (err) {
      console.error(`[ProfileBrowserManager] loadURL failed for ${profileId}:`, err);
      const errorMsg = err.message || String(err);
      browserEntry.state = 'error';
      browserEntry.error = errorMsg;
      browserEntry.closedWithError = true;
      browserEntry.closeReason = 'error-cleanup';

      if (!win.isDestroyed()) {
        await forceCloseWindow(win);
      }

      throw err;
    }

    return this.getProfileBrowserStatus(profileId);
  }

  /**
   * Closes a profile's Mini Browser window if open.
   * Guarantees child popup windows and main window are closed sequentially.
   */
  async closeProfileBrowser(profileId) {
    const validId = validateProfileId(profileId);
    const entry = this.browsers.get(validId);

    if (!entry) {
      const lastKnown = this.lastKnownStatuses.get(validId);
      if (lastKnown && lastKnown.state === 'error') {
        return lastKnown;
      }
      return this.createClosedStatus(validId);
    }

    entry.closeReason = 'user';

    if (entry.closingPromise) {
      return entry.closingPromise;
    }

    entry.closingPromise = (async () => {
      try {
        const children = Array.from(entry.childWindows || []);
        for (const child of children) {
          await forceCloseWindow(child);
        }
        if (entry.childWindows) {
          entry.childWindows.clear();
        }

        if (entry.window && !entry.window.isDestroyed()) {
          await forceCloseWindow(entry.window);
        }
      } finally {
        entry.closingPromise = null;
      }

      return this.getProfileBrowserStatus(validId);
    })();

    return entry.closingPromise;
  }

  /**
   * Focuses a profile's Mini Browser window if open
   */
  async focusProfileBrowser(profileId) {
    const validId = validateProfileId(profileId);

    if (this.browsers.has(validId)) {
      const entry = this.browsers.get(validId);
      if (entry.window && !entry.window.isDestroyed()) {
        if (entry.window.isMinimized()) {
          entry.window.restore();
        }
        entry.window.show();
        entry.window.focus();
        return true;
      }
    }
    return false;
  }

  /**
   * Reloads a profile's Mini Browser window if open
   */
  async reloadProfileBrowser(profileId) {
    const validId = validateProfileId(profileId);

    if (this.browsers.has(validId)) {
      const entry = this.browsers.get(validId);
      if (entry.window && !entry.window.isDestroyed()) {
        entry.window.webContents.reload();
        return true;
      }
    }
    return false;
  }

  /**
   * Returns current status object for a given profileId
   */
  getProfileBrowserStatus(profileId) {
    const partition = getPartitionForProfile(profileId);

    if (this.browsers.has(profileId)) {
      const entry = this.browsers.get(profileId);
      const isWinValid = entry.window && !entry.window.isDestroyed();

      return {
        profileId,
        isOpen: isWinValid,
        state: isWinValid ? entry.state : (entry.error ? 'error' : 'closed'),
        partition,
        currentUrl: isWinValid ? entry.window.webContents.getURL() : '',
        title: entry.title || '',
        openedAt: entry.openedAt,
        ...(entry.error ? { error: entry.error } : {})
      };
    }

    if (this.lastKnownStatuses.has(profileId)) {
      return { ...this.lastKnownStatuses.get(profileId) };
    }

    return {
      profileId,
      isOpen: false,
      state: 'closed',
      partition,
      currentUrl: '',
      title: ''
    };
  }

  /**
   * Lists status objects for all active Mini Browsers and preserved error states
   */
  listProfileBrowserStatuses() {
    const statusMap = new Map();

    for (const profileId of this.browsers.keys()) {
      statusMap.set(profileId, this.getProfileBrowserStatus(profileId));
    }

    for (const [profileId, status] of this.lastKnownStatuses.entries()) {
      if (!statusMap.has(profileId)) {
        statusMap.set(profileId, { ...status });
      }
    }

    return Array.from(statusMap.values());
  }

  /**
   * Clears partition session data (cookies, localStorage, IndexedDB, cache) for a profile.
   * Closes the window first if open.
   */
  async clearProfileSession(profileId) {
    const validId = validateProfileId(profileId);

    // 1. Close window first if open and wait for full teardown
    await this.closeProfileBrowser(validId);

    // Clear any persistent error state on session clear
    this.lastKnownStatuses.delete(validId);

    // 2. Clear partition storage data via session
    const partition = getPartitionForProfile(validId);
    const sess = session.fromPartition(partition);

    await sess.clearStorageData({
      storages: [
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'websql',
        'serviceworkers',
        'cachestorage'
      ]
    });

    await sess.clearCache();
    if (sess.flushStorageData) {
      sess.flushStorageData();
    }

    console.log(`[ProfileBrowserManager] Cleared session partition data for profile: ${validId} (${partition})`);

    return {
      success: true,
      profileId: validId,
      message: `Session data was cleared for profile "${validId}".`
    };
  }

  /**
   * Closes all open Mini Browser windows safely during app quit.
   * Awaits forceCloseWindow on children and main windows without deleting entries prematurely.
   */
  async closeAllBrowsers() {
    const entries = Array.from(this.browsers.values());
    for (const entry of entries) {
      entry.closeReason = 'app-quit';
      try {
        const children = Array.from(entry.childWindows || []);
        for (const child of children) {
          await forceCloseWindow(child);
        }
        if (entry.childWindows) {
          entry.childWindows.clear();
        }
        if (entry.window && !entry.window.isDestroyed()) {
          await forceCloseWindow(entry.window);
        }
      } catch (e) {
        console.error('[ProfileBrowserManager] Error closing browser on quit:', e);
      }
    }
  }
}

module.exports = ProfileBrowserManager;

