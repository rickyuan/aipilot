/**
 * Device pairing service.
 *
 * TOTP-based 6-digit pairing codes.
 * PC shows code, user enters on mobile. Expires in 5 minutes.
 */

import { randomInt } from 'node:crypto';
import type { DevicePairing } from '@deskpilot/shared';

const PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/** In-memory store for active pairing codes (swap for Supabase later) */
const activePairings = new Map<string, DevicePairing>();

/**
 * Generates a 6-digit pairing code for the given PC user.
 * @param pcUserId - The userId of the PC that requested pairing
 * @returns The created DevicePairing
 */
export function generatePairingCode(pcUserId: string): DevicePairing {
  // Invalidate any existing pairing for this PC
  for (const [code, pairing] of activePairings) {
    if (pairing.pcUserId === pcUserId) {
      activePairings.delete(code);
    }
  }

  const code = String(randomInt(100000, 999999));
  const now = Date.now();

  const pairing: DevicePairing = {
    pairingCode: code,
    pcUserId,
    createdAt: now,
    expiresAt: now + PAIRING_EXPIRY_MS,
    consumed: false,
  };

  activePairings.set(code, pairing);
  return pairing;
}

/**
 * Verifies a pairing code entered by a mobile device.
 * @param code - The 6-digit pairing code
 * @returns The pairing if valid, null if invalid/expired
 */
export function verifyPairingCode(code: string): DevicePairing | null {
  const pairing = activePairings.get(code);

  if (!pairing) {
    return null;
  }

  if (pairing.consumed) {
    return null;
  }

  if (Date.now() > pairing.expiresAt) {
    activePairings.delete(code);
    return null;
  }

  // Mark as consumed
  pairing.consumed = true;
  activePairings.delete(code);

  return pairing;
}

/**
 * Cleans up expired pairing codes.
 */
export function cleanupExpiredPairings(): void {
  const now = Date.now();
  for (const [code, pairing] of activePairings) {
    if (now > pairing.expiresAt) {
      activePairings.delete(code);
    }
  }
}
