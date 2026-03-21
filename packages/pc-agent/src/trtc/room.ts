/**
 * TRTC room management — join, leave, screen capture, and custom messaging.
 *
 * Uses trtc-electron-sdk for screen capture and room communication.
 * Falls back to event-emitter mock when not running in Electron.
 */

import { EventEmitter } from 'node:events';
import { cpus } from 'node:os';
import type { TRTCRoomConfig, CommandPayload, CommandResult } from '@deskpilot/shared';
import { EventName, isWithinMessageLimit } from '@deskpilot/shared';

/** Room event bus for internal message routing */
export const roomEvents = new EventEmitter();

let currentRoomConfig: TRTCRoomConfig | null = null;
let trtcCloud: ReturnType<typeof tryLoadTRTC> = null;

/**
 * Attempts to load the TRTC Electron SDK.
 * Returns null if not running in Electron.
 */
function tryLoadTRTC(): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TRTCCloud = require('trtc-electron-sdk').default;
    return TRTCCloud.getTRTCShareInstance();
  } catch {
    console.log('[TRTC] Electron SDK not available, using mock mode');
    return null;
  }
}

/**
 * Calculates current CPU usage percentage.
 * @returns CPU usage as a percentage (0-100)
 */
function getCpuUsage(): number {
  const cpuList = cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpuList) {
    const times = cpu.times;
    totalIdle += times.idle;
    totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
  }

  return Math.round(((totalTick - totalIdle) / totalTick) * 100);
}

/**
 * Joins a TRTC room with the given configuration.
 * @param roomConfig - TRTC room configuration (from Cloud API)
 */
export async function joinRoom(roomConfig: TRTCRoomConfig): Promise<void> {
  currentRoomConfig = roomConfig;
  trtcCloud = tryLoadTRTC();

  if (trtcCloud) {
    const cloud = trtcCloud as {
      enterRoom: (params: Record<string, unknown>, scene: number) => void;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    cloud.on('onEnterRoom', (elapsed: unknown) => {
      console.log(`[TRTC] Entered room in ${String(elapsed)}ms`);
    });

    cloud.on('onError', (errCode: unknown, errMsg: unknown) => {
      console.error(`[TRTC] Error ${String(errCode)}: ${String(errMsg)}`);
    });

    cloud.on('onRemoteUserEnterRoom', (userId: unknown) => {
      console.log(`[TRTC] Remote user joined: ${String(userId)}`);
      roomEvents.emit(EventName.ROOM_PARTICIPANT_JOINED, {
        userId: String(userId),
        role: String(userId).startsWith('bot_') ? 'ai-bot' : 'mobile',
      });
    });

    cloud.on('onRemoteUserLeaveRoom', (userId: unknown) => {
      console.log(`[TRTC] Remote user left: ${String(userId)}`);
      roomEvents.emit(EventName.ROOM_PARTICIPANT_LEFT, { userId: String(userId) });
    });

    cloud.on('onRecvCustomCmdMsg', (_userId: unknown, _cmdId: unknown, _seq: unknown, msg: unknown) => {
      try {
        const command = JSON.parse(String(msg)) as CommandPayload;
        roomEvents.emit(EventName.COMMAND_RECEIVED, command);
      } catch (err: unknown) {
        console.error('[TRTC] Failed to parse custom message:', err);
      }
    });

    // Use strRoomId for string-based room IDs (not numeric roomId)
    cloud.enterRoom(
      {
        sdkAppId: roomConfig.sdkAppId,
        strRoomId: roomConfig.roomId,
        userId: roomConfig.userId,
        userSig: roomConfig.userSig,
      },
      0, // TRTCAppScene.TRTCAppSceneVideoCall
    );
  } else {
    // Mock mode for non-Electron environments
    console.log(`[TRTC] Joined room ${roomConfig.roomId} as ${roomConfig.userId} (mock)`);
  }

  roomEvents.emit(EventName.ROOM_PARTICIPANT_JOINED, {
    userId: roomConfig.userId,
    role: 'pc-agent',
  });
}

/**
 * Starts screen capture and publishes to the TRTC room.
 * Uses 1080p by default, falls back to 720p if CPU > 70%.
 */
export async function startScreenCapture(): Promise<void> {
  if (!currentRoomConfig) {
    throw new Error('Must join a room before starting screen capture');
  }

  if (trtcCloud) {
    const cloud = trtcCloud as {
      getScreenCaptureSources: (
        thumbWidth: number,
        thumbHeight: number,
        iconWidth: number,
        iconHeight: number,
      ) => Array<{ type: number; sourceId: string; sourceName: string }>;
      selectScreenCaptureTarget: (
        source: { type: number; sourceId: string; sourceName: string },
        captureRect: Record<string, number>,
        captureParams: Record<string, unknown>,
      ) => void;
      startScreenCapture: (view: null, streamType: number, params: Record<string, unknown>) => void;
    };

    // Get available screens
    const sources = cloud.getScreenCaptureSources(160, 90, 32, 32);
    const primaryScreen = sources.find((s) => s.type === 1) ?? sources[0];

    if (primaryScreen) {
      cloud.selectScreenCaptureTarget(
        primaryScreen,
        { left: 0, top: 0, right: 0, bottom: 0 },
        { captureMouseCursor: true, enableHighLight: false },
      );

      // CPU-adaptive resolution: 1080p default, 720p if CPU > 70%
      const cpuUsage = getCpuUsage();
      const use720p = cpuUsage > 70;

      cloud.startScreenCapture(null, 1, { // TRTCVideoStreamTypeSub
        videoResolution: use720p ? 66 : 104, // 1280x720 or 1920x1080
        videoFps: 15,
        videoBitrate: use720p ? 1200 : 2000,
      });

      console.log(`[TRTC] Screen capture started (${use720p ? '720p - high CPU' : '1080p'})`);
    }
  } else {
    console.log('[TRTC] Screen capture started (mock)');
  }
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
 * Sends a result payload via TRTC custom message.
 * @param result - The command result to send
 */
function sendResultPayload(result: CommandResult): void {
  if (trtcCloud) {
    const cloud = trtcCloud as {
      sendCustomCmdMsg: (cmdId: number, data: string, reliable: boolean, ordered: boolean) => void;
    };
    cloud.sendCustomCmdMsg(1, JSON.stringify(result), true, true);
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
  if (trtcCloud) {
    const cloud = trtcCloud as {
      stopScreenCapture: () => void;
      exitRoom: () => void;
    };
    cloud.stopScreenCapture();
    cloud.exitRoom();
  }

  if (currentRoomConfig) {
    console.log(`[TRTC] Left room ${currentRoomConfig.roomId}`);
    roomEvents.emit(EventName.ROOM_PARTICIPANT_LEFT, {
      userId: currentRoomConfig.userId,
    });
    currentRoomConfig = null;
  }
}
