/**
 * Event names used across TRTC custom messages and internal event emitters.
 */
export const EventName = {
  // Command lifecycle
  COMMAND_RECEIVED: 'command:received',
  COMMAND_EXECUTING: 'command:executing',
  COMMAND_COMPLETED: 'command:completed',
  COMMAND_FAILED: 'command:failed',

  // Confirmation flow
  CONFIRMATION_REQUESTED: 'confirmation:requested',
  CONFIRMATION_RECEIVED: 'confirmation:received',

  // Session lifecycle
  SESSION_CREATED: 'session:created',
  SESSION_ENDED: 'session:ended',
  SESSION_TIMEOUT: 'session:timeout',

  // Device pairing
  PAIRING_CODE_GENERATED: 'pairing:code_generated',
  PAIRING_COMPLETED: 'pairing:completed',
  PAIRING_EXPIRED: 'pairing:expired',

  // TRTC room
  ROOM_PARTICIPANT_JOINED: 'room:participant_joined',
  ROOM_PARTICIPANT_LEFT: 'room:participant_left',
  ROOM_BOT_READY: 'room:bot_ready',
} as const;

export type EventNameType = (typeof EventName)[keyof typeof EventName];
