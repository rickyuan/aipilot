/**
 * API client for the Cloud Orchestrator.
 *
 * In development, uses localhost. Configure CLOUD_URL for production.
 */

import type { Session, TRTCRoomConfig } from '@deskpilot/shared';

// In React Native, localhost refers to the device itself.
// For iOS simulator, use localhost. For physical device, use the host machine's IP.
import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'ios' && !Platform.isTV
  ? '192.168.1.58'  // Mac's LAN IP for real device; change if your IP differs
  : 'localhost';

const API_BASE = __DEV__
  ? `http://${DEV_HOST}:3000`
  : 'https://your-cloud-server.com'; // TODO: configure for production

interface SessionResponse {
  session: Session;
  roomConfig: TRTCRoomConfig;
}

interface PairingVerifyResponse {
  message: string;
  roomId: string;
  pcUserId: string;
  mobileRoomConfig: TRTCRoomConfig;
  pcRoomConfig: TRTCRoomConfig;
}

/**
 * Creates a new session via the Cloud API.
 * @param userId - The mobile user's ID
 * @returns Session and TRTC room config
 */
export async function createSession(userId: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
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
 * Verifies a 6-digit pairing code.
 * @param pairingCode - The code displayed on the PC
 * @param mobileUserId - This device's user ID
 * @returns Room configs for both devices
 */
export async function verifyPairingCode(
  pairingCode: string,
  mobileUserId: string,
): Promise<PairingVerifyResponse> {
  const res = await fetch(`${API_BASE}/api/pairing/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode, mobileUserId }),
  });

  if (!res.ok) {
    const error = await res.json() as { error: string };
    throw new Error(error.error || `Pairing failed: ${String(res.status)}`);
  }

  return res.json() as Promise<PairingVerifyResponse>;
}

/**
 * Requests a TRTC room config for joining.
 * @param roomId - The TRTC room ID
 * @param userId - This device's user ID
 * @returns TRTC room config with UserSig
 */
export async function getRoomConfig(
  roomId: string,
  userId: string,
): Promise<TRTCRoomConfig> {
  const res = await fetch(
    `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/config?userId=${encodeURIComponent(userId)}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to get room config: ${String(res.status)}`);
  }

  const data = await res.json() as { roomConfig: TRTCRoomConfig };
  return data.roomConfig;
}
