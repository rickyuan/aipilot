/**
 * Cloud Orchestrator API client for PC Agent.
 *
 * Handles session creation, pairing code generation,
 * and room config retrieval from the Cloud service.
 */

import type { Session, TRTCRoomConfig } from '@deskpilot/shared';
import { config } from './config.js';

interface SessionResponse {
  session: Session;
  roomConfig: TRTCRoomConfig;
}

interface PairingResponse {
  pairingCode: string;
  expiresAt: number;
}

/**
 * Creates a new session via the Cloud API.
 * @param userId - This PC Agent's user ID
 * @returns Session and TRTC room config
 */
export async function createSession(userId: string): Promise<SessionResponse> {
  const res = await fetch(`${config.DESKPILOT_CLOUD_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create session: ${String(res.status)}`);
  }

  return res.json() as Promise<SessionResponse>;
}

/**
 * Generates a 6-digit pairing code for this PC.
 * @param pcUserId - This PC Agent's user ID
 * @returns The pairing code and expiry time
 */
export async function generatePairingCode(pcUserId: string): Promise<PairingResponse> {
  const res = await fetch(`${config.DESKPILOT_CLOUD_URL}/api/pairing/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pcUserId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to generate pairing code: ${String(res.status)}`);
  }

  return res.json() as Promise<PairingResponse>;
}

/**
 * Gets a TRTC room config for joining.
 * @param roomId - The TRTC room ID
 * @param userId - This PC Agent's user ID
 * @returns TRTC room config with UserSig
 */
export async function getRoomConfig(roomId: string, userId: string): Promise<TRTCRoomConfig> {
  const res = await fetch(
    `${config.DESKPILOT_CLOUD_URL}/api/rooms/${encodeURIComponent(roomId)}/config?userId=${encodeURIComponent(userId)}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to get room config: ${String(res.status)}`);
  }

  const data = await res.json() as { roomConfig: TRTCRoomConfig };
  return data.roomConfig;
}
