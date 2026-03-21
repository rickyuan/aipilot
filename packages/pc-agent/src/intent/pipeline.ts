/**
 * Intent pipeline — full flow from raw utterance to command execution.
 *
 * Voice text → classify intent → build command → route to executor → return result
 */

import type { CommandPayload, CommandResult } from '@deskpilot/shared';
import { classifyIntent } from './classifier.js';
import { intentToCommand } from './parser.js';
import { routeCommand } from '../executors/router.js';
import { sendCommandResult } from '../trtc/room.js';

const MIN_CONFIDENCE = 0.4;

/**
 * Processes a raw voice utterance through the full intent pipeline.
 * @param utterance - The raw voice text from ASR
 * @param sessionHmacKey - Per-session HMAC key for command signing
 * @returns The command result, or null for meta intents
 */
export async function processUtterance(
  utterance: string,
  sessionHmacKey: string,
): Promise<CommandResult | null> {
  console.log(`[Pipeline] Processing: "${utterance}"`);

  // Step 1: Classify intent
  const intent = await classifyIntent(utterance);
  console.log(`[Pipeline] Classified: ${intent.type} (confidence: ${String(intent.confidence)})`);

  // Reject low-confidence classifications
  if (intent.confidence < MIN_CONFIDENCE) {
    console.log(`[Pipeline] Low confidence (${String(intent.confidence)}), asking for clarification`);
    const result: CommandResult = {
      commandId: 'low_confidence',
      success: false,
      output: `I'm not sure what you mean by "${utterance}". Could you rephrase that?`,
      error: 'Low confidence classification',
      durationMs: 0,
      timestamp: Date.now(),
    };
    sendCommandResult(result);
    return result;
  }

  // Step 2: Convert intent to command
  const command = intentToCommand(intent, sessionHmacKey);

  if (!command) {
    // Meta intent (confirm.yes / confirm.no)
    console.log(`[Pipeline] Meta intent: ${intent.type}`);
    // TODO: Handle confirmation flow
    return null;
  }

  // Step 3: Execute command
  const result = await routeCommand(command);

  // Step 4: Send result back via TRTC
  sendCommandResult(result);

  return result;
}
