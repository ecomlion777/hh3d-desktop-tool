const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script
 * Exposes strictly desktopBridge.getVersions() via contextBridge.
 * Does NOT expose raw ipcRenderer or Node modules.
 */
contextBridge.exposeInMainWorld('desktopBridge', {
  getVersions: () => ipcRenderer.invoke('app:get-versions')
});
