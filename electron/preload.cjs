const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('desktopBridge', {
  getVersions: () => ipcRenderer.invoke('app:get-versions'),
  getStorageInfo: () => ipcRenderer.invoke('storage:get-info'),

  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  createProfile: profile => ipcRenderer.invoke('profiles:create', profile),
  updateProfile: (profileId, changes) => ipcRenderer.invoke('profiles:update', profileId, changes),
  deleteProfile: profileId => ipcRenderer.invoke('profiles:delete', profileId),

  listGroups: () => ipcRenderer.invoke('groups:list'),
  createGroup: group => ipcRenderer.invoke('groups:create', group),
  updateGroup: (groupId, changes) => ipcRenderer.invoke('groups:update', groupId, changes),
  deleteGroup: groupId => ipcRenderer.invoke('groups:delete', groupId),

  openMiniBrowser: profileId => ipcRenderer.invoke('mini-browser:open', profileId),
  closeMiniBrowser: profileId => ipcRenderer.invoke('mini-browser:close', profileId),
  focusMiniBrowser: profileId => ipcRenderer.invoke('mini-browser:focus', profileId),
  reloadMiniBrowser: profileId => ipcRenderer.invoke('mini-browser:reload', profileId),
  getMiniBrowserStatus: profileId => ipcRenderer.invoke('mini-browser:get-status', profileId),
  listMiniBrowserStatuses: () => ipcRenderer.invoke('mini-browser:list-statuses'),
  clearMiniBrowserSession: profileId => ipcRenderer.invoke('mini-browser:clear-session', profileId),
  onMiniBrowserStatusChanged: callback => subscribe('mini-browser:status-changed', callback),

  listProxies: () => ipcRenderer.invoke('proxies:list'),
  getProxy: proxyId => ipcRenderer.invoke('proxies:get', proxyId),
  createProxy: input => ipcRenderer.invoke('proxies:create', input),
  updateProxy: (proxyId, changes) => ipcRenderer.invoke('proxies:update', proxyId, changes),
  deleteProxy: proxyId => ipcRenderer.invoke('proxies:delete', proxyId),
  importProxies: items => ipcRenderer.invoke('proxies:import', items),
  testProxy: proxyId => ipcRenderer.invoke('proxies:test', proxyId),
  testManyProxies: proxyIds => ipcRenderer.invoke('proxies:test-many', proxyIds),
  assignProxyToProfiles: (profileIds, proxyId) => ipcRenderer.invoke('proxies:assign-profiles', profileIds, proxyId),
  assignProxiesOneToOne: (profileIds, proxyIds) => ipcRenderer.invoke('proxies:assign-one-to-one', profileIds, proxyIds),
  replaceProfilesForProxy: (proxyId, profileIds) => ipcRenderer.invoke('proxies:replace-profile-assignments', proxyId, profileIds),
  unassignProxyFromProfiles: profileIds => ipcRenderer.invoke('proxies:unassign-profiles', profileIds),
  getProfileProxyState: profileId => ipcRenderer.invoke('proxies:get-profile-state', profileId),
  refreshProfileProxy: profileId => ipcRenderer.invoke('proxies:refresh-profile', profileId),
  getProxyStorageInfo: () => ipcRenderer.invoke('proxies:get-storage-info'),
  onProxiesChanged: callback => subscribe('proxies:changed', callback),
  onProxyTestStatusChanged: callback => subscribe('proxy-test:status-changed', callback),
  onProfileProxyStateChanged: callback => subscribe('profile-proxy:state-changed', callback),

  startWorkers: (profileIds, options) => ipcRenderer.invoke('workers:start-profiles', profileIds, options),
  stopWorkers: profileIds => ipcRenderer.invoke('workers:stop-profiles', profileIds),
  getWorkerStatus: profileId => ipcRenderer.invoke('workers:get-status', profileId),
  listWorkerStatuses: () => ipcRenderer.invoke('workers:list-statuses'),
  getWorkerSummary: () => ipcRenderer.invoke('workers:get-summary'),
  runWorkerGroup: groupIdOrName => ipcRenderer.invoke('workers:run-group', groupIdOrName),
  stopWorkerGroup: groupIdOrName => ipcRenderer.invoke('workers:stop-group', groupIdOrName),
  onWorkerStatusChanged: callback => subscribe('workers:status-changed', callback),
  onWorkerSummaryChanged: callback => subscribe('workers:summary-changed', callback),
  onProfilesChanged: callback => subscribe('profiles:changed', callback),

  listBatches: () => ipcRenderer.invoke('batches:list'),
  createBatch: input => ipcRenderer.invoke('batches:create', input),
  updateBatch: (batchId, changes) => ipcRenderer.invoke('batches:update', batchId, changes),
  deleteBatch: batchId => ipcRenderer.invoke('batches:delete', batchId),
  startBatch: batchId => ipcRenderer.invoke('batches:start', batchId),
  stopBatch: batchId => ipcRenderer.invoke('batches:stop', batchId),
  resetBatch: batchId => ipcRenderer.invoke('batches:reset', batchId),
  onBatchesChanged: callback => subscribe('batches:changed', callback),

  listLogs: limit => ipcRenderer.invoke('logs:list', limit),
  clearWorkerLogs: () => ipcRenderer.invoke('logs:clear'),
  onLogsChanged: callback => subscribe('logs:changed', callback),

  getActivityConfig: () => ipcRenderer.invoke('settings:activity:get'),
  saveActivityConfig: config => ipcRenderer.invoke('settings:activity:save', config),
  getGeneralSettings: () => ipcRenderer.invoke('settings:general:get'),
  saveGeneralSettings: settings => ipcRenderer.invoke('settings:general:save', settings),
  getSystemStats: () => ipcRenderer.invoke('system:get-stats'),
  onStatsChanged: callback => subscribe('stats:changed', callback)
});
