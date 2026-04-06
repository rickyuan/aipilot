/**
 * Workspace executor — opens recent VS Code workspaces.
 *
 * Handles "continue last project", "open recent project" type intents
 * by looking up VS Code's recent workspace list and opening the match.
 */

import { spawn } from 'node:child_process';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';
import { getRecentWorkspaces } from '../workspace/tracker.js';

/**
 * Opens a recent workspace in VS Code.
 * @param command - The command payload
 * @returns The execution result
 */
export async function executeWorkspace(command: CommandPayload): Promise<CommandResult> {
  const startTime = Date.now();

  try {
    const workspaces = await getRecentWorkspaces(5);

    if (workspaces.length === 0) {
      return {
        commandId: command.commandId,
        success: false,
        output: '',
        error: 'No recent VS Code workspaces found',
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // If instruction mentions a specific project name, try to match
    const instruction = command.instruction.toLowerCase();
    const firstWorkspace = workspaces[0]!;
    let target = firstWorkspace;

    if (instruction && instruction !== 'recent' && instruction !== 'last') {
      const match = workspaces.find((w) =>
        w.name.toLowerCase().includes(instruction) ||
        w.path.toLowerCase().includes(instruction),
      );
      if (match) {
        target = match;
      }
    }

    // Open in VS Code
    return new Promise((resolve) => {
      const child = spawn('code', [target.path], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.on('close', (code) => {
        resolve({
          commandId: command.commandId,
          success: code === 0,
          output: `Opened workspace: ${target.name} (${target.path})`,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      });

      child.on('error', (err: Error) => {
        resolve({
          commandId: command.commandId,
          success: false,
          output: '',
          error: `Failed to open VS Code: ${err.message}`,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      commandId: command.commandId,
      success: false,
      output: '',
      error: `Workspace executor failed: ${message}`,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }
}
