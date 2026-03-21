/**
 * Audit logger — logs all command executions to ~/.deskpilot/audit.log.
 *
 * Every command is recorded with timestamp, intent, raw utterance,
 * and execution result. This is a security requirement.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';

const AUDIT_DIR = resolve(homedir(), '.deskpilot');
const AUDIT_FILE = resolve(AUDIT_DIR, 'audit.log');

// Ensure audit directory exists
try {
  mkdirSync(AUDIT_DIR, { recursive: true });
} catch {
  // Directory already exists
}

interface AuditEntry {
  timestamp: string;
  intentType: string;
  executor: string;
  instruction: string;
  commandId: string;
  result?: {
    success: boolean;
    output: string;
    error?: string;
    durationMs: number;
  };
}

/**
 * Logs a command execution to the audit file.
 * @param command - The command that was executed
 * @param result - The execution result (optional, logged after execution)
 */
export function auditLog(command: CommandPayload, result?: CommandResult): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    intentType: command.intentType,
    executor: command.executor,
    instruction: command.instruction,
    commandId: command.commandId,
  };

  if (result) {
    entry.result = {
      success: result.success,
      output: result.output.slice(0, 500), // Truncate long outputs
      error: result.error,
      durationMs: result.durationMs,
    };
  }

  const line = JSON.stringify(entry) + '\n';

  try {
    appendFileSync(AUDIT_FILE, line, 'utf-8');
  } catch (err: unknown) {
    console.error('[Audit] Failed to write audit log:', err);
  }
}
