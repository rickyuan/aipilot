/**
 * Bot LLM callback route.
 *
 * The TRTC Conversational AI Bot sends ASR text here.
 * We relay it to the PC Agent via WebSocket, wait for execution,
 * then return a TTS-friendly text response to the bot.
 *
 * POST /api/bot/llm-callback
 */

import { Router } from 'express';
import { relayUtteranceToAgent } from '../ws/relay.js';

export const botCallbackRouter = Router();

interface LLMCallbackBody {
  /** The room ID the bot is in */
  RoomId?: string;
  /** ASR transcript */
  Text?: string;
  /** Session or request ID from TRTC */
  RequestId?: string;
}

/**
 * POST /api/bot/llm-callback
 * Receives ASR text from the TRTC Conversational AI Bot,
 * relays to the PC Agent, and returns a TTS response.
 */
botCallbackRouter.post('/llm-callback', async (req, res) => {
  const body = req.body as LLMCallbackBody;
  const roomId = body.RoomId ?? '';
  const text = body.Text ?? '';

  if (!roomId || !text) {
    res.json({ Text: 'I did not hear that clearly. Could you repeat?' });
    return;
  }

  console.log(`[Bot Callback] Room ${roomId}: "${text}"`);

  try {
    const responseText = await relayUtteranceToAgent(roomId, text);
    console.log(`[Bot Callback] Response for room ${roomId}: "${responseText.slice(0, 100)}..."`);
    res.json({ Text: responseText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Bot Callback] Error for room ${roomId}:`, message);
    res.json({ Text: 'Sorry, something went wrong. Please try again.' });
  }
});
