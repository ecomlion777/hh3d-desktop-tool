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
  deleteGroup: (groupId) => ipcRenderer.invoke('groups:delete', groupId)
});
