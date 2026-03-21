/**
 * Intent parser — translates classified intents into executor commands.
 *
 * Uses extracted parameters from Claude's classification to build
 * proper shell commands, file paths, and URLs.
 */

import type { ClassifiedIntent, CommandPayload, IntentType } from '@deskpilot/shared';
import { INTENT_EXECUTOR_MAP, generateCommandId } from '@deskpilot/shared';
import { createHmac } from 'node:crypto';

/**
 * Converts a classified intent into a command payload for the appropriate executor.
 * @param intent - The classified intent from the AI bot
 * @param sessionHmacKey - Per-session HMAC key for signing
 * @returns The command payload, or null for meta intents (confirm.yes/no)
 */
export function intentToCommand(
  intent: ClassifiedIntent,
  sessionHmacKey: string,
): CommandPayload | null {
  const executor = INTENT_EXECUTOR_MAP[intent.type];

  if (executor === null) {
    return null;
  }

  const commandId = generateCommandId();
  const timestamp = Date.now();

  const signatureData = `${commandId}:${intent.type}:${String(timestamp)}`;
  const signature = createHmac('sha256', sessionHmacKey)
    .update(signatureData)
    .digest('hex');

  // Build a proper instruction from the intent type and parameters
  const instruction = buildInstruction(intent);

  return {
    commandId,
    intentType: intent.type,
    executor,
    instruction,
    parameters: intent.parameters,
    timestamp,
    signature,
  };
}

/**
 * Builds a proper executable instruction from intent parameters.
 * @param intent - The classified intent
 * @returns An instruction string suitable for the executor
 */
function buildInstruction(intent: ClassifiedIntent): string {
  const params = intent.parameters;

  const instructionBuilders: Record<IntentType, () => string> = {
    'shell.exec': () => asString(params['command']) || intent.rawUtterance,
    'system.status': () => buildStatusCommand(asString(params['query']) || intent.rawUtterance),
    'file.create': () => buildFileCreateCommand(params),
    'file.navigate': () => asString(params['path']) || asString(params['filename']) || intent.rawUtterance,
    'browser.open': () => asString(params['url']) || extractUrl(intent.rawUtterance),
    'code.create': () => asString(params['description']) || intent.rawUtterance,
    'code.edit': () => asString(params['description']) || intent.rawUtterance,
    'code.explain': () => asString(params['description']) || intent.rawUtterance,
    'editor.action': () => asString(params['action']) || intent.rawUtterance,
    'confirm.yes': () => '',
    'confirm.no': () => '',
  };

  const builder = instructionBuilders[intent.type];
  return builder();
}

/**
 * Builds a status-checking shell command from natural language.
 * @param utterance - The raw utterance
 * @returns A shell command
 */
function buildStatusCommand(utterance: string): string {
  const lower = utterance.toLowerCase();

  // Extract port number
  const portMatch = lower.match(/port\s*(\d+)/);
  if (portMatch) {
    return `lsof -i :${portMatch[1]} | head -20`;
  }

  // Generic status
  if (lower.includes('process') || lower.includes('running')) {
    return 'ps aux | head -20';
  }

  return 'pwd && ls -la';
}

/**
 * Builds a file creation command.
 * @param params - Intent parameters
 * @returns A shell command
 */
function buildFileCreateCommand(params: Record<string, unknown>): string {
  const filename = asString(params['filename']) || asString(params['path']);
  if (filename) {
    return `touch ${filename}`;
  }
  return 'echo "No filename specified"';
}

/**
 * Extracts a URL from natural language.
 * @param text - Text possibly containing a URL
 * @returns The extracted URL or the original text
 */
function extractUrl(text: string): string {
  // Match explicit URLs
  const urlMatch = text.match(/https?:\/\/\S+/);
  if (urlMatch) return urlMatch[0];

  // Match localhost patterns
  const localMatch = text.match(/localhost[:\d]*/);
  if (localMatch) return `http://${localMatch[0]}`;

  // Match domain-like patterns
  const domainMatch = text.match(/\b[\w-]+\.(com|org|net|io|dev|app)\b/);
  if (domainMatch) return `https://${domainMatch[0]}`;

  return text;
}

/**
 * Safely converts unknown to string.
 * @param value - The value to convert
 * @returns The string value or empty string
 */
function asString(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  return '';
}
