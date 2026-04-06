/**
 * Claude Code executor — runs user's local Claude Code CLI.
 *
 * Two modes:
 * 1. Direct mode: voice text goes straight to `claude` as a prompt
 *    (no intent classification needed — Claude Code decides what to do)
 * 2. Print mode: single-shot `claude --print` for quick tasks
 *
 * IMPORTANT: Use spawn, not exec. Claude Code streams to stdout.
 */

import { spawn, execSync } from 'node:child_process';
import type { CommandPayload, CommandResult } from '@deskpilot/shared';
import { generateCommandId } from '@deskpilot/shared';

const CLAUDE_TIMEOUT_MS = 300_000; // 5 minutes for complex tasks

let claudeAvailable: boolean | null = null;
let claudePath = 'claude';

/**
 * Checks if Claude Code CLI is installed and accessible.
 * @returns Whether claude CLI is available
 */
export function isClaudeCodeAvailable(): boolean {
  if (claudeAvailable !== null) return claudeAvailable;

  try {
    const result = execSync('which claude 2>/dev/null || where claude 2>nul', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (result) {
      claudePath = result.split('\n')[0]!.trim();
      claudeAvailable = true;
      console.log(`[ClaudeCode] Found at: ${claudePath}`);
    } else {
      claudeAvailable = false;
    }
  } catch {
    claudeAvailable = false;
  }

  if (!claudeAvailable) {
    console.log('[ClaudeCode] CLI not found — complex tasks will use fallback');
  }

  return claudeAvailable;
}

/**
 * Sends a voice utterance directly to Claude Code for autonomous execution.
 * Claude Code decides what to do — no intent classification needed.
 *
 * @param utterance - The raw voice text from the user
 * @param workspacePath - Optional workspace directory
 * @returns The execution result
 */
export async function executeWithClaudeCode(
  utterance: string,
  workspacePath?: string,
): Promise<CommandResult> {
  const startTime = Date.now();
  const commandId = generateCommandId();

  if (!isClaudeCodeAvailable()) {
    return {
      commandId,
      success: false,
      output: '',
      error: 'Claude Code CLI is not installed. Please install it: npm install -g @anthropic-ai/claude-code',
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  console.log(`[ClaudeCode] Executing: "${utterance.slice(0, 100)}"`);

  return new Promise((resolve) => {
    const args = ['--print', utterance];

    const spawnOptions: Record<string, unknown> = {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: CLAUDE_TIMEOUT_MS,
    };
    if (workspacePath) {
      spawnOptions['cwd'] = workspacePath;
    }

    const child = spawn(claudePath, args, spawnOptions);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      // TODO: stream chunks back to mobile in real-time
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code, signal) => {
      const timedOut = signal === 'SIGTERM';
      const durationMs = Date.now() - startTime;

      console.log(`[ClaudeCode] Done in ${String(durationMs)}ms, exit=${String(code)}`);

      resolve({
        commandId,
        success: code === 0,
        output: stdout || stderr,
        error: timedOut
          ? `Claude Code timed out after ${String(CLAUDE_TIMEOUT_MS / 1000)}s`
          : code !== 0 ? stderr || `Exit code ${String(code)}` : undefined,
        durationMs,
        timestamp: Date.now(),
      });
    });

    child.on('error', (err: Error) => {
      resolve({
        commandId,
        success: false,
        output: '',
        error: `Failed to spawn claude: ${err.message}`,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });
  });
}

/**
 * Legacy: Executes a pre-classified command via Claude Code --print.
 * Used when intent classification routes to claude-code executor.
 */
export async function executeClaudeCode(command: CommandPayload): Promise<CommandResult> {
  let fullInstruction = command.instruction;
  if (command.context) {
    fullInstruction = `Context from previous conversation:\n${command.context}\n\nTask: ${command.instruction}`;
  }

  const result = await executeWithClaudeCode(fullInstruction, command.workspacePath);
  // Use the original commandId
  return { ...result, commandId: command.commandId };
}
