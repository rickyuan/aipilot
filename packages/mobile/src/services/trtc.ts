/**
 * TRTC wrapper service for React Native.
 *
 * Abstracts the trtc-react-native SDK with a graceful mock fallback
 * when the native module is not linked.
 */

import { EventEmitter } from 'eventemitter3';
import type { TRTCRoomConfig, CommandResult } from '@deskpilot/shared';

/** Event types emitted by the TRTC service */
export type TRTCEvent =
  | { type: 'onRemoteUserEnterRoom'; userId: string }
  | { type: 'onRemoteUserLeaveRoom'; userId: string }
  | { type: 'onUserVideoAvailable'; userId: string; available: boolean }
  | { type: 'onCommandResult'; result: CommandResult }
  | { type: 'onError'; code: number; message: string };

export const trtcEvents = new EventEmitter<{
  event: [TRTCEvent];
}>();

let trtcEngine: unknown = null;
let isNativeAvailable = false;

/**
 * Initializes the TRTC engine.
 * @param sdkAppId - TRTC SDKAppID
 */
export function initTRTC(sdkAppId: number): void {
  try {
    // Dynamically require the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TRTCModule = require('trtc-react-native');
    const TRTCCloud = TRTCModule.default ?? TRTCModule.TRTCCloud;

    if (TRTCCloud) {
      trtcEngine = TRTCCloud.sharedInstance();
      isNativeAvailable = true;
      registerNativeEventListeners();
      console.log(`[TRTC] Native engine initialized with SDKAppID: ${String(sdkAppId)}`);
    }
  } catch {
    console.log('[TRTC] Native module not available, running in mock mode');
    isNativeAvailable = false;
  }
}

/**
 * Registers event listeners on the native TRTC engine.
 */
function registerNativeEventListeners(): void {
  if (!trtcEngine) return;

  const engine = trtcEngine as {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  engine.on('onRemoteUserEnterRoom', (userId: unknown) => {
    trtcEvents.emit('event', { type: 'onRemoteUserEnterRoom', userId: String(userId) });
  });

  engine.on('onRemoteUserLeaveRoom', (userId: unknown) => {
    trtcEvents.emit('event', { type: 'onRemoteUserLeaveRoom', userId: String(userId) });
  });

  engine.on('onUserVideoAvailable', (userId: unknown, available: unknown) => {
    trtcEvents.emit('event', {
      type: 'onUserVideoAvailable',
      userId: String(userId),
      available: Boolean(available),
    });
  });

  engine.on('onRecvCustomCmdMsg', (_userId: unknown, _cmdId: unknown, _seq: unknown, msg: unknown) => {
    try {
      const result = JSON.parse(String(msg)) as CommandResult;
      trtcEvents.emit('event', { type: 'onCommandResult', result });
    } catch {
      // ignore invalid messages
    }
  });

  engine.on('onError', (code: unknown, message: unknown) => {
    trtcEvents.emit('event', {
      type: 'onError',
      code: Number(code),
      message: String(message),
    });
  });
}

/**
 * Joins a TRTC room.
 * @param config - TRTC room configuration
 */
export function joinRoom(config: TRTCRoomConfig): void {
  if (!trtcEngine || !isNativeAvailable) {
    console.log(`[TRTC Mock] Joining room ${config.roomId} as ${config.userId}`);
    return;
  }

  const engine = trtcEngine as {
    enterRoom: (params: Record<string, unknown>, scene: number) => void;
  };

  engine.enterRoom(
    {
      sdkAppId: config.sdkAppId,
      strRoomId: config.roomId,
      userId: config.userId,
      userSig: config.userSig,
    },
    0, // TRTCAppSceneVideoCall
  );
}

/**
 * Leaves the current TRTC room.
 */
export function leaveRoom(): void {
  if (!trtcEngine || !isNativeAvailable) {
    console.log('[TRTC Mock] Leaving room');
    return;
  }

  const engine = trtcEngine as { exitRoom: () => void };
  engine.exitRoom();
}

/**
 * Starts publishing microphone audio.
 */
export function startMicCapture(): void {
  if (!trtcEngine || !isNativeAvailable) {
    console.log('[TRTC Mock] Mic capture started');
    return;
  }

  const engine = trtcEngine as {
    startLocalAudio: (quality: number) => void;
  };
  engine.startLocalAudio(1); // TRTCAudioQualitySpeech
}

/**
 * Stops publishing microphone audio.
 */
export function stopMicCapture(): void {
  if (!trtcEngine || !isNativeAvailable) {
    console.log('[TRTC Mock] Mic capture stopped');
    return;
  }

  const engine = trtcEngine as { stopLocalAudio: () => void };
  engine.stopLocalAudio();
}

/**
 * Returns the TRTC engine instance (for TRTCVideoView rendering).
 * @returns The engine instance or null
 */
export function getEngine(): unknown {
  return trtcEngine;
}

/**
 * Returns whether the native TRTC module is available.
 * @returns Whether native TRTC is linked
 */
export function isNativeModuleAvailable(): boolean {
  return isNativeAvailable;
}
