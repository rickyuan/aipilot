/**
 * Browser executor — opens URLs in the default browser.
 */

import { exec } from 'node:child_process';
import { platform } from 'node:os';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';

/**
 * Opens a URL in the user's default browser.
 * @param command - The command payload to execute
 * @returns The execution result
 */
export async function executeBrowser(command: CommandPayload): Promise<CommandResult> {
  const startTime = Date.now();
  const params = command.parameters as Record<string, string>;
  const url = params['url'] ?? command.instruction;

  // Validate URL — block file:// and other internal protocols
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return {
      commandId: command.commandId,
      success: false,
      output: '',
      error: `Only http:// and https:// URLs are allowed. Got: ${url}`,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  // Platform-appropriate open command
  const openCmd = platform() === 'darwin' ? 'open' : 'xdg-open';

  return new Promise((resolve) => {
    exec(`${openCmd} "${url}"`, (error) => {
      resolve({
        commandId: command.commandId,
        success: !error,
        output: error ? '' : `Opened ${url}`,
        error: error ? error.message : undefined,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });
  });
}
