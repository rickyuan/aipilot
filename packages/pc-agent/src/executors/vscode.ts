/**
 * VS Code executor — controls VS Code via the `code` CLI.
 */

import { spawn } from 'node:child_process';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';

/**
 * Executes a VS Code action (open file, navigate, run tasks).
 * @param command - The command payload to execute
 * @returns The execution result
 */
export async function executeVSCode(command: CommandPayload): Promise<CommandResult> {
  const startTime = Date.now();
  const params = command.parameters as Record<string, string>;

  // Determine the VS Code CLI args based on intent
  let args: string[];

  switch (command.intentType) {
    case 'file.navigate':
      // Open a file or folder in VS Code
      args = [params['path'] ?? command.instruction];
      break;
    case 'editor.action':
      // Run a VS Code command
      args = ['--command', params['action'] ?? command.instruction];
      break;
    default:
      args = [command.instruction];
  }

  return new Promise((resolve) => {
    const child = spawn('code', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        commandId: command.commandId,
        success: code === 0,
        output: stdout || `VS Code action executed: ${args.join(' ')}`,
        error: code !== 0 ? stderr : undefined,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });

    child.on('error', (err: Error) => {
      resolve({
        commandId: command.commandId,
        success: false,
        output: '',
        error: `Failed to spawn VS Code CLI: ${err.message}`,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });
  });
}
