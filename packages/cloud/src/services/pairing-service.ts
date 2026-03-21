/**
 * Device pairing service — Supabase-backed.
 *
 * TOTP-based 6-digit pairing codes with persistent storage.
 * PC shows code, user enters on mobile. Expires in 5 minutes.
 */

import { randomInt } from 'node:crypto';
import type { DevicePairing } from '@deskpilot/shared';
import { getSupabase } from '../db/supabase.js';
import type { Database } from '../db/types.js';

type PairingRow = Database['public']['Tables']['pairings']['Row'];

const PAIRING_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generates a 6-digit pairing code for the given PC user.
 * @param pcUserId - The userId of the PC that requested pairing
 * @returns The created DevicePairing
 */
export async function generatePairingCode(pcUserId: string): Promise<DevicePairing> {
  // Invalidate any existing pairings for this PC
  await getSupabase()
    .from('pairings')
    .update({ consumed: true })
    .eq('pc_user_id', pcUserId)
    .eq('consumed', false);

  const code = String(randomInt(100000, 999999));
  const now = Date.now();
  const expiresAt = now + PAIRING_EXPIRY_MS;

  const { error } = await getSupabase()
    .from('pairings')
    .insert({
      pairing_code: code,
      pc_user_id: pcUserId,
      consumed: false,
      expires_at: new Date(expiresAt).toISOString(),
    });

  if (error) {
    console.error('[PairingService] Failed to create pairing:', error);
    throw new Error(`Failed to create pairing: ${error.message}`);
  }

  return {
    pairingCode: code,
    pcUserId,
    createdAt: now,
    expiresAt,
    consumed: false,
  };
}

/**
 * Verifies a pairing code entered by a mobile device.
 * @param code - The 6-digit pairing code
 * @returns The pairing if valid, null if invalid/expired
 */
export async function verifyPairingCode(code: string): Promise<DevicePairing | null> {
  const now = new Date().toISOString();

  // Find valid, unconsumed, non-expired pairing
  const { data, error } = await getSupabase()
    .from('pairings')
    .select('*')
    .eq('pairing_code', code)
    .eq('consumed', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const row = data as PairingRow;

  // Mark as consumed
  await getSupabase()
    .from('pairings')
    .update({ consumed: true })
    .eq('id', row.id);

  return {
    pairingCode: row.pairing_code,
    pcUserId: row.pc_user_id,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    consumed: true,
  };
}

/**
 * Cleans up expired pairing codes.
 */
export async function cleanupExpiredPairings(): Promise<void> {
  const now = new Date().toISOString();

  await getSupabase()
    .from('pairings')
    .delete()
    .lt('expires_at', now)
    .eq('consumed', false);
}
