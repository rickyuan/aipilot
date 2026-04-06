/**
 * VS Code executor — controls VS Code via the `code` CLI.
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
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

  // Resolve common path aliases
  const resolvePath = (p: string): string => {
    if (p.startsWith('~/')) return resolve(homedir(), p.slice(2));
    if (p === 'desktop' || p === '桌面') return resolve(homedir(), 'Desktop');
    if (p === 'downloads' || p === '下载') return resolve(homedir(), 'Downloads');
    if (p === 'documents' || p === '文档') return resolve(homedir(), 'Documents');
    return p;
  };

  let useOpen = false; // Use macOS 'open' instead of VS Code

  switch (command.intentType) {
    case 'file.navigate': {
      const targetPath = resolvePath(params['path'] ?? command.instruction);
      // If it's a regular folder (not a code project), open with Finder
      try {
        if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
          const hasPackageJson = existsSync(resolve(targetPath, 'package.json'));
          const hasGit = existsSync(resolve(targetPath, '.git'));
          if (!hasPackageJson && !hasGit) {
            useOpen = true;
          }
        }
      } catch { /* ignore */ }
      args = [targetPath];
      break;
    }
    case 'editor.action':
      args = ['--command', params['action'] ?? command.instruction];
      break;
    default:
      args = [command.instruction];
  }

  const cmd = useOpen ? 'open' : 'code';

  return new Promise((done) => {
    const child = spawn(cmd, args, {
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
      done({
        commandId: command.commandId,
        success: code === 0,
        output: stdout || `Opened: ${args.join(' ')}`,
        error: code !== 0 ? stderr : undefined,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });

    child.on('error', (err: Error) => {
      done({
        commandId: command.commandId,
        success: false,
        output: '',
        error: `Failed to open: ${err.message}`,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });
    });
  });
}
