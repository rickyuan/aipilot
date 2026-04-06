/**
 * WebSocket relay server for Cloud ↔ PC Agent communication.
 *
 * PC Agent connects via WebSocket to receive utterances from the
 * TRTC bot's LLM callback. Results flow back to provide TTS feedback.
 *
 * Protocol:
 *   Cloud → Agent: { type: 'utterance', text, roomId }
 *   Agent → Cloud: { type: 'command_result', result, roomId }
 *   Cloud → Agent: { type: 'ping' }
 *   Agent → Cloud: { type: 'pong' }
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { WsMessage, CommandResult, CommandPayload } from '@deskpilot/shared';
import { updateRoundOutput } from '../services/conversation-service.js';
import { botSpeak } from '../services/bot-service.js';

/** Connected PC Agents keyed by roomId */
const agentConnections = new Map<string, WebSocket>();

/** Map pcUserId → roomId for lookup by user */
const userToRoom = new Map<string, string>();

/** Map roomId → sessionId for conversation history lookup */
const roomToSession = new Map<string, string>();

/** Pending LLM callback responses keyed by roomId */
const pendingCallbacks = new Map<string, {
  resolve: (text: string) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

/**
 * Initializes the WebSocket relay server alongside the HTTP server.
 * @param server - The HTTP server to attach to
 */
export function initWebSocketRelay(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/agent' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const roomId = url.searchParams.get('roomId') ?? '';
    const userId = url.searchParams.get('userId') ?? '';
    const sessionId = url.searchParams.get('sessionId') ?? '';

    if (!roomId) {
      ws.close(4000, 'Missing roomId query parameter');
      return;
    }

    console.log(`[WS] Agent connected: ${userId} in room ${roomId} (session: ${sessionId})`);
    agentConnections.set(roomId, ws);
    userToRoom.set(userId, roomId);
    if (sessionId) {
      roomToSession.set(roomId, sessionId);
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as WsMessage;
        handleAgentMessage(roomId, msg);
      } catch {
        console.error('[WS] Invalid message from agent');
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Agent disconnected: ${userId} from room ${roomId}`);
      agentConnections.delete(roomId);
      userToRoom.delete(userId);
      roomToSession.delete(roomId);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Agent error in room ${roomId}:`, err.message);
    });

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const msg: WsMessage = { type: 'ping' };
        ws.send(JSON.stringify(msg));
      }
    }, 30000);

    ws.on('close', () => clearInterval(heartbeat));
  });

  console.log('[WS] WebSocket relay initialized on /ws/agent');
}

/**
 * Handles messages from a connected PC Agent.
 * @param roomId - The room the agent is in
 * @param msg - The parsed WebSocket message
 */
function handleAgentMessage(roomId: string, msg: WsMessage): void {
  if (msg.type === 'pong') return;

  if (msg.type === 'command_result') {
    // Save executor output to conversation history for multi-turn context
    const sessionId = roomToSession.get(roomId);
    if (sessionId && msg.result.commandId) {
      const output = msg.result.success
        ? msg.result.output.slice(0, 1000)
        : `Error: ${msg.result.error ?? 'unknown error'}`;
      updateRoundOutput(sessionId, msg.result.commandId, output).catch((err: unknown) => {
        console.error('[WS] Failed to update round output:', err);
      });
    }

    // Push execution result to Bot TTS — let the bot speak the result
    const resultSummary = msg.result.success
      ? msg.result.output.slice(0, 200)
      : `执行失败: ${msg.result.error ?? '未知错误'}`;

    if (resultSummary.trim()) {
      botSpeak(roomId, resultSummary, false).catch((err: unknown) => {
        console.error('[WS] Failed to push result to bot TTS:', err);
      });
    }

    const pending = pendingCallbacks.get(roomId);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingCallbacks.delete(roomId);
      const text = msg.result.success
        ? msg.result.output.slice(0, 500)
        : `Command failed: ${msg.result.error ?? 'unknown error'}`;
      pending.resolve(text);
    }
  }
}

/**
 * Sends an utterance to the PC Agent for a given room and waits for the result.
 * Used by the bot LLM callback to relay ASR text to the PC Agent.
 * @param roomId - The room ID
 * @param text - The utterance text from ASR
 * @param timeoutMs - Timeout in milliseconds (default: 30s)
 * @returns The text response for TTS
 */
export function relayUtteranceToAgent(
  roomId: string,
  text: string,
  timeoutMs = 30000,
): Promise<string> {
  let ws = agentConnections.get(roomId);
  let actualRoomId = roomId;

  // If not found by exact roomId, try to find agent by pcUserId from paired room
  // Paired rooms have format: dp_{pcUserId}_paired
  if ((!ws || ws.readyState !== WebSocket.OPEN) && roomId.endsWith('_paired')) {
    const pcUserId = roomId.replace(/^dp_/, '').replace(/_paired$/, '');
    const agentRoomId = userToRoom.get(pcUserId);
    if (agentRoomId) {
      ws = agentConnections.get(agentRoomId);
      actualRoomId = agentRoomId;
    }
  }

  // Fallback: if only one agent is connected, use it
  if ((!ws || ws.readyState !== WebSocket.OPEN) && agentConnections.size === 1) {
    const entry = [...agentConnections.entries()][0] as [string, WebSocket];
    ws = entry[1];
    actualRoomId = entry[0];
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve('PC Agent is not connected. Please make sure the DeskPilot agent is running on your computer.');
  }

  // Send utterance to agent
  const msg: WsMessage = { type: 'utterance', text, roomId: actualRoomId };
  ws.send(JSON.stringify(msg));

  return new Promise<string>((resolve) => {
    const timeout = setTimeout(() => {
      pendingCallbacks.delete(actualRoomId);
      resolve('The command is taking a while to execute. Please wait.');
    }, timeoutMs);

    pendingCallbacks.set(actualRoomId, { resolve, timeout });
  });
}

/**
 * Sends a pre-classified command to the PC Agent for direct execution.
 * @param roomId - The room ID
 * @param command - The classified command payload
 */
export function sendClassifiedCommand(roomId: string, command: CommandPayload): void {
  let ws = agentConnections.get(roomId);

  // Fallback: try paired room format
  if ((!ws || ws.readyState !== WebSocket.OPEN) && roomId.endsWith('_paired')) {
    const pcUserId = roomId.replace(/^dp_/, '').replace(/_paired$/, '');
    const agentRoomId = userToRoom.get(pcUserId);
    if (agentRoomId) {
      ws = agentConnections.get(agentRoomId);
    }
  }

  // Fallback: if only one agent is connected, use it
  if ((!ws || ws.readyState !== WebSocket.OPEN) && agentConnections.size === 1) {
    const entry = [...agentConnections.entries()][0] as [string, WebSocket];
    ws = entry[1];
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    const msg: WsMessage = { type: 'classified_command', command, roomId };
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Sends a bot feedback message to the PC Agent.
 * @param roomId - The room ID
 * @param text - The feedback text
 */
export function sendBotFeedback(roomId: string, text: string): void {
  const ws = agentConnections.get(roomId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    const msg: WsMessage = { type: 'bot_feedback', text, roomId };
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Checks if a PC Agent is connected for a room.
 * @param roomId - The room ID
 * @returns Whether an agent is connected
 */
export function isAgentConnected(roomId: string): boolean {
  const ws = agentConnections.get(roomId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
}

/**
 * Sends a screen share request to the PC Agent for a room.
 * @param roomId - The room ID
 * @param mobileUserId - The mobile user requesting screen share
 */
export function sendScreenShareRequest(roomId: string, mobileUserId: string): void {
  const ws = findAgentWs(roomId);
  if (ws) {
    const msg: WsMessage = { type: 'screen_share_request', roomId, mobileUserId };
    ws.send(JSON.stringify(msg));
    console.log(`[WS] Screen share request sent to agent in room ${roomId}`);
  } else {
    console.warn(`[WS] No agent connected for room ${roomId} — screen share request dropped`);
  }
}

/**
 * Sends a screen share stop command to the PC Agent.
 * @param roomId - The room ID
 * @param mobileUserId - The mobile user requesting stop
 */
export function sendScreenShareStop(roomId: string, mobileUserId: string): void {
  const ws = findAgentWs(roomId);
  if (ws) {
    const msg: WsMessage = { type: 'screen_share_stop', roomId, mobileUserId };
    ws.send(JSON.stringify(msg));
    console.log(`[WS] Screen share stop sent to agent in room ${roomId}`);
  } else {
    console.warn(`[WS] No agent connected for room ${roomId} — screen share stop dropped`);
  }
}

/**
 * Finds a connected agent WebSocket for a room (with fallback logic).
 * @param roomId - The room ID
 * @returns The WebSocket or null
 */
function findAgentWs(roomId: string): WebSocket | null {
  let ws = agentConnections.get(roomId);
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

  // Fallback: try paired room format
  if (roomId.endsWith('_paired')) {
    const pcUserId = roomId.replace(/^dp_/, '').replace(/_paired$/, '');
    const agentRoomId = userToRoom.get(pcUserId);
    if (agentRoomId) {
      ws = agentConnections.get(agentRoomId);
      if (ws && ws.readyState === WebSocket.OPEN) return ws;
    }
  }

  // Fallback: single agent
  if (agentConnections.size === 1) {
    const entry = [...agentConnections.entries()][0] as [string, WebSocket];
    if (entry[1].readyState === WebSocket.OPEN) return entry[1];
  }

  return null;
}

/**
 * Gets the session ID associated with a room.
 * Falls back to checking paired rooms and single-agent scenarios.
 * @param roomId - The room ID
 * @returns The session ID, or empty string if not found
 */
export function getSessionIdForRoom(roomId: string): string {
  const sessionId = roomToSession.get(roomId);
  if (sessionId) return sessionId;

  // Fallback: try paired room format
  if (roomId.endsWith('_paired')) {
    const pcUserId = roomId.replace(/^dp_/, '').replace(/_paired$/, '');
    const agentRoomId = userToRoom.get(pcUserId);
    if (agentRoomId) return roomToSession.get(agentRoomId) ?? '';
  }

  // Fallback: if only one agent, use its session
  if (roomToSession.size === 1) {
    return [...roomToSession.values()][0] ?? '';
  }

  return '';
}
