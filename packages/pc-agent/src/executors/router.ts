/**
 * Executor router — dispatches command payloads to the correct executor.
 */

import type { CommandPayload, CommandResult } from '@deskpilot/shared';
import { ErrorCode } from '@deskpilot/shared';
import { executeClaudeCode } from './claude-code.js';
import { executeShell } from './shell.js';
import { executeVSCode } from './vscode.js';
import { executeBrowser } from './browser.js';
import { auditLog } from '../audit.js';

/**
 * Routes a command to the appropriate executor and returns the result.
 * All commands are audit-logged before and after execution.
 * @param command - The command payload to execute
 * @returns The execution result
 */
export async function routeCommand(command: CommandPayload): Promise<CommandResult> {
  // Audit log: command received
  auditLog(command);

  console.log(`[Router] Executing ${command.executor}: ${command.instruction.slice(0, 80)}`);

  let result: CommandResult;

  try {
    switch (command.executor) {
      case 'claude-code':
        result = await executeClaudeCode(command);
        break;
      case 'shell':
        result = await executeShell(command);
        break;
      case 'vscode':
        result = await executeVSCode(command);
        break;
      case 'browser':
        result = await executeBrowser(command);
        break;
      default: {
        const exhaustive: never = command.executor;
        result = {
          commandId: command.commandId,
          success: false,
          output: '',
          error: `${ErrorCode.EXEC_COMMAND_FAILED}: Unknown executor: ${String(exhaustive)}`,
          durationMs: 0,
          timestamp: Date.now(),
        };
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    result = {
      commandId: command.commandId,
      success: false,
      output: '',
      error: `${ErrorCode.EXEC_COMMAND_FAILED}: ${message}`,
      durationMs: 0,
      timestamp: Date.now(),
    };
  }

  // Audit log: command result
  auditLog(command, result);

  const status = result.success ? '✓' : '✗';
  console.log(`[Router] ${status} ${command.commandId} (${String(result.durationMs)}ms)`);

  return result;
}
