/**
 * Bot LLM callback route — OpenAI-compatible.
 *
 * TRTC Conversational AI Bot sends ASR text in OpenAI chat completion format.
 * We classify intent via Groq LLM, send the command to PC Agent,
 * and return a TTS-friendly response.
 *
 * POST /api/bot/v1/chat/completions
 */

import { Router } from 'express';
import { generateCommandId } from '@deskpilot/shared';
import { classifyWithLLM } from '../services/llm-service.js';
import { sendClassifiedCommand } from '../ws/relay.js';

export const botCallbackRouter = Router();

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatRequest {
  model?: string;
  messages?: OpenAIChatMessage[];
  stream?: boolean;
}

/**
 * Extracts the last user message from an OpenAI chat completion request.
 * @param messages - The messages array
 * @returns The last user message text
 */
function extractUserMessage(messages: OpenAIChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'user' && msg.content) {
      return msg.content;
    }
  }
  return '';
}

/**
 * Builds a non-streaming OpenAI chat completion response.
 * @param content - The assistant's response text
 * @returns OpenAI-compatible response object
 */
function buildChatResponse(content: string): Record<string, unknown> {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'deskpilot',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

/**
 * Builds a streaming SSE chunk.
 * @param content - The text chunk
 * @param done - Whether this is the final chunk
 * @returns SSE-formatted string
 */
function buildStreamChunk(content: string, done: boolean): string {
  if (done) return 'data: [DONE]\n\n';
  const chunk = {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'deskpilot',
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Writes an SSE response (streaming or non-streaming).
 * @param res - Express response object
 * @param text - Response text
 * @param streaming - Whether to use SSE streaming
 */
function sendResponse(
  res: import('express').Response,
  text: string,
  streaming: boolean,
): void {
  if (streaming) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(buildStreamChunk(text, false));
    res.write(buildStreamChunk('', true));
    res.end();
  } else {
    res.json(buildChatResponse(text));
  }
}

/**
 * POST /api/bot/v1/chat/completions
 *
 * Flow:
 * 1. TRTC bot sends ASR text
 * 2. We classify intent via Groq LLM
 * 3. Send classified command to PC Agent via WebSocket
 * 4. Return TTS response immediately (don't wait for execution)
 */
botCallbackRouter.post('/v1/chat/completions', async (req, res) => {
  const roomId = (req.headers['x-room-id'] as string) ?? '';
  const trtcUserId = (req.headers['x-user-id'] as string) ?? '';
  const taskId = (req.headers['x-task-id'] as string) ?? '';

  const body = req.body as OpenAIChatRequest;
  const messages = body.messages ?? [];
  const streaming = body.stream === true;
  const userText = extractUserMessage(messages);

  console.log(`[Bot Callback] Room: ${roomId}, User: ${trtcUserId}, Task: ${taskId}`);
  console.log(`[Bot Callback] Text: "${userText}" (stream=${String(streaming)})`);

  if (!userText) {
    sendResponse(res, 'I did not hear that clearly. Could you repeat?', streaming);
    return;
  }

  // Note: don't check isAgentConnected here — sendClassifiedCommand has fallback logic
  // that can find the agent even when roomId doesn't match exactly

  try {
    // Step 1: Classify intent via Groq LLM
    const classification = await classifyWithLLM(userText);
    console.log(`[Bot Callback] Classified: ${classification.intentType} → ${String(classification.executor)} (confidence: ${String(classification.confidence)})`);
    console.log(`[Bot Callback] Instruction: "${classification.instruction}"`);
    console.log(`[Bot Callback] TTS: "${classification.ttsResponse}"`);

    // Step 2: Send command to PC Agent (fire-and-forget for non-meta intents)
    if (classification.executor && classification.confidence >= 0.4) {
      const command = {
        commandId: generateCommandId(),
        intentType: classification.intentType,
        executor: classification.executor,
        instruction: classification.instruction,
        parameters: classification.parameters,
        timestamp: Date.now(),
        signature: '', // Cloud-originated commands; PC Agent trusts the WebSocket channel
      };

      sendClassifiedCommand(roomId, command);
      console.log(`[Bot Callback] Sent command ${command.commandId} to PC Agent`);
    }

    // Step 3: Return TTS response immediately
    sendResponse(res, classification.ttsResponse, streaming);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Bot Callback] Error:`, message);
    sendResponse(res, 'Sorry, something went wrong. Please try again.', streaming);
  }
});
