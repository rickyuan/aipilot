/**
 * Intent pipeline — full flow from raw utterance to command execution.
 *
 * Voice text → classify intent → build command → route to executor → return result
 */

import type { CommandPayload, CommandResult } from '@deskpilot/shared';
import { generateCommandId } from '@deskpilot/shared';
import { classifyIntent } from './classifier.js';
import { intentToCommand } from './parser.js';
import { routeCommand } from '../executors/router.js';
import { sendCommandResult } from '../trtc/room.js';

const MIN_CONFIDENCE = 0.4;

/** Last command that requires confirmation (destructive operations) */
let pendingConfirmation: CommandPayload | null = null;

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

  // Handle confirmation meta intents
  if (intent.type === 'confirm.yes') {
    return handleConfirmYes();
  }

  if (intent.type === 'confirm.no') {
    return handleConfirmNo();
  }

  // Step 2: Convert intent to command
  const command = intentToCommand(intent, sessionHmacKey);

  if (!command) {
    console.log(`[Pipeline] Could not build command for intent: ${intent.type}`);
    return null;
  }

  // Step 3: Execute command
  const result = await routeCommand(command);

  // If the command needs confirmation, store it and return the prompt
  if (!result.success && result.error === 'Confirmation required') {
    pendingConfirmation = command;
    const confirmResult: CommandResult = {
      commandId: command.commandId,
      success: false,
      output: `This is a destructive operation: "${command.instruction}". Do you want to proceed? Say "yes" to confirm or "no" to cancel.`,
      error: 'Awaiting confirmation',
      durationMs: 0,
      timestamp: Date.now(),
    };
    sendCommandResult(confirmResult);
    return confirmResult;
  }

  // Step 4: Send result back via TRTC
  sendCommandResult(result);

  return result;
}

/**
 * Handles a "yes" confirmation for pending destructive commands.
 * @returns The command result after execution
 */
async function handleConfirmYes(): Promise<CommandResult | null> {
  if (!pendingConfirmation) {
    const result: CommandResult = {
      commandId: generateCommandId(),
      success: false,
      output: 'There is no pending command to confirm.',
      durationMs: 0,
      timestamp: Date.now(),
    };
    sendCommandResult(result);
    return result;
  }

  console.log(`[Pipeline] Confirmed: ${pendingConfirmation.instruction}`);
  const command = { ...pendingConfirmation, parameters: { ...pendingConfirmation.parameters, confirmed: true } };
  pendingConfirmation = null;

  const result = await routeCommand(command);
  sendCommandResult(result);
  return result;
}

/**
 * Handles a "no" cancellation for pending destructive commands.
 * @returns The cancellation result
 */
function handleConfirmNo(): CommandResult {
  const cancelled = pendingConfirmation;
  pendingConfirmation = null;

  const result: CommandResult = {
    commandId: cancelled?.commandId ?? generateCommandId(),
    success: true,
    output: cancelled
      ? `Cancelled: "${cancelled.instruction}"`
      : 'Nothing to cancel.',
    durationMs: 0,
    timestamp: Date.now(),
  };

  sendCommandResult(result);
  return result;
}
