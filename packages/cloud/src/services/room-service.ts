/**
 * Room provisioning service.
 *
 * Creates TRTC rooms, generates UserSigs for participants,
 * and manages room lifecycle.
 */

import type { Session, TRTCRoomConfig } from '@deskpilot/shared';
import { generateRoomId } from '@deskpilot/shared';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { generateUserSig } from '../trtc/usersig.js';

/** In-memory store for active sessions (swap for Supabase later) */
const activeSessions = new Map<string, Session>();

/**
 * Creates a new session with a TRTC room.
 * @param userId - The user who owns this session
 * @returns The created session
 */
export function createSession(userId: string): Session {
  const roomId = generateRoomId(userId);
  const now = Date.now();

  const session: Session = {
    sessionId: `sess_${now}_${randomBytes(4).toString('hex')}`,
    userId,
    roomId,
    active: true,
    createdAt: now,
    lastActivityAt: now,
    hmacKey: randomBytes(32).toString('hex'),
  };

  activeSessions.set(session.sessionId, session);
  return session;
}

/**
 * Gets a session by ID.
 * @param sessionId - The session ID
 * @returns The session if found and active, null otherwise
 */
export function getSession(sessionId: string): Session | null {
  return activeSessions.get(sessionId) ?? null;
}

/**
 * Ends a session.
 * @param sessionId - The session ID to end
 * @returns Whether the session was found and ended
 */
export function endSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) return false;

  session.active = false;
  activeSessions.delete(sessionId);
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
export function touchSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.lastActivityAt = Date.now();
  }
}

/**
 * Cleans up timed-out sessions.
 */
export function cleanupTimedOutSessions(): void {
  const now = Date.now();
  const timeoutMs = config.DESKPILOT_MAX_SESSION_MINUTES * 60 * 1000;

  for (const [id, session] of activeSessions) {
    if (now - session.lastActivityAt > timeoutMs) {
      session.active = false;
      activeSessions.delete(id);
      console.log(`[Cloud] Session ${id} timed out`);
    }
  }
}
