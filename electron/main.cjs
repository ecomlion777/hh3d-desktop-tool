const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Chỉ cho phép chạy một phiên bản ứng dụng.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;

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

  ipcMain.handle('app:get-versions', () => {
    return {
      appVersion: app.getVersion(),
      electronVersion:
        process.versions.electron || 'unknown',
      chromiumVersion:
        process.versions.chrome || 'unknown',
      nodeVersion:
        process.versions.node || 'unknown',
    };
  });

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

  app.whenReady().then(() => {
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
