/**
 * Generates a TRTC room ID in the format dp_{userId}_{timestamp}.
 * @param userId - The user ID
 * @returns A formatted room ID string
 */
export function generateRoomId(userId: string): string {
  return `dp_${userId}_${Date.now()}`;
}

/**
 * Generates a bot userId for a given room.
 * TRTC userId max length is 32 chars, so we hash the roomId.
 * @param roomId - The TRTC room ID
 * @returns Bot userId in format bot_{hash} (max 32 chars)
 */
export function generateBotUserId(roomId: string): string {
  // Simple hash to keep userId short — take last 24 chars of a numeric hash
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = ((hash << 5) - hash + roomId.charCodeAt(i)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `bot_${suffix}_${Date.now().toString(36).slice(-6)}`;
}

/**
 * Generates a unique command ID.
 * @returns A unique command ID string
 */
export function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Checks if a TRTC custom message payload is within the 32KB limit.
 * @param payload - The serialized payload string
 * @returns Whether the payload is within limits
 */
export function isWithinMessageLimit(payload: string): boolean {
  const TRTC_MESSAGE_LIMIT = 32 * 1024; // 32KB
  return new TextEncoder().encode(payload).length <= TRTC_MESSAGE_LIMIT;
}
