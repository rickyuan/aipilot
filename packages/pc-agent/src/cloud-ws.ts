/**
 * WebSocket client for Cloud ↔ PC Agent communication.
 *
 * Connects to the Cloud Orchestrator's WebSocket relay to receive
 * utterances from the TRTC bot's LLM callback. Sends execution
 * results back for TTS feedback.
 *
 * Includes automatic reconnection with exponential backoff.
 */

import WebSocket from 'ws';
import type { WsMessage, CommandResult } from '@deskpilot/shared';
import { config } from './config.js';
import { processUtterance } from './intent/pipeline.js';
import { routeCommand } from './executors/router.js';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentRoomId = '';
let currentUserId = '';
let sessionHmacKey = '';

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

/**
 * Connects to the Cloud WebSocket relay.
 * @param roomId - The TRTC room ID
 * @param userId - This PC Agent's user ID
 * @param hmacKey - Per-session HMAC key for command signing
 */
export function connectToCloudWs(roomId: string, userId: string, hmacKey: string): void {
  currentRoomId = roomId;
  currentUserId = userId;
  sessionHmacKey = hmacKey;

  const cloudUrl = config.DESKPILOT_CLOUD_URL.replace(/^http/, 'ws');
  const wsUrl = `${cloudUrl}/ws/agent?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`;

  console.log(`[WS] Connecting to ${wsUrl}`);

  ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('[WS] Connected to Cloud relay');
    reconnectAttempts = 0;
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as WsMessage;
      handleMessage(msg);
    } catch {
      console.error('[WS] Failed to parse message');
    }
  });

  ws.on('close', () => {
    console.log('[WS] Disconnected from Cloud relay');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[WS] Connection error:', err.message);
  });
}

/**
 * Handles incoming messages from the Cloud relay.
 * @param msg - The parsed WebSocket message
 */
async function handleMessage(msg: WsMessage): Promise<void> {
  if (msg.type === 'ping') {
    sendMessage({ type: 'pong' });
    return;
  }

  // Pre-classified command from Cloud LLM — skip classification, execute directly
  if (msg.type === 'classified_command') {
    console.log(`[WS] Received classified command: ${msg.command.intentType} → ${msg.command.executor}`);
    console.log(`[WS] Instruction: "${msg.command.instruction.slice(0, 100)}"`);

    try {
      const result = await routeCommand(msg.command);
      sendResult(result);

      const status = result.success ? 'OK' : `FAILED: ${result.error ?? 'unknown'}`;
      console.log(`[WS] Command ${msg.command.commandId} ${status}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[WS] Command execution error: ${errMsg}`);
    }
    return;
  }

  // Legacy: raw utterance — classify locally (fallback if Cloud LLM is unavailable)
  if (msg.type === 'utterance') {
    console.log(`[WS] Received utterance: "${msg.text}"`);

    const result = await processUtterance(msg.text, sessionHmacKey);
    if (result) {
      sendResult(result);
    }
    return;
  }

  if (msg.type === 'bot_feedback') {
    console.log(`[WS] Bot feedback: "${msg.text}"`);
  }
}

/**
 * Sends a command result back to the Cloud relay.
 * @param result - The command execution result
 */
function sendResult(result: CommandResult): void {
  const msg: WsMessage = {
    type: 'command_result',
    result,
    roomId: currentRoomId,
  };
  sendMessage(msg);
}

/**
 * Sends a raw message to the Cloud WebSocket.
 * @param msg - The message to send
 */
function sendMessage(msg: WsMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Schedules a reconnection with exponential backoff.
 */
function scheduleReconnect(): void {
  if (reconnectTimer) return;

  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY,
  );

  console.log(`[WS] Reconnecting in ${String(delay)}ms (attempt ${String(reconnectAttempts + 1)})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempts++;
    connectToCloudWs(currentRoomId, currentUserId, sessionHmacKey);
  }, delay);
}

/**
 * Disconnects from the Cloud WebSocket relay.
 */
export function disconnectCloudWs(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

/**
 * Returns whether the WebSocket is currently connected.
 * @returns Connection status
 */
export function isCloudWsConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
