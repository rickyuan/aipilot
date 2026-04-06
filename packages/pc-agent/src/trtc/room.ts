/**
 * TRTC room management — join, leave, screen capture, and custom messaging.
 *
 * TRTC Electron SDK runs in the renderer process (requires `window`).
 * This module communicates with the renderer via Electron IPC.
 * Falls back to WebSocket-only mode when not running in Electron.
 */

import { EventEmitter } from 'node:events';
import type { TRTCRoomConfig, CommandPayload, CommandResult } from '@deskpilot/shared';
import { EventName, isWithinMessageLimit } from '@deskpilot/shared';

/** Room event bus for internal message routing */
export const roomEvents = new EventEmitter();

let currentRoomConfig: TRTCRoomConfig | null = null;
let electronIPC: ElectronIPC | null = null;
let rendererReady = false;
let pendingRoomConfig: TRTCRoomConfig | null = null;

interface ElectronIPC {
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, handler: (...args: unknown[]) => void) => void;
}

/**
 * Tries to get Electron's ipcMain for renderer communication.
 * Returns null if not running in Electron.
 */
function tryGetIPC(): ElectronIPC | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ipcMain, BrowserWindow } = require('electron');

    // Create a wrapper that sends to the first BrowserWindow
    return {
      send(channel: string, ...args: unknown[]) {
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
          wins[0].webContents.send(channel, ...args);
        }
      },
      on(channel: string, handler: (...args: unknown[]) => void) {
        ipcMain.on(channel, (_event: unknown, ...args: unknown[]) => {
          handler(...args);
        });
      },
    };
  } catch {
    return null;
  }
}

/**
 * Sets up IPC listeners for TRTC events from the renderer process.
 */
function setupIPCListeners(): void {
  if (!electronIPC) return;

  electronIPC.on('trtc-ready', (ready: unknown) => {
    console.log(`[TRTC] Renderer SDK ready: ${String(ready)}`);
    rendererReady = Boolean(ready);
    // If we already have a room config, resend to renderer
    if (rendererReady && currentRoomConfig && electronIPC) {
      console.log('[TRTC] Resending room config to ready renderer');
      electronIPC.send('trtc-enter-room', {
        sdkAppId: currentRoomConfig.sdkAppId,
        roomId: currentRoomConfig.roomId,
        userId: currentRoomConfig.userId,
        userSig: currentRoomConfig.userSig,
      });
    }
  });

  electronIPC.on('trtc-entered-room', (elapsed: unknown) => {
    console.log(`[TRTC] Entered room in ${String(elapsed)}ms`);
  });

  electronIPC.on('trtc-screen-started', () => {
    console.log('[TRTC] Screen capture started from renderer');
  });

  electronIPC.on('trtc-error', (error: unknown) => {
    console.error(`[TRTC] Error from renderer: ${String(error)}`);
  });

  electronIPC.on('trtc-remote-user-enter', (userId: unknown) => {
    console.log(`[TRTC] Remote user joined: ${String(userId)}`);
    roomEvents.emit(EventName.ROOM_PARTICIPANT_JOINED, {
      userId: String(userId),
      role: String(userId).startsWith('bot_') ? 'ai-bot' : 'mobile',
    });
  });

  electronIPC.on('trtc-remote-user-leave', (userId: unknown) => {
    console.log(`[TRTC] Remote user left: ${String(userId)}`);
    roomEvents.emit(EventName.ROOM_PARTICIPANT_LEFT, { userId: String(userId) });
  });

  electronIPC.on('trtc-custom-msg', (data: unknown) => {
    try {
      const { msg } = data as { userId: string; cmdId: number; seq: number; msg: string };
      const command = JSON.parse(msg) as CommandPayload;
      console.log(`[TRTC] Received command: ${command.intentType} → ${command.executor}`);
      roomEvents.emit(EventName.COMMAND_RECEIVED, command);
    } catch (err: unknown) {
      console.error('[TRTC] Failed to parse custom message:', err);
    }
  });
}

/**
 * Initializes IPC connection to Electron renderer (idempotent).
 */
function initIPC(): void {
  if (electronIPC) return;
  electronIPC = tryGetIPC();
  if (electronIPC) {
    setupIPCListeners();
    console.log('[TRTC] IPC bridge to renderer established');
  }
}

/**
 * Returns whether the TRTC Electron SDK is available.
 */
export function isTRTCAvailable(): boolean {
  if (!electronIPC) initIPC();
  return electronIPC !== null;
}

/**
 * Joins a TRTC room with the given configuration.
 * @param roomConfig - TRTC room configuration (from Cloud API)
 */
export async function joinRoom(roomConfig: TRTCRoomConfig): Promise<void> {
  currentRoomConfig = roomConfig;

  initIPC();

  if (electronIPC) {
    // Always send to renderer — renderer has its own queue if SDK isn't ready yet
    console.log(`[TRTC] Joining room ${roomConfig.roomId} via renderer process`);
    electronIPC.send('trtc-enter-room', {
      sdkAppId: roomConfig.sdkAppId,
      roomId: roomConfig.roomId,
      userId: roomConfig.userId,
      userSig: roomConfig.userSig,
    });
  } else {
    console.log(`[TRTC] Room ${roomConfig.roomId} — running without Electron SDK (WebSocket relay only)`);
  }

  roomEvents.emit(EventName.ROOM_PARTICIPANT_JOINED, {
    userId: roomConfig.userId,
    role: 'pc-agent',
  });
}

/**
 * Starts screen capture (triggered automatically after entering room in renderer).
 */
export async function startScreenCapture(): Promise<void> {
  if (!currentRoomConfig) {
    throw new Error('Must join a room before starting screen capture');
  }
  // Screen capture is auto-started by renderer after onEnterRoom
  console.log('[TRTC] Screen capture managed by renderer process');
}

/**
 * Sends a command result back via TRTC custom message.
 * @param result - The command execution result
 */
export function sendCommandResult(result: CommandResult): void {
  const payload = JSON.stringify(result);

  if (!isWithinMessageLimit(payload)) {
    console.warn('[TRTC] Command result exceeds 32KB limit, truncating');
    const truncated: CommandResult = {
      ...result,
      output: result.output.slice(0, 20000) + '\n... (truncated)',
    };
    sendResultPayload(truncated);
    return;
  }

  sendResultPayload(result);
}

/**
 * Sends a result payload via TRTC custom message (through renderer IPC).
 */
function sendResultPayload(result: CommandResult): void {
  if (electronIPC) {
    electronIPC.send('trtc-send-custom-msg', JSON.stringify(result));
  }
  roomEvents.emit(EventName.COMMAND_COMPLETED, result);
}

/**
 * Registers a handler for incoming command payloads from the AI bot.
 * @param handler - Callback invoked when a command is received
 */
export function onCommandReceived(handler: (command: CommandPayload) => void): void {
  roomEvents.on(EventName.COMMAND_RECEIVED, handler);
}

/**
 * Simulates receiving a command from the AI bot (for testing without TRTC).
 * @param command - The command payload
 */
export function simulateIncomingCommand(command: CommandPayload): void {
  roomEvents.emit(EventName.COMMAND_RECEIVED, command);
}

/**
 * Leaves the current TRTC room and cleans up resources.
 */
export async function leaveRoom(): Promise<void> {
  if (electronIPC) {
    electronIPC.send('trtc-exit-room');
  }

  if (currentRoomConfig) {
    console.log(`[TRTC] Left room ${currentRoomConfig.roomId}`);
    roomEvents.emit(EventName.ROOM_PARTICIPANT_LEFT, {
      userId: currentRoomConfig.userId,
    });
    currentRoomConfig = null;
  }
}

/**
 * Destroys the TRTC SDK instance. Call on app exit.
 */
export function destroyTRTC(): void {
  if (electronIPC) {
    electronIPC.send('trtc-exit-room');
  }
  electronIPC = null;
  console.log('[TRTC] Cleanup complete');
}
