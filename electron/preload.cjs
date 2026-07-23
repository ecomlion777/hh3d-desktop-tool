const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script
 * Exposes strictly safe methods on window.desktopBridge via contextBridge.
 * Does NOT expose raw ipcRenderer, send, on, or invoke directly.
 */
contextBridge.exposeInMainWorld('desktopBridge', {
  getVersions: () => ipcRenderer.invoke('app:get-versions'),
  
  // Storage Info
  getStorageInfo: () => ipcRenderer.invoke('storage:get-info'),

  // Profiles
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  createProfile: (profile) => ipcRenderer.invoke('profiles:create', profile),
  updateProfile: (profileId, changes) => ipcRenderer.invoke('profiles:update', profileId, changes),
  deleteProfile: (profileId) => ipcRenderer.invoke('profiles:delete', profileId),

  // Groups
  listGroups: () => ipcRenderer.invoke('groups:list'),
  createGroup: (group) => ipcRenderer.invoke('groups:create', group),
  updateGroup: (groupId, changes) => ipcRenderer.invoke('groups:update', groupId, changes),
  deleteGroup: (groupId) => ipcRenderer.invoke('groups:delete', groupId),

  // Mini Browser
  openMiniBrowser: (profileId) => ipcRenderer.invoke('mini-browser:open', profileId),
  closeMiniBrowser: (profileId) => ipcRenderer.invoke('mini-browser:close', profileId),
  focusMiniBrowser: (profileId) => ipcRenderer.invoke('mini-browser:focus', profileId),
  reloadMiniBrowser: (profileId) => ipcRenderer.invoke('mini-browser:reload', profileId),
  getMiniBrowserStatus: (profileId) => ipcRenderer.invoke('mini-browser:get-status', profileId),
  listMiniBrowserStatuses: () => ipcRenderer.invoke('mini-browser:list-statuses'),
  clearMiniBrowserSession: (profileId) => ipcRenderer.invoke('mini-browser:clear-session', profileId),
  onMiniBrowserStatusChanged: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('mini-browser:status-changed', subscription);
    return () => {
      ipcRenderer.removeListener('mini-browser:status-changed', subscription);
    };
  }
});
