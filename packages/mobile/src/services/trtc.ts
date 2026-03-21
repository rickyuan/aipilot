/**
 * TRTC wrapper service for React Native.
 *
 * Abstracts the trtc-react-native SDK.
 * NOTE: trtc-react-native must be installed separately with native linking.
 * This module provides the interface — actual SDK calls are gated behind
 * a runtime check so the app can still build without the native module.
 */

import type { TRTCRoomConfig } from '@deskpilot/shared';

let trtcEngine: unknown = null;

/**
 * Initializes the TRTC engine.
 * @param sdkAppId - TRTC SDKAppID
 */
export function initTRTC(sdkAppId: number): void {
  try {
    // TODO: Import and initialize trtc-react-native when native module is linked
    // const { TRTCCloud } = require('trtc-react-native');
    // trtcEngine = TRTCCloud.sharedInstance();
    console.log(`[TRTC] Engine initialized with SDKAppID: ${String(sdkAppId)}`);
  } catch (err: unknown) {
    console.warn('[TRTC] Native module not available, running in mock mode');
  }
}

/**
 * Joins a TRTC room.
 * @param config - TRTC room configuration
 */
export function joinRoom(config: TRTCRoomConfig): void {
  if (!trtcEngine) {
    console.log(`[TRTC Mock] Joining room ${config.roomId} as ${config.userId}`);
    return;
  }

  // TODO: trtcEngine.enterRoom(...)
}

/**
 * Leaves the current TRTC room.
 */
export function leaveRoom(): void {
  if (!trtcEngine) {
    console.log('[TRTC Mock] Leaving room');
    return;
  }

  // TODO: trtcEngine.exitRoom()
}

/**
 * Starts publishing microphone audio.
 */
export function startMicCapture(): void {
  if (!trtcEngine) {
    console.log('[TRTC Mock] Mic capture started');
    return;
  }

  // TODO: trtcEngine.startLocalAudio(...)
}

/**
 * Stops publishing microphone audio.
 */
export function stopMicCapture(): void {
  if (!trtcEngine) {
    console.log('[TRTC Mock] Mic capture stopped');
    return;
  }

  // TODO: trtcEngine.stopLocalAudio()
}

/**
 * Returns the TRTC engine instance (for TRTCVideoView rendering).
 * @returns The engine instance or null
 */
export function getEngine(): unknown {
  return trtcEngine;
}
