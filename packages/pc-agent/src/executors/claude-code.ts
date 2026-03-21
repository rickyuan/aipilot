/**
 * Claude Code executor — runs Claude Code CLI via child_process.spawn.
 *
 * IMPORTANT: Use spawn, not exec. Claude Code streams to stdout
 * and exec buffers everything.
 */

import { spawn } from 'node:child_process';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';

/**
 * Executes a Claude Code CLI command.
 * @param command - The command payload to execute
 * @returns The execution result
 */
export async function executeClaudeCode(command: CommandPayload): Promise<CommandResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const args = ['--print', command.instruction];
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
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
        output: stdout || stderr,
        error: code !== 0 ? stderr || `Process exited with code ${String(code)}` : undefined,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });

    child.on('error', (err: Error) => {
      resolve({
        commandId: command.commandId,
        success: false,
        output: '',
        error: `Failed to spawn claude: ${err.message}`,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });
  });
}
