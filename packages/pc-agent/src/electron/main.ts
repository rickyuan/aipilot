/**
 * Electron main process entry point for the PC Agent.
 *
 * Creates a minimal window (can be hidden/tray-only later),
 * prompts for Screen Recording permission on macOS,
 * and bootstraps the PC Agent daemon.
 */

import { app, BrowserWindow, systemPreferences } from 'electron';
import { resolve } from 'node:path';

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 360,
    title: 'DeskPilot Agent',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load a simple status page
  await mainWindow.loadFile(resolve(__dirname, '../../static/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function checkScreenPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;

  const status = systemPreferences.getMediaAccessStatus('screen');
  if (status === 'granted') return true;

  console.log('[Electron] Screen Recording permission not granted. Requesting...');
  // On macOS, we can't programmatically request screen recording.
  // The OS will prompt when we try to capture. Just log the status.
  console.log(`[Electron] Current screen permission status: ${status}`);
  return status !== 'denied';
}

app.whenReady().then(async () => {
  const hasPermission = await checkScreenPermission();
  if (!hasPermission) {
    console.error('[Electron] Screen Recording permission denied. Please enable in System Preferences.');
  }

  await createWindow();

  // Bootstrap the agent daemon
  await import('../index.js');
}).catch((err: unknown) => {
  console.error('[Electron] Failed to start:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});
