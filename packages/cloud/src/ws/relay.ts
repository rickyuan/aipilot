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
import type { WsMessage, CommandResult } from '@deskpilot/shared';

/** Connected PC Agents keyed by roomId */
const agentConnections = new Map<string, WebSocket>();

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

    if (!roomId) {
      ws.close(4000, 'Missing roomId query parameter');
      return;
    }

    console.log(`[WS] Agent connected: ${userId} in room ${roomId}`);
    agentConnections.set(roomId, ws);

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
    const pending = pendingCallbacks.get(roomId);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingCallbacks.delete(roomId);
      // Return a TTS-friendly summary of the result
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
  const ws = agentConnections.get(roomId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve('PC Agent is not connected. Please make sure the DeskPilot agent is running on your computer.');
  }

  // Send utterance to agent
  const msg: WsMessage = { type: 'utterance', text, roomId };
  ws.send(JSON.stringify(msg));

  return new Promise<string>((resolve) => {
    const timeout = setTimeout(() => {
      pendingCallbacks.delete(roomId);
      resolve('The command is taking a while to execute. Please wait.');
    }, timeoutMs);

    pendingCallbacks.set(roomId, { resolve, timeout });
  });
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
