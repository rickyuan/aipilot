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
import { isClaudeCodeAvailable, executeWithClaudeCode } from './executors/claude-code.js';
import { isClaudeDesktopRunning, sendToClaudeDesktop } from './executors/claude-desktop.js';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentRoomId = '';
let currentUserId = '';
let currentSessionId = '';
let sessionHmacKey = '';
let onScreenShareRequest: (() => void) | null = null;
let onScreenShareStop: (() => void) | null = null;

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

/**
 * Connects to the Cloud WebSocket relay.
 * @param roomId - The TRTC room ID
 * @param userId - This PC Agent's user ID
 * @param hmacKey - Per-session HMAC key for command signing
 * @param sessionId - Session ID for conversation history tracking
 * @param onShareRequest - Callback when mobile requests screen share
 * @param onShareStop - Callback when mobile stops screen share
 */
export function connectToCloudWs(
  roomId: string,
  userId: string,
  hmacKey: string,
  sessionId?: string,
  onShareRequest?: () => void,
  onShareStop?: () => void,
): void {
  currentRoomId = roomId;
  currentUserId = userId;
  currentSessionId = sessionId ?? '';
  sessionHmacKey = hmacKey;
  onScreenShareRequest = onShareRequest ?? null;
  onScreenShareStop = onShareStop ?? null;

  const cloudUrl = config.DESKPILOT_CLOUD_URL.replace(/^http/, 'ws');
  let wsUrl = `${cloudUrl}/ws/agent?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}`;
  if (currentSessionId) {
    wsUrl += `&sessionId=${encodeURIComponent(currentSessionId)}`;
  }

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

  // Pre-classified command from Cloud LLM
  if (msg.type === 'classified_command') {
    const cmd = msg.command;
    console.log(`[WS] Received command: ${cmd.intentType} → ${cmd.executor}`);

    // Priority routing:
    // 1. Simple system commands → direct executors (instant, can do GUI)
    // 2. Code tasks + Claude Desktop running → send to Claude Desktop (preserves context)
    // 3. Code tasks + Claude Code CLI → spawn claude --print
    // 4. Fallback → intent-based routing

    // Direct executors for simple/GUI tasks
    if (cmd.executor === 'browser' || cmd.executor === 'shell' || cmd.executor === 'vscode' || cmd.executor === 'workspace') {
      console.log(`[WS] Direct executor: ${cmd.executor}`);
      try {
        const result = await routeCommand(cmd);
        sendResult(result);
      } catch (err: unknown) {
        console.error(`[WS] ${cmd.executor} error:`, err);
      }
      return;
    }

    // Code tasks → prefer Claude Desktop (preserves user's existing context)
    if (isClaudeDesktopRunning()) {
      console.log(`[WS] Sending to Claude Desktop: "${cmd.instruction.slice(0, 80)}"`);
      try {
        const result = await sendToClaudeDesktop(cmd.instruction);
        sendResult({ ...result, commandId: cmd.commandId });
      } catch (err: unknown) {
        console.error('[WS] Claude Desktop error:', err);
      }
      return;
    }

    // Fallback: Claude Code CLI
    if (isClaudeCodeAvailable()) {
      console.log(`[WS] Routing to Claude Code CLI: "${cmd.instruction.slice(0, 80)}"`);
      try {
        const result = await executeWithClaudeCode(cmd.instruction, cmd.workspacePath);
        sendResult({ ...result, commandId: cmd.commandId });
      } catch (err: unknown) {
        console.error('[WS] Claude Code error:', err);
      }
      return;
    }

    // No Claude Code — use intent-based routing
    try {
      const result = await routeCommand(cmd);
      sendResult(result);
    } catch (err: unknown) {
      console.error('[WS] Command error:', err);
    }
    return;
  }

  // Raw utterance from TRTC bot
  if (msg.type === 'utterance') {
    console.log(`[WS] Received utterance: "${msg.text}"`);

    // Priority: Claude Desktop > Claude Code CLI > intent pipeline
    if (isClaudeDesktopRunning()) {
      console.log('[WS] Sending utterance to Claude Desktop');
      const result = await sendToClaudeDesktop(msg.text);
      if (result) {
        sendResult(result);
      }
      return;
    }

    if (isClaudeCodeAvailable()) {
      console.log('[WS] Claude Code available — sending directly');
      const result = await executeWithClaudeCode(msg.text);
      if (result) {
        sendResult(result);
      }
      return;
    }

    // Fallback: use intent classification pipeline
    const result = await processUtterance(msg.text, sessionHmacKey);
    if (result) {
      sendResult(result);
    }
    return;
  }

  if (msg.type === 'bot_feedback') {
    console.log(`[WS] Bot feedback: "${msg.text}"`);
    return;
  }

  // Screen share control from mobile
  if (msg.type === 'screen_share_request') {
    console.log(`[WS] Screen share requested by ${msg.mobileUserId}`);
    if (onScreenShareRequest) {
      onScreenShareRequest();
    }
    return;
  }

  if (msg.type === 'screen_share_stop') {
    console.log(`[WS] Screen share stop by ${msg.mobileUserId}`);
    if (onScreenShareStop) {
      onScreenShareStop();
    }
    return;
  }

  if (msg.type === 'mobile_connected') {
    console.log(`[WS] Mobile connected: ${msg.mobileUserId}`);
    return;
  }

  if (msg.type === 'mobile_disconnected') {
    console.log(`[WS] Mobile disconnected: ${msg.mobileUserId}`);
    return;
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
    connectToCloudWs(currentRoomId, currentUserId, sessionHmacKey, currentSessionId, onScreenShareRequest ?? undefined, onScreenShareStop ?? undefined);
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
