/**
 * Room provisioning service — Supabase-backed.
 *
 * Creates TRTC rooms, generates UserSigs for participants,
 * and manages session lifecycle with persistent storage.
 */

import type { Session, TRTCRoomConfig } from '@deskpilot/shared';
import { generateRoomId } from '@deskpilot/shared';
import { randomBytes } from 'node:crypto';
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
