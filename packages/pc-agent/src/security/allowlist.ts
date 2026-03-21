/**
 * Security allowlist for shell command execution.
 *
 * CRITICAL: All shell commands MUST be checked against this allowlist
 * before execution. See docs/security-model.md for the full threat model.
 */

/** Commands that are always allowed without confirmation */
const ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'echo',
  'node',
  'npm',
  'pnpm',
  'npx',
  'git',
  'code',
  'which',
  'whoami',
  'date',
  'curl',
  'wget',
  'python',
  'python3',
  'pip',
  'pip3',
]);

/** Commands that require voice confirmation before execution */
const DESTRUCTIVE_COMMANDS: ReadonlySet<string> = new Set([
  'rm',
  'rmdir',
  'drop',
  'delete',
  'format',
  'kill',
  'killall',
  'pkill',
  'mv',
  'chmod',
  'chown',
]);

/** Commands that are always blocked */
const BLOCKED_COMMANDS: ReadonlySet<string> = new Set([
  'sudo',
  'su',
  'shutdown',
  'reboot',
  'mkfs',
  'dd',
  'fdisk',
]);

export type AllowlistResult =
  | { allowed: true }
  | { allowed: false; requiresConfirmation: true; reason: string }
  | { allowed: false; requiresConfirmation: false; reason: string };

/**
 * Checks a command against the security allowlist.
 * @param rawCommand - The raw shell command string
 * @returns Whether the command is allowed, needs confirmation, or is blocked
 */
export function checkAllowlist(rawCommand: string): AllowlistResult {
  const baseCommand = rawCommand.trim().split(/\s+/)[0];

  if (!baseCommand) {
    return { allowed: false, requiresConfirmation: false, reason: 'Empty command' };
  }

  if (BLOCKED_COMMANDS.has(baseCommand)) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `Command "${baseCommand}" is blocked for security reasons`,
    };
  }

  if (DESTRUCTIVE_COMMANDS.has(baseCommand)) {
    return {
      allowed: false,
      requiresConfirmation: true,
      reason: `Command "${baseCommand}" is destructive and requires confirmation`,
    };
  }

  if (ALLOWED_COMMANDS.has(baseCommand)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    requiresConfirmation: true,
    reason: `Command "${baseCommand}" is not in the allowlist — confirmation required`,
  };
}
