/**
 * Shell executor — runs shell commands with security allowlist enforcement.
 *
 * CRITICAL: All commands checked against allowlist before execution.
 * Destructive operations require confirmation via the confirmation flow.
 */

import { spawn } from 'node:child_process';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';
import { ErrorCode } from '@deskpilot/shared';
import { checkAllowlist } from '../security/allowlist.js';

/** Pending commands waiting for user confirmation */
const pendingConfirmation = new Map<string, CommandPayload>();

/**
 * Executes a shell command after security validation.
 * @param command - The command payload to execute
 * @returns The execution result
 */
export async function executeShell(command: CommandPayload): Promise<CommandResult> {
  const startTime = Date.now();
  const rawCommand = command.instruction;

  // Security check
  const check = checkAllowlist(rawCommand);

  if (!check.allowed && !check.requiresConfirmation) {
    // Blocked command
    return {
      commandId: command.commandId,
      success: false,
      output: '',
      error: `${ErrorCode.EXEC_COMMAND_BLOCKED}: ${check.reason}`,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  if (!check.allowed && check.requiresConfirmation) {
    // Needs voice confirmation
    pendingConfirmation.set(command.commandId, command);
    return {
      commandId: command.commandId,
      success: false,
      output: '',
      error: `${ErrorCode.EXEC_CONFIRMATION_REQUIRED}: ${check.reason}`,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  // Execute the command
  return runShellCommand(command);
}

/**
 * Confirms a pending command and executes it.
 * @param commandId - The command ID that was pending confirmation
 * @returns The execution result, or null if no pending command
 */
export async function confirmAndExecute(commandId: string): Promise<CommandResult | null> {
  const command = pendingConfirmation.get(commandId);
  if (!command) return null;

  pendingConfirmation.delete(commandId);
  return runShellCommand(command);
}

/**
 * Denies a pending command.
 * @param commandId - The command ID to deny
 * @returns A denial result, or null if no pending command
 */
export function denyCommand(commandId: string): CommandResult | null {
  const command = pendingConfirmation.get(commandId);
  if (!command) return null;

  pendingConfirmation.delete(commandId);
  return {
    commandId: command.commandId,
    success: false,
    output: '',
    error: `${ErrorCode.EXEC_CONFIRMATION_DENIED}: Command denied by user`,
    durationMs: 0,
    timestamp: Date.now(),
  };
}

/**
 * Actually runs the shell command via spawn.
 */
function runShellCommand(command: CommandPayload): Promise<CommandResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command.instruction], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      timeout: 30000,
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
        error: code !== 0 ? stderr || `Exited with code ${String(code)}` : undefined,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });

    child.on('error', (err: Error) => {
      resolve({
        commandId: command.commandId,
        success: false,
        output: '',
        error: `Failed to spawn shell: ${err.message}`,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });
  });
}
