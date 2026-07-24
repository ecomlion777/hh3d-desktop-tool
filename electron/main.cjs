const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const JsonDatabase = require('./storage/JsonDatabase.cjs');
const ProfileRepository = require('./storage/ProfileRepository.cjs');
const GroupRepository = require('./storage/GroupRepository.cjs');
const ProfileBrowserManager = require('./browser/ProfileBrowserManager.cjs');
const { IPC_CHANNELS } = require('./browser/browserConstants.cjs');
const ProxySecretStore = require('./proxy/ProxySecretStore.cjs');
const ProxyRepository = require('./proxy/ProxyRepository.cjs');
const ProxySessionManager = require('./proxy/ProxySessionManager.cjs');
const ProxyTestService = require('./proxy/ProxyTestService.cjs');
const WorkerLogRepository = require('./worker/WorkerLogRepository.cjs');
const WorkerSettingsRepository = require('./worker/WorkerSettingsRepository.cjs');
const BatchRepository = require('./worker/BatchRepository.cjs');
const WorkerHttpClient = require('./worker/WorkerHttpClient.cjs');
const ProfileWorkerManager = require('./worker/ProfileWorkerManager.cjs');
const SystemStatsService = require('./worker/SystemStatsService.cjs');
const { WORKER_IPC_CHANNELS } = require('./worker/workerConstants.cjs');
const WebsiteConfigService = require('./website/WebsiteConfigService.cjs');
const ModuleRegistry = require('./modules/ModuleRegistry.cjs');
const ModuleSettingsRepository = require('./modules/ModuleSettingsRepository.cjs');
const ModuleRunner = require('./modules/ModuleRunner.cjs');
const runSessionCheck = require('./modules/builtin/SessionCheckModule.cjs');
const runFrameworkDiagnostic = require('./modules/builtin/FrameworkDiagnosticModule.cjs');
const runDailyCheckin = require('./modules/builtin/DailyCheckinModule.cjs');
const runClanWorship = require('./modules/builtin/ClanWorshipModule.cjs');
const runWelfareHall = require('./modules/builtin/WelfareHallModule.cjs');
const { MODULE_IPC_CHANNELS } = require('./modules/moduleConstants.cjs');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;
  let databaseReady = false;
  let databaseInitError = null;
  let proxyServicesReady = false;
  let proxyServicesInitError = null;
  let workerServicesReady = false;
  let workerServicesInitError = null;

  const db = new JsonDatabase();
  const profileRepo = new ProfileRepository(db);
  const groupRepo = new GroupRepository(db);
  const proxySecretStore = new ProxySecretStore();
  const proxyRepository = new ProxyRepository(db, proxySecretStore);
  const workerSettingsRepository = new WorkerSettingsRepository(db);
  const websiteConfigService = new WebsiteConfigService(workerSettingsRepository);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const isDevelopment = Boolean(devUrl);

  const broadcast = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  const proxySessionManager = new ProxySessionManager({
    profileRepo,
    proxyRepository,
    proxySecretStore,
    websiteConfigService,
    broadcastCallback: broadcast
  });

  const profileBrowserManager = new ProfileBrowserManager({
    profileRepo,
    proxySessionManager,
    websiteConfigService,
    broadcastCallback: broadcast,
    isDevelopment
  });
  proxySessionManager.setProfileBrowserManager(profileBrowserManager);

  const proxyTestService = new ProxyTestService({
    proxyRepository,
    proxySecretStore,
    broadcastCallback: broadcast,
    timeoutMs: 15000
  });

  const workerLogRepository = new WorkerLogRepository(db);
  const batchRepository = new BatchRepository(db);
  const workerHttpClient = new WorkerHttpClient({
    proxySessionManager,
    settingsRepository: workerSettingsRepository,
    websiteConfigService
  });
  const moduleRegistry = new ModuleRegistry();
  moduleRegistry.registerHandler('session_check', runSessionCheck);
  moduleRegistry.registerHandler('framework_diagnostic', runFrameworkDiagnostic);
  moduleRegistry.registerHandler('diem_danh', runDailyCheckin);
  moduleRegistry.registerHandler('te_le', runClanWorship);
  moduleRegistry.registerHandler('phuc_loi', runWelfareHall);
  const moduleSettingsRepository = new ModuleSettingsRepository(db, profileRepo, moduleRegistry);
  const moduleRunner = new ModuleRunner({
    registry: moduleRegistry,
    settingsRepository: moduleSettingsRepository,
    profileRepo,
    httpClient: workerHttpClient,
    logRepository: workerLogRepository,
    websiteConfigService,
    broadcastCallback: broadcast
  });
  const workerManager = new ProfileWorkerManager({
    profileRepo,
    httpClient: workerHttpClient,
    logRepository: workerLogRepository,
    batchRepository,
    settingsRepository: workerSettingsRepository,
    moduleRunner,
    moduleSettingsRepository,
    broadcastCallback: broadcast
  });
  const systemStatsService = new SystemStatsService({
    workerManager,
    broadcastCallback: broadcast
  });

  function ensureDatabaseReady() {
    if (!databaseReady) {
      throw new Error(
        `Local JSON Database chưa sẵn sàng: ${databaseInitError?.message || 'Unknown initialization error'}`
      );
    }
  }

  function ensureProxyServicesReady() {
    ensureDatabaseReady();
    if (!proxyServicesReady) {
      throw new Error(
        `Proxy Services chưa sẵn sàng: ${proxyServicesInitError?.message || 'Unknown initialization error'}`
      );
    }
  }

  function ensureWorkerServicesReady() {
    ensureProxyServicesReady();
    if (!workerServicesReady) {
      throw new Error(
        `Worker Services chưa sẵn sàng: ${workerServicesInitError?.message || 'Unknown initialization error'}`
      );
    }
  }

  async function listSanitizedProxies() {
    return proxyRepository.listProxies(proxyTestService.getRuntimeResults());
  }

  async function broadcastProxiesChanged() {
    broadcast('proxies:changed', await listSanitizedProxies());
  }

  async function closeBrowsers(profileIds) {
    const uniqueIds = Array.from(new Set(profileIds || []));
    await Promise.all(uniqueIds.map(profileId =>
      profileBrowserManager.closeProfileBrowser(profileId)
    ));
  }

  async function stopWorkersAndCloseBrowsers(profileIds, reason = 'network-change') {
    const uniqueIds = Array.from(new Set(profileIds || []));
    if (workerServicesReady && uniqueIds.length > 0) {
      await workerManager.stopProfiles(uniqueIds, reason);
    }
    await closeBrowsers(uniqueIds);
  }

  function getAssignableProxy(proxyId) {
    if (proxyId === null || proxyId === undefined || proxyId === '') return null;
    ensureProxyServicesReady();
    const proxy = proxyRepository.getRawProxyById(String(proxyId));
    if (!proxy) {
      const error = new Error(`PROXY_NOT_FOUND: Không tìm thấy proxy ID "${proxyId}".`);
      error.code = 'PROXY_NOT_FOUND';
      throw error;
    }
    if (!proxy.enabled) {
      const error = new Error(`PROXY_DISABLED: Proxy "${proxy.name}" đang bị tắt.`);
      error.code = 'PROXY_DISABLED';
      throw error;
    }
    return proxy;
  }

  async function applyProfileNetworkSafely(profileId) {
    try {
      return await proxySessionManager.applyProxyToProfileSession(profileId);
    } catch (error) {
      // The assignment remains persisted. The error state is broadcast and a
      // later Mini Browser open rejects instead of silently using Direct.
      console.error('[Electron Main] Profile proxy apply failed:', error.message);
      return proxySessionManager.getProfileProxyState(profileId);
    }
  }

  function proxyChangesRequireSessionRefresh(changes) {
    if (!changes || typeof changes !== 'object') return false;
    return [
      'protocol', 'host', 'port', 'enabled', 'authRequired',
      'username', 'password', 'clearCredentials'
    ].some(key => Object.prototype.hasOwnProperty.call(changes, key));
  }

  function registerIpcHandlers() {
    ipcMain.handle('app:get-versions', () => ({
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron || 'unknown',
      chromiumVersion: process.versions.chrome || 'unknown',
      nodeVersion: process.versions.node || 'unknown'
    }));

    ipcMain.handle('storage:get-info', async () => {
      ensureDatabaseReady();
      return db.getStorageInfo();
    });

    ipcMain.handle('profiles:list', async () => {
      ensureDatabaseReady();
      return profileRepo.listProfiles();
    });

    ipcMain.handle('profiles:create', async (_event, profileData) => {
      ensureDatabaseReady();
      const assignedProxy = getAssignableProxy(profileData?.proxyId);
      return profileRepo.createProfile({
        ...profileData,
        proxyId: assignedProxy?.id || null,
        proxyAddress: assignedProxy ? `${assignedProxy.host}:${assignedProxy.port}` : 'Không dùng Proxy',
        expectedIp: '',
        currentIp: ''
      });
    });

    ipcMain.handle('profiles:update', async (_event, profileId, changes) => {
      ensureDatabaseReady();
      const existing = await profileRepo.getProfileById(profileId);
      if (!existing) throw new Error(`Profile ID "${profileId}" không tồn tại.`);

      const hasProxyChange = Object.prototype.hasOwnProperty.call(changes || {}, 'proxyId');
      const assignedProxy = hasProxyChange ? getAssignableProxy(changes.proxyId) : undefined;
      const proxyChanged = hasProxyChange && (assignedProxy?.id || null) !== existing.proxyId;
      if (proxyChanged) {
        if (workerServicesReady) {
          await workerManager.stopProfiles([profileId], 'proxy-change');
        }
        await profileBrowserManager.closeProfileBrowser(profileId);
      }

      const normalizedChanges = hasProxyChange ? {
        ...changes,
        proxyId: assignedProxy?.id || null,
        proxyAddress: assignedProxy ? `${assignedProxy.host}:${assignedProxy.port}` : 'Không dùng Proxy',
        expectedIp: '',
        currentIp: ''
      } : changes;

      const updated = await profileRepo.updateProfile(profileId, normalizedChanges);
      if (proxyChanged && proxyServicesReady) {
        await applyProfileNetworkSafely(profileId);
      }
      return updated;
    });

    ipcMain.handle('profiles:delete', async (_event, profileId) => {
      ensureDatabaseReady();
      const profile = await profileRepo.getProfileById(profileId);
      if (!profile) throw new Error(`Profile ID "${profileId}" không tồn tại.`);
      if (workerServicesReady) {
        await workerManager.stopProfiles([profileId], 'profile-delete');
      }
      await profileBrowserManager.closeProfileBrowser(profileId);
      proxySessionManager.clearRuntimeState(profileId);
      return profileRepo.deleteProfile(profileId);
    });

    ipcMain.handle('groups:list', async () => {
      ensureDatabaseReady();
      return groupRepo.listGroups();
    });
    ipcMain.handle('groups:create', async (_event, groupData) => {
      ensureDatabaseReady();
      return groupRepo.createGroup(groupData);
    });
    ipcMain.handle('groups:update', async (_event, groupId, changes) => {
      ensureDatabaseReady();
      return groupRepo.updateGroup(groupId, changes);
    });
    ipcMain.handle('groups:delete', async (_event, groupId) => {
      ensureDatabaseReady();
      return groupRepo.deleteGroup(groupId);
    });

    ipcMain.handle(IPC_CHANNELS.OPEN, async (_event, profileId) => {
      ensureDatabaseReady();
      const profile = await profileRepo.getProfileById(profileId);
      if (!profile) throw new Error(`Profile ID "${profileId}" không tồn tại.`);
      return profileBrowserManager.openProfileBrowser(profile);
    });
    ipcMain.handle(IPC_CHANNELS.CLOSE, async (_event, profileId) => profileBrowserManager.closeProfileBrowser(profileId));
    ipcMain.handle(IPC_CHANNELS.FOCUS, async (_event, profileId) => profileBrowserManager.focusProfileBrowser(profileId));
    ipcMain.handle(IPC_CHANNELS.RELOAD, async (_event, profileId) => profileBrowserManager.reloadProfileBrowser(profileId));
    ipcMain.handle(IPC_CHANNELS.GET_STATUS, async (_event, profileId) => profileBrowserManager.getProfileBrowserStatus(profileId));
    ipcMain.handle(IPC_CHANNELS.LIST_STATUSES, async () => profileBrowserManager.listProfileBrowserStatuses());
    ipcMain.handle(IPC_CHANNELS.CLEAR_SESSION, async (_event, profileId) => {
      ensureDatabaseReady();
      const profile = await profileRepo.getProfileById(profileId);
      if (!profile) throw new Error(`Profile ID "${profileId}" không tồn tại.`);
      return profileBrowserManager.clearProfileSession(profileId);
    });

    // Real Proxy Manager IPC
    ipcMain.handle('proxies:list', async () => {
      ensureProxyServicesReady();
      return listSanitizedProxies();
    });

    ipcMain.handle('proxies:get', async (_event, proxyId) => {
      ensureProxyServicesReady();
      return proxyRepository.getProxyById(proxyId, proxyTestService.getRuntimeResults().get(proxyId));
    });

    ipcMain.handle('proxies:create', async (_event, input) => {
      ensureProxyServicesReady();
      const result = await proxyRepository.createProxy(input);
      await broadcastProxiesChanged();
      return result;
    });

    ipcMain.handle('proxies:update', async (_event, proxyId, changes) => {
      ensureProxyServicesReady();
      const shouldRefreshSessions = proxyChangesRequireSessionRefresh(changes);
      const assigned = shouldRefreshSessions
        ? await proxyRepository.getProfilesUsingProxy(proxyId)
        : [];
      if (shouldRefreshSessions) {
        await stopWorkersAndCloseBrowsers(assigned.map(profile => profile.id), 'proxy-update');
      }
      const result = await proxyRepository.updateProxy(proxyId, changes);
      if (shouldRefreshSessions) {
        for (const profile of assigned) {
          await applyProfileNetworkSafely(profile.id);
        }
      }
      await broadcastProxiesChanged();
      return result;
    });

    ipcMain.handle('proxies:delete', async (_event, proxyId) => {
      ensureProxyServicesReady();
      const assigned = await proxyRepository.getProfilesUsingProxy(proxyId);
      await stopWorkersAndCloseBrowsers(assigned.map(profile => profile.id), 'proxy-update');
      const result = await proxyRepository.deleteProxy(proxyId);
      for (const profile of assigned) {
        await applyProfileNetworkSafely(profile.id);
      }
      await broadcastProxiesChanged();
      return result;
    });

    ipcMain.handle('proxies:import', async (_event, items) => {
      ensureProxyServicesReady();
      const result = await proxyRepository.importProxies(items);
      await broadcastProxiesChanged();
      return result;
    });

    ipcMain.handle('proxies:test', async (_event, proxyId) => {
      ensureProxyServicesReady();
      const result = await proxyTestService.testProxy(proxyId);
      await broadcastProxiesChanged();
      return result;
    });

    ipcMain.handle('proxies:test-many', async (_event, proxyIds) => {
      ensureProxyServicesReady();
      const result = await proxyTestService.testManyProxies(proxyIds);
      await broadcastProxiesChanged();
      return result;
    });

    ipcMain.handle('proxies:assign-profiles', async (_event, profileIds, proxyId) => {
      ensureProxyServicesReady();
      await stopWorkersAndCloseBrowsers(profileIds, 'proxy-assignment');
      const updated = await proxyRepository.assignProxyToProfiles(profileIds, proxyId);
      const states = [];
      for (const profileId of profileIds) {
        states.push(await applyProfileNetworkSafely(profileId));
      }
      await broadcastProxiesChanged();
      return { profiles: updated, states };
    });

    ipcMain.handle('proxies:assign-one-to-one', async (_event, profileIds, proxyIds) => {
      ensureProxyServicesReady();
      await stopWorkersAndCloseBrowsers(profileIds, 'proxy-assignment');

      const result = await proxyRepository.assignProxiesOneToOne(profileIds, proxyIds);
      const states = result.assignments.map(assignment => {
        proxySessionManager.clearRuntimeState(assignment.profileId);
        return proxySessionManager.setState(assignment.profileId, {
          proxyId: assignment.proxyId,
          mode: 'proxy',
          state: 'idle',
          resolvedRule: undefined,
          error: undefined
        });
      });

      await broadcastProxiesChanged();
      return {
        ...result,
        states
      };
    });

    ipcMain.handle('proxies:replace-profile-assignments', async (_event, proxyId, profileIds) => {
      ensureProxyServicesReady();
      const currentlyAssigned = await proxyRepository.getProfilesUsingProxy(proxyId);
      const affectedIds = Array.from(new Set([
        ...currentlyAssigned.map(profile => profile.id),
        ...(profileIds || [])
      ]));
      await stopWorkersAndCloseBrowsers(affectedIds, 'proxy-assignment');
      const updated = await proxyRepository.replaceProfilesForProxy(proxyId, profileIds);
      const states = [];
      for (const profileId of affectedIds) {
        states.push(await applyProfileNetworkSafely(profileId));
      }
      await broadcastProxiesChanged();
      return { profiles: updated, states };
    });

    ipcMain.handle('proxies:unassign-profiles', async (_event, profileIds) => {
      ensureProxyServicesReady();
      await stopWorkersAndCloseBrowsers(profileIds, 'proxy-assignment');
      const updated = await proxyRepository.unassignProxyFromProfiles(profileIds);
      const states = [];
      for (const profileId of profileIds) {
        states.push(await applyProfileNetworkSafely(profileId));
      }
      await broadcastProxiesChanged();
      return { profiles: updated, states };
    });

    ipcMain.handle('proxies:get-profile-state', async (_event, profileId) => {
      ensureProxyServicesReady();
      const profile = await profileRepo.getProfileById(profileId);
      if (!profile) throw new Error(`Profile ID "${profileId}" không tồn tại.`);
      return proxySessionManager.getProfileProxyState(profileId);
    });

    ipcMain.handle('proxies:refresh-profile', async (_event, profileId) => {
      ensureProxyServicesReady();
      const profile = await profileRepo.getProfileById(profileId);
      if (!profile) throw new Error(`Profile ID "${profileId}" không tồn tại.`);
      return proxySessionManager.refreshProfileProxy(profileId);
    });

    ipcMain.handle('proxies:get-storage-info', async () => {
      ensureProxyServicesReady();
      const data = db.getData();
      const secretInfo = proxySecretStore.getStorageInfo();
      return {
        schemaVersion: data.schemaVersion,
        proxyCount: data.proxies.length,
        assignedProfileCount: data.profiles.filter(profile => Boolean(profile.proxyId)).length,
        ...secretInfo
      };
    });
    // Phase 07 Module Framework IPC
    ipcMain.handle(MODULE_IPC_CHANNELS.LIST_CATALOG, async () => {
      ensureWorkerServicesReady();
      return moduleRegistry.listCatalog();
    });

    ipcMain.handle(MODULE_IPC_CHANNELS.GET_PROFILE_SETTINGS, async (_event, profileId) => {
      ensureWorkerServicesReady();
      return moduleSettingsRepository.getProfileSettings(profileId);
    });

    ipcMain.handle(MODULE_IPC_CHANNELS.SAVE_PROFILE_SETTINGS, async (_event, profileId, settings) => {
      ensureWorkerServicesReady();
      const result = await moduleSettingsRepository.saveProfileSettings(profileId, settings);
      broadcast(MODULE_IPC_CHANNELS.SETTINGS_CHANGED, { profileIds: [profileId], settings: result });
      broadcast('profiles:changed', await profileRepo.listProfiles());
      return result;
    });

    ipcMain.handle(MODULE_IPC_CHANNELS.APPLY_TO_PROFILES, async (_event, profileIds, moduleCodes, mode) => {
      ensureWorkerServicesReady();
      const result = await moduleSettingsRepository.applyToProfiles(profileIds, moduleCodes, mode || 'replace');
      broadcast(MODULE_IPC_CHANNELS.SETTINGS_CHANGED, {
        profileIds: result.profileIds,
        enabledModuleCodes: result.enabledModuleCodes,
        mode: result.mode
      });
      broadcast('profiles:changed', await profileRepo.listProfiles());
      return result;
    });

    ipcMain.handle(MODULE_IPC_CHANNELS.RUN_ONCE, async (_event, profileId, moduleCode) => {
      ensureWorkerServicesReady();
      return moduleRunner.runModule(profileId, moduleCode, {
        trigger: 'manual',
        // The Activity Settings button is an explicit one-off test. It may
        // run a reviewed ready module without permanently enabling it.
        force: true
      });
    });

    ipcMain.handle(MODULE_IPC_CHANNELS.GET_RUNTIME_STATUS, async (_event, profileId, moduleCode) => {
      ensureWorkerServicesReady();
      return moduleRunner.getRuntimeStatus(profileId, moduleCode);
    });

    ipcMain.handle(MODULE_IPC_CHANNELS.LIST_RUNTIME_STATUSES, async () => {
      ensureWorkerServicesReady();
      return moduleRunner.listRuntimeStatuses();
    });

    // Phase 06A Worker Core IPC
    ipcMain.handle(WORKER_IPC_CHANNELS.START_PROFILES, async (_event, profileIds, options) => {
      ensureWorkerServicesReady();
      return workerManager.startProfiles(profileIds, options || {});
    });

    ipcMain.handle(WORKER_IPC_CHANNELS.STOP_PROFILES, async (_event, profileIds) => {
      ensureWorkerServicesReady();
      return workerManager.stopProfiles(profileIds, 'user');
    });

    ipcMain.handle(WORKER_IPC_CHANNELS.GET_STATUS, async (_event, profileId) => {
      ensureWorkerServicesReady();
      return workerManager.getStatus(profileId);
    });

    ipcMain.handle(WORKER_IPC_CHANNELS.LIST_STATUSES, async () => {
      ensureWorkerServicesReady();
      return workerManager.listStatuses();
    });

    ipcMain.handle(WORKER_IPC_CHANNELS.GET_SUMMARY, async () => {
      ensureWorkerServicesReady();
      return workerManager.getSummary();
    });

    ipcMain.handle(WORKER_IPC_CHANNELS.RUN_GROUP, async (_event, groupIdOrName) => {
      ensureWorkerServicesReady();
      return workerManager.startGroup(groupIdOrName);
    });

    ipcMain.handle(WORKER_IPC_CHANNELS.STOP_GROUP, async (_event, groupIdOrName) => {
      ensureWorkerServicesReady();
      return workerManager.stopGroup(groupIdOrName);
    });

    ipcMain.handle('batches:list', async () => {
      ensureWorkerServicesReady();
      return batchRepository.list();
    });

    ipcMain.handle('batches:create', async (_event, input) => {
      ensureWorkerServicesReady();
      const batch = await batchRepository.create(input);
      await workerManager.broadcastBatchesChanged();
      return batch;
    });

    ipcMain.handle('batches:update', async (_event, batchId, changes) => {
      ensureWorkerServicesReady();
      const batch = await batchRepository.update(batchId, changes);
      await workerManager.broadcastBatchesChanged();
      return batch;
    });

    ipcMain.handle('batches:delete', async (_event, batchId) => {
      ensureWorkerServicesReady();
      const batch = await batchRepository.getById(batchId);
      if (batch?.status === 'Running') {
        await workerManager.stopBatch(batchId);
      }
      const deleted = await batchRepository.delete(batchId);
      await workerManager.broadcastBatchesChanged();
      return deleted;
    });

    ipcMain.handle('batches:start', async (_event, batchId) => {
      ensureWorkerServicesReady();
      await workerManager.startBatch(batchId);
      return true;
    });

    ipcMain.handle('batches:stop', async (_event, batchId) => {
      ensureWorkerServicesReady();
      return workerManager.stopBatch(batchId);
    });

    ipcMain.handle('batches:reset', async (_event, batchId) => {
      ensureWorkerServicesReady();
      const batch = await batchRepository.getById(batchId);
      if (batch?.status === 'Running') {
        await workerManager.stopBatch(batchId);
      }
      const reset = await batchRepository.reset(batchId);
      await workerManager.broadcastBatchesChanged();
      return reset;
    });

    ipcMain.handle('logs:list', async (_event, limit) => {
      ensureWorkerServicesReady();
      return workerLogRepository.listLogs(limit);
    });

    ipcMain.handle('logs:clear', async () => {
      ensureWorkerServicesReady();
      const result = await workerLogRepository.clear();
      await workerManager.broadcastLogsChanged();
      return result;
    });

    ipcMain.handle('settings:activity:get', async () => {
      ensureWorkerServicesReady();
      return workerSettingsRepository.getActivityConfig();
    });

    ipcMain.handle('settings:activity:save', async (_event, config) => {
      ensureWorkerServicesReady();
      const result = await workerSettingsRepository.saveActivityConfig(config);
      await workerManager.setMaxConcurrency(result.maxConcurrentProfiles);
      return result;
    });

    ipcMain.handle('settings:general:get', async () => {
      ensureWorkerServicesReady();
      return workerSettingsRepository.getGeneralSettings();
    });

    ipcMain.handle('settings:general:save', async (_event, settings) => {
      ensureWorkerServicesReady();
      const previous = workerSettingsRepository.getGeneralSettings();
      const result = await workerSettingsRepository.saveGeneralSettings(settings);
      const websiteChanged =
        previous.websiteBaseUrl !== result.websiteBaseUrl ||
        JSON.stringify(previous.websiteAllowedHosts || []) !== JSON.stringify(result.websiteAllowedHosts || []);

      await workerManager.setMaxConcurrency(result.maxThreads);

      if (websiteChanged) {
        // Avoid mixed-domain runtime state. Cookies and persistent partitions are
        // preserved; only active workers/windows are stopped and may be reopened.
        await workerManager.stopAll('website-domain-change');
        await profileBrowserManager.closeAllBrowsers();
        broadcast('website:config-changed', {
          baseUrl: result.websiteBaseUrl,
          allowedHosts: [...result.websiteAllowedHosts]
        });
      }

      return result;
    });

    ipcMain.handle('system:get-stats', async () => {
      ensureWorkerServicesReady();
      return systemStatsService.getStats();
    });

  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1600,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      show: false,
      title: 'HH3D Desktop Tool',
      backgroundColor: '#080f20',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        devTools: isDevelopment
      }
    });

    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      if (isDevelopment) {
        try {
          if (new URL(navigationUrl).origin === new URL(devUrl).origin) return;
        } catch {}
      }
      event.preventDefault();
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const loadPromise = isDevelopment
      ? mainWindow.loadURL(devUrl)
      : mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    loadPromise.catch(error => console.error('[Electron] Không thể tải giao diện:', error));
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await db.init();
      databaseReady = true;
    } catch (error) {
      databaseInitError = error;
      console.error('[Electron Main] Database init failed:', error);
    }

    if (databaseReady) {
      try {
        await proxySecretStore.init();
        proxyServicesReady = true;
      } catch (error) {
        proxyServicesInitError = error;
        console.error('[Electron Main] Proxy services init failed:', error);
      }
    }

    if (proxyServicesReady) {
      try {
        await workerManager.init();
        workerServicesReady = true;
        systemStatsService.start();
      } catch (error) {
        workerServicesInitError = error;
        console.error('[Electron Main] Worker services init failed:', error);
      }
    }

    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  let isQuitting = false;
  app.on('before-quit', async event => {
    if (isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    systemStatsService.stop();
    try {
      if (workerServicesReady) await workerManager.stopAll('app-quit');
    } catch (error) {
      console.error('[Electron Main] Error stopping workers on quit:', error);
    }
    try { await profileBrowserManager.closeAllBrowsers(); } catch (error) {
      console.error('[Electron Main] Error closing browsers on quit:', error);
    }
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
