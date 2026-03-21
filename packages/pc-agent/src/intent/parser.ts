/**
 * Intent parser — translates AI bot output into executor calls.
 */

import type { ClassifiedIntent, CommandPayload } from '@deskpilot/shared';
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

  return {
    commandId,
    intentType: intent.type,
    executor,
    instruction: intent.rawUtterance,
    parameters: intent.parameters,
    timestamp,
    signature,
  };
}
