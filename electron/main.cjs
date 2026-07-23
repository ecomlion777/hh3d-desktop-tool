const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const JsonDatabase = require('./storage/JsonDatabase.cjs');
const ProfileRepository = require('./storage/ProfileRepository.cjs');
const GroupRepository = require('./storage/GroupRepository.cjs');

// Chỉ cho phép chạy một phiên bản ứng dụng.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;
  let databaseReady = false;
  let databaseInitError = null;

  // Khởi tạo Database & Repositories
  const db = new JsonDatabase();
  const profileRepo = new ProfileRepository(db);
  const groupRepo = new GroupRepository(db);

  function ensureDatabaseReady() {
    if (!databaseReady) {
      throw new Error(
        `Local JSON Database chưa sẵn sàng: ${
          databaseInitError?.message || 'Unknown initialization error'
        }`
      );
    }
  }

  /**
   * Register IPC Handlers for Storage, Profiles, and Groups
   */
  function registerIpcHandlers() {
    ipcMain.handle('app:get-versions', () => {
      return {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron || 'unknown',
        chromiumVersion: process.versions.chrome || 'unknown',
        nodeVersion: process.versions.node || 'unknown',
      };
    });

    // Storage Info
    ipcMain.handle('storage:get-info', async () => {
      ensureDatabaseReady();
      return db.getStorageInfo();
    });

    // Profiles IPC
    ipcMain.handle('profiles:list', async () => {
      ensureDatabaseReady();
      return await profileRepo.listProfiles();
    });

    ipcMain.handle('profiles:create', async (_event, profileData) => {
      ensureDatabaseReady();
      return await profileRepo.createProfile(profileData);
    });

    ipcMain.handle('profiles:update', async (_event, profileId, changes) => {
      ensureDatabaseReady();
      return await profileRepo.updateProfile(profileId, changes);
    });

    ipcMain.handle('profiles:delete', async (_event, profileId) => {
      ensureDatabaseReady();
      return await profileRepo.deleteProfile(profileId);
    });

    // Groups IPC
    ipcMain.handle('groups:list', async () => {
      ensureDatabaseReady();
      return await groupRepo.listGroups();
    });

    ipcMain.handle('groups:create', async (_event, groupData) => {
      ensureDatabaseReady();
      return await groupRepo.createGroup(groupData);
    });

    ipcMain.handle('groups:update', async (_event, groupId, changes) => {
      ensureDatabaseReady();
      return await groupRepo.updateGroup(groupId, changes);
    });

    ipcMain.handle('groups:delete', async (_event, groupId) => {
      ensureDatabaseReady();
      return await groupRepo.deleteGroup(groupId);
    });
  }

  /**
   * Tạo cửa sổ chính của HH3D Desktop Tool.
   */
  function createWindow() {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const isDevelopment = Boolean(devUrl);

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
        devTools: isDevelopment,
      },
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });

    mainWindow.webContents.on(
      'will-navigate',
      (event, navigationUrl) => {
        if (isDevelopment) {
          try {
            const allowedOrigin = new URL(devUrl).origin;
            const requestedOrigin = new URL(navigationUrl).origin;

            if (requestedOrigin === allowedOrigin) {
              return;
            }
          } catch (error) {
            console.error(
              '[Electron] Không phân tích được URL điều hướng:',
              error,
            );
          }
        }

        event.preventDefault();
      },
    );

    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    mainWindow.webContents.on(
      'did-fail-load',
      (
        _event,
        errorCode,
        errorDescription,
        validatedUrl,
      ) => {
        console.error('[Electron] Tải giao diện thất bại:', {
          errorCode,
          errorDescription,
          validatedUrl,
        });
      },
    );

    const loadPromise = isDevelopment
      ? mainWindow.loadURL(devUrl)
      : mainWindow.loadFile(
          path.join(__dirname, '..', 'dist', 'index.html'),
        );

    loadPromise.catch((error) => {
      console.error(
        '[Electron] Không thể tải giao diện ứng dụng:',
        error,
      );
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await db.init();
      databaseReady = true;
    } catch (err) {
      databaseReady = false;
      databaseInitError = err;
      console.error('[Electron Main] Database init failed:', err);
    }

    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
