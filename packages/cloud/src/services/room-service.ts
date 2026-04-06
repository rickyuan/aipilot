/**
 * Room provisioning service — Supabase-backed.
 *
 * Creates TRTC rooms, generates UserSigs for participants,
 * and manages session lifecycle with persistent storage.
 */

import type { Session, TRTCRoomConfig } from '@deskpilot/shared';
import { generateRoomId } from '@deskpilot/shared';
import { randomBytes, randomInt } from 'node:crypto';
import { config } from '../config.js';
import { generateUserSig } from '../trtc/usersig.js';
import { getSupabase } from '../db/supabase.js';
import type { Database } from '../db/types.js';

type SessionRow = Database['public']['Tables']['sessions']['Row'];

/**
 * Creates a new session with a TRTC room.
 * @param userId - The user who owns this session
 * @returns The created session
 */
export async function createSession(userId: string): Promise<Session> {
  const roomId = generateRoomId(userId);
  const now = Date.now();
  const sessionId = `sess_${now}_${randomBytes(4).toString('hex')}`;
  const hmacKey = randomBytes(32).toString('hex');

  const { error } = await getSupabase()
    .from('sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      room_id: roomId,
      active: true,
      hmac_key: hmacKey,
      last_activity_at: new Date(now).toISOString(),
    });

  if (error) {
    console.error('[RoomService] Failed to create session:', error);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return {
    sessionId,
    userId,
    roomId,
    active: true,
    createdAt: now,
    lastActivityAt: now,
    hmacKey,
  };
}

/**
 * Gets a session by ID.
 * @param sessionId - The session ID
 * @returns The session if found and active, null otherwise
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  const row = data as SessionRow;
  return {
    sessionId: row.id,
    userId: row.user_id,
    roomId: row.room_id,
    active: row.active,
    createdAt: new Date(row.created_at).getTime(),
    lastActivityAt: new Date(row.last_activity_at).getTime(),
    hmacKey: row.hmac_key,
  };
}

/**
 * Ends a session.
 * @param sessionId - The session ID to end
 * @returns Whether the session was found and ended
 */
export async function endSession(sessionId: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .update({ active: false })
    .eq('id', sessionId)
    .eq('active', true)
    .select('id')
    .single();

  if (error || !data) return false;
  return true;
}

/**
 * Generates TRTC room config for a participant to join.
 * @param roomId - The TRTC room ID
 * @param userId - The participant's userId
 * @returns TRTC room configuration with UserSig
 */
export function generateRoomConfig(roomId: string, userId: string): TRTCRoomConfig {
  const userSig = generateUserSig(
    config.TRTC_SDK_APP_ID,
    config.TRTC_SECRET_KEY,
    userId,
  );

  return {
    sdkAppId: config.TRTC_SDK_APP_ID,
    roomId,
    userId,
    userSig,
  };
}

/**
 * Gets an active session for a user by userId.
 * @param userId - The user ID to look up
 * @returns The active session if found, null otherwise
 */
export async function getActiveSessionByUserId(userId: string): Promise<Session | null> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const row = data as SessionRow;
  return {
    sessionId: row.id,
    userId: row.user_id,
    roomId: row.room_id,
    active: row.active,
    createdAt: new Date(row.created_at).getTime(),
    lastActivityAt: new Date(row.last_activity_at).getTime(),
    hmacKey: row.hmac_key,
  };
}

/**
 * Registers a PC device with a persistent room and fixed pairing code.
 * If already registered, returns existing config.
 * @param pcId - Unique PC device identifier
 * @param displayName - Human-readable device name
 * @returns Device config with persistent room and pairing code
 */
export async function registerDevice(
  pcId: string,
  displayName?: string,
): Promise<{ roomId: string; pairingCode: string; hmacKey: string }> {
  const db = getSupabase();

  // Check if device already registered
  const { data: existing } = await db
    .from('pc_devices')
    .select('*')
    .eq('pc_id', pcId)
    .limit(1)
    .single();

  if (existing) {
    // Update last_seen
    await db.from('pc_devices').update({ last_seen_at: new Date().toISOString() }).eq('pc_id', pcId);

    type DeviceRow = { pc_id: string; pairing_code: string; room_id: string; hmac_key: string };
    const row = existing as unknown as DeviceRow;
    return {
      roomId: row.room_id,
      pairingCode: row.pairing_code,
      hmacKey: row.hmac_key,
    };
  }

  // New device — generate persistent room + code
  const roomId = `dp_${pcId}_room`;
  const pairingCode = String(randomInt(100000, 999999));
  const hmacKey = randomBytes(32).toString('hex');

  const { error } = await db.from('pc_devices').insert({
    pc_id: pcId,
    pairing_code: pairingCode,
    room_id: roomId,
    display_name: displayName ?? pcId,
    hmac_key: hmacKey,
  });

  if (error) {
    throw new Error(`Failed to register device: ${error.message}`);
  }

  console.log(`[RoomService] Device registered: ${pcId}, code: ${pairingCode}, room: ${roomId}`);
  return { roomId, pairingCode, hmacKey };
}

/**
 * Looks up a device by its fixed pairing code.
 * @param code - The 6-digit pairing code
 * @returns Device info or null
 */
export async function findDeviceByCode(code: string): Promise<{
  pcId: string; roomId: string; hmacKey: string; displayName: string;
} | null> {
  const { data, error } = await getSupabase()
    .from('pc_devices')
    .select('*')
    .eq('pairing_code', code)
    .limit(1)
    .single();

  if (error || !data) return null;

  type DeviceRow = { pc_id: string; room_id: string; hmac_key: string; display_name: string };
  const row = data as unknown as DeviceRow;
  return {
    pcId: row.pc_id,
    roomId: row.room_id,
    hmacKey: row.hmac_key,
    displayName: row.display_name,
  };
}

/**
 * Updates session last activity timestamp.
 * @param sessionId - The session ID
 */
export async function touchSession(sessionId: string): Promise<void> {
  await getSupabase()
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId);
}

/**
 * Cleans up timed-out sessions.
 */
export async function cleanupTimedOutSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - config.DESKPILOT_MAX_SESSION_MINUTES * 60 * 1000).toISOString();

  const { data } = await getSupabase()
    .from('sessions')
    .update({ active: false })
    .eq('active', true)
    .lt('last_activity_at', cutoff)
    .select('id');

  if (data && data.length > 0) {
    console.log(`[RoomService] Timed out ${String(data.length)} sessions`);
  }
}
