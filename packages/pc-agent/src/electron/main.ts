/**
 * Electron main process entry point for DeskPilot PC Agent.
 *
 * Creates a compact status window showing pairing code and connection state.
 * Runs in system tray when minimized. Uses trtc-electron-sdk for native
 * screen capture — no browser workaround needed.
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, systemPreferences, ipcMain } from 'electron';
import { resolve } from 'node:path';
import { destroyTRTC } from '../trtc/room.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/**
 * Creates the status window for displaying pairing code and state.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 240,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hiddenInset',
    title: 'DeskPilot',
    backgroundColor: '#0f0f23',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load the status UI
  mainWindow.loadFile(resolve(__dirname, '../../static/index.html'));

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Renderer page loaded');
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Creates the system tray icon and menu.
 */
function createTray(): void {
  // Create a simple tray icon (16x16 template image)
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle('DP');
  tray.setToolTip('DeskPilot Agent');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show DeskPilot',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

/**
 * Checks macOS screen recording permission.
 * @returns Whether screen capture is allowed
 */
function checkScreenPermission(): boolean {
  if (process.platform !== 'darwin') return true;

  const status = systemPreferences.getMediaAccessStatus('screen');
  console.log(`[Electron] Screen recording permission: ${status}`);

  if (status === 'denied') {
    console.error('[Electron] Screen Recording permission denied.');
    console.error('[Electron] Enable in: System Settings → Privacy & Security → Screen Recording');
    return false;
  }

  // 'not-determined' or 'granted' — macOS will prompt on first capture attempt
  return true;
}

/**
 * Updates the window UI with pairing code and status.
 * Called from the daemon via IPC.
 */
function updateStatus(data: { pairingCode?: string; status?: string; roomId?: string }): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-update', data);
  }
}

// Expose updateStatus for the daemon to call
ipcMain.on('update-status', (_event, data) => {
  updateStatus(data);
});

// App lifecycle
app.whenReady().then(async () => {
  const hasPermission = checkScreenPermission();
  if (!hasPermission) {
    console.warn('[Electron] Screen capture may not work without permission.');
  }

  createWindow();
  createTray();

  console.log('[Electron] DeskPilot Agent started');

  // Bootstrap the daemon
  await import('../index.js');
}).catch((err: unknown) => {
  console.error('[Electron] Failed to start:', err);
  app.quit();
});

// Cleanup on quit
app.on('before-quit', () => {
  isQuitting = true;
  destroyTRTC();
});

app.on('window-all-closed', () => {
  // Don't quit on macOS — keep running in tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

export { updateStatus };
