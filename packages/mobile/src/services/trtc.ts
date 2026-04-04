/**
 * TRTC wrapper service for React Native.
 *
 * Uses trtc-react-native SDK (TRTCCloud + TXVideoView).
 * Falls back to mock mode when the native module is not linked.
 */

import { EventEmitter } from 'eventemitter3';
import type { TRTCRoomConfig, CommandResult } from '@deskpilot/shared';

/** Event types emitted by the TRTC service */
export type TRTCEvent =
  | { type: 'onEnterRoom'; result: number }
  | { type: 'onRemoteUserEnterRoom'; userId: string }
  | { type: 'onRemoteUserLeaveRoom'; userId: string }
  | { type: 'onUserVideoAvailable'; userId: string; available: boolean }
  | { type: 'onUserSubStreamAvailable'; userId: string; available: boolean }
  | { type: 'onUserAudioAvailable'; userId: string; available: boolean }
  | { type: 'onCommandResult'; result: CommandResult }
  | { type: 'onBotSubtitle'; text: string; end: boolean; roundId: string }
  | { type: 'onUserSubtitle'; text: string; end: boolean; roundId: string }
  | { type: 'onBotStatus'; state: number; roundId: string }
  | { type: 'onError'; code: number; message: string };

export const trtcEvents = new EventEmitter<{
  event: [TRTCEvent];
}>();

let trtcCloud: ReturnType<typeof getTRTCCloudInstance> = null;
let isNativeAvailable = false;

/**
 * Tries to get the TRTCCloud singleton.
 */
function getTRTCCloudInstance(): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('trtc-react-native');
    const TRTCCloud = mod.default ?? mod.TRTCCloud;
    if (TRTCCloud?.sharedInstance) {
      return TRTCCloud.sharedInstance();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Initializes the TRTC engine.
 * @param sdkAppId - TRTC SDKAppID
 */
export function initTRTC(sdkAppId: number): void {
  try {
    trtcCloud = getTRTCCloudInstance();
    if (trtcCloud) {
      isNativeAvailable = true;
      registerNativeEventListeners();
      console.log(`[TRTC] Native engine initialized with SDKAppID: ${String(sdkAppId)}`);
    } else {
      console.log('[TRTC] Native module not available, running in mock mode');
    }
  } catch {
    console.log('[TRTC] Native module not available, running in mock mode');
    isNativeAvailable = false;
  }
}

/**
 * Registers event listeners on the native TRTC engine via registerListener.
 */
function registerNativeEventListeners(): void {
  if (!trtcCloud) return;

  const cloud = trtcCloud as {
    registerListener: (listener: (type: string, params: Record<string, unknown>) => void) => void;
  };

  cloud.registerListener((type: string, params: Record<string, unknown>) => {
    console.log(`[TRTC Event] ${type}`, JSON.stringify(params));

    switch (type) {
      case 'onEnterRoom':
        trtcEvents.emit('event', {
          type: 'onEnterRoom',
          result: Number(params['result'] ?? -1),
        });
        break;

      case 'onRemoteUserEnterRoom':
        trtcEvents.emit('event', {
          type: 'onRemoteUserEnterRoom',
          userId: String(params['userId'] ?? ''),
        });
        break;

      case 'onRemoteUserLeaveRoom':
        trtcEvents.emit('event', {
          type: 'onRemoteUserLeaveRoom',
          userId: String(params['userId'] ?? ''),
        });
        break;

      case 'onUserVideoAvailable':
        trtcEvents.emit('event', {
          type: 'onUserVideoAvailable',
          userId: String(params['userId'] ?? ''),
          available: Boolean(params['available']),
        });
        break;

      case 'onUserSubStreamAvailable':
        trtcEvents.emit('event', {
          type: 'onUserSubStreamAvailable',
          userId: String(params['userId'] ?? ''),
          available: Boolean(params['available']),
        });
        break;

      case 'onUserAudioAvailable':
        trtcEvents.emit('event', {
          type: 'onUserAudioAvailable',
          userId: String(params['userId'] ?? ''),
          available: Boolean(params['available']),
        });
        break;

      case 'onRecvCustomCmdMsg': {
        // cmdID 1 = bot messages (subtitles, status)
        // cmdID 2 = client sends (handled elsewhere)
        try {
          const rawData = params['message'] ?? params['data'] ?? '';
          const msg = typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData as ArrayBuffer);
          const parsed = JSON.parse(msg) as { type: number; payload: Record<string, unknown> };

          if (parsed.type === 10000) {
            // Bot subtitle
            const payload = parsed.payload;
            trtcEvents.emit('event', {
              type: 'onBotSubtitle',
              text: String(payload['text'] ?? ''),
              end: Boolean(payload['end']),
              roundId: String(payload['roundid'] ?? ''),
            });
          } else if (parsed.type === 10001) {
            // Bot status: 1=listening, 2=thinking, 3=speaking, 4=interrupted
            const payload = parsed.payload;
            trtcEvents.emit('event', {
              type: 'onBotStatus',
              state: Number(payload['state'] ?? 0),
              roundId: String(payload['roundid'] ?? ''),
            });
          } else if (parsed.type === 10002) {
            // User subtitle (ASR result)
            const payload = parsed.payload;
            trtcEvents.emit('event', {
              type: 'onUserSubtitle',
              text: String(payload['text'] ?? ''),
              end: Boolean(payload['end']),
              roundId: String(payload['roundid'] ?? ''),
            });
          } else {
            // Try legacy format (CommandResult)
            const result = parsed as unknown as CommandResult;
            if (result.commandId) {
              trtcEvents.emit('event', { type: 'onCommandResult', result });
            }
          }
        } catch {
          // ignore invalid messages
        }
        break;
      }

      case 'onWarning':
        console.log(`[TRTC] Warning ${String(params['warningCode'])}: ${String(params['warningMsg'] ?? '')}`);
        break;

      case 'onError':
        trtcEvents.emit('event', {
          type: 'onError',
          code: Number(params['errCode'] ?? 0),
          message: String(params['errMsg'] ?? 'Unknown error'),
        });
        break;

      default:
        console.log(`[TRTC] Unhandled event: ${type}`);
        break;
    }
  });
}

/**
 * Joins a TRTC room.
 * @param config - TRTC room configuration
 */
export function joinRoom(config: TRTCRoomConfig): void {
  if (!trtcCloud || !isNativeAvailable) {
    console.log(`[TRTC Mock] Joining room ${config.roomId} as ${config.userId}`);
    return;
  }

  const cloud = trtcCloud as {
    enterRoom: (params: Record<string, unknown>, scene: number) => void;
  };

  console.log(`[TRTC] Entering room: ${config.roomId} as ${config.userId}`);
  cloud.enterRoom(
    {
      sdkAppId: config.sdkAppId,
      roomId: 0, // Must be 0 when using strRoomId
      strRoomId: config.roomId,
      userId: config.userId,
      userSig: config.userSig,
    },
    0, // TRTC_APP_SCENE_VIDEOCALL
  );
}

/**
 * Leaves the current TRTC room.
 */
export function leaveRoom(): void {
  if (!trtcCloud || !isNativeAvailable) {
    console.log('[TRTC Mock] Leaving room');
    return;
  }

  const cloud = trtcCloud as { exitRoom: () => void };
  cloud.exitRoom();
}

/**
 * Starts publishing microphone audio.
 */
export function startMicCapture(): void {
  if (!trtcCloud || !isNativeAvailable) {
    console.log('[TRTC Mock] Mic capture started');
    return;
  }

  const cloud = trtcCloud as {
    startLocalAudio: (quality: number) => void;
  };
  cloud.startLocalAudio(1); // TRTCAudioQualitySpeech
}

/**
 * Stops publishing microphone audio.
 */
export function stopMicCapture(): void {
  if (!trtcCloud || !isNativeAvailable) {
    console.log('[TRTC Mock] Mic capture stopped');
    return;
  }

  const cloud = trtcCloud as { stopLocalAudio: () => void };
  cloud.stopLocalAudio();
}

/**
 * Returns the TRTC engine instance.
 * @returns The engine instance or null
 */
export function getEngine(): unknown {
  return trtcCloud;
}

/**
 * Returns whether the native TRTC module is available.
 * @returns Whether native TRTC is linked
 */
export function isNativeModuleAvailable(): boolean {
  return isNativeAvailable;
}

/**
 * Returns the TXVideoView component from trtc-react-native if available.
 * @returns The TXVideoView component or null
 */
export function getTXVideoView(): {
  RemoteView: React.ComponentType<Record<string, unknown>>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('trtc-react-native');
    return mod.TXVideoView ?? null;
  } catch {
    return null;
  }
}
