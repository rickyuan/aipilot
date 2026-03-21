/**
 * TRTC Conversational AI bot lifecycle management.
 *
 * Creates and destroys bots via TRTC REST API (StartAIConversation).
 * The bot is NOT an SDK feature — it's managed via HTTP calls.
 *
 * The bot is configured with our Cloud's LLM callback URL so that
 * ASR text is routed through our intent classification pipeline.
 */

import { generateBotUserId } from '@deskpilot/shared';
import type { AIBotConfig } from '@deskpilot/shared';
import { config } from '../config.js';
import { generateUserSig } from '../trtc/usersig.js';
import { createAIConversation, destroyAIConversation } from '../trtc/api.js';

/** Active bot task IDs keyed by roomId */
const activeBots = new Map<string, string>();

/**
 * Creates an AI bot and joins it to a TRTC room.
 * @param roomId - The TRTC room ID
 * @returns The bot config and task ID
 */
export async function createBot(roomId: string): Promise<{ botConfig: AIBotConfig; taskId: string }> {
  const botUserId = generateBotUserId(roomId);
  const botUserSig = generateUserSig(
    config.TRTC_SDK_APP_ID,
    config.TRTC_SECRET_KEY,
    botUserId,
  );

  const botConfig: AIBotConfig = {
    roomId,
    botUserId,
    botUserSig,
    asrLanguage: 'zh',
    ttsVoice: 'default',
  };

  // Build LLM callback URL for the bot to send ASR text to
  const publicUrl = config.DESKPILOT_PUBLIC_URL ?? `http://localhost:${String(config.PORT)}`;
  const llmCallbackUrl = `${publicUrl}/api/bot/llm-callback`;

  const taskId = await createAIConversation(botConfig, llmCallbackUrl);
  activeBots.set(roomId, taskId);

  console.log(`[Cloud] Bot created for room ${roomId}, taskId: ${taskId}`);
  return { botConfig, taskId };
}

/**
 * Destroys the AI bot in a TRTC room.
 * @param roomId - The TRTC room ID
 * @returns Whether a bot was found and destroyed
 */
export async function destroyBot(roomId: string): Promise<boolean> {
  const taskId = activeBots.get(roomId);
  if (!taskId) return false;

  await destroyAIConversation(taskId);
  activeBots.delete(roomId);

  console.log(`[Cloud] Bot destroyed for room ${roomId}`);
  return true;
}

/**
 * Checks if a room has an active bot.
 * @param roomId - The TRTC room ID
 * @returns Whether a bot is active
 */
export function hasBotInRoom(roomId: string): boolean {
  return activeBots.has(roomId);
}
