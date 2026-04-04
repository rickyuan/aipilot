import type { ExecutorType, IntentType } from './intent';

/**
 * Command payload sent from the AI bot to the PC Agent via TRTC custom message.
 *
 * Note: TRTC custom messages have a 32KB limit.
 * For large payloads, chunk them or use a side channel.
 */
export interface CommandPayload {
  /** Unique command ID for tracking */
  commandId: string;
  /** The intent that triggered this command */
  intentType: IntentType;
  /** Which executor should handle this command */
  executor: ExecutorType;
  /** The actual instruction/command to execute */
  instruction: string;
  /** Additional parameters for the executor */
  parameters: Record<string, unknown>;
  /** Timestamp when the command was created */
  timestamp: number;
  /** HMAC signature for per-session verification */
  signature: string;
}

/** Result sent back from PC Agent to the bot after command execution */
export interface CommandResult {
  /** Matches the commandId from the original CommandPayload */
  commandId: string;
  /** Whether the command executed successfully */
  success: boolean;
  /** Human-readable result or output */
  output: string;
  /** Error message if success is false */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Timestamp when the result was created */
  timestamp: number;
}

/**
 * WebSocket relay message types for Cloud ↔ PC Agent communication.
 */
export type WsMessage =
  | { type: 'utterance'; text: string; roomId: string }
  | { type: 'classified_command'; command: CommandPayload; roomId: string }
  | { type: 'command_result'; result: CommandResult; roomId: string }
  | { type: 'bot_feedback'; text: string; roomId: string }
  | { type: 'ping' }
  | { type: 'pong' };
