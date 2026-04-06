/**
 * Claude Desktop executor — sends prompts to the user's Claude Desktop app
 * via macOS Accessibility API (AppleScript).
 *
 * This preserves the user's existing Claude Desktop context (project, history, files).
 * DeskPilot acts as a "remote keyboard" — typing into Claude Desktop and pressing Enter.
 *
 * Requirements:
 * - macOS only
 * - Claude Desktop (com.anthropic.claudefordesktop) installed and running
 * - Accessibility permissions granted for the PC Agent / Electron app
 */

import { execSync, exec } from 'node:child_process';
import type { CommandResult } from '@deskpilot/shared';
import { generateCommandId } from '@deskpilot/shared';

let claudeDesktopAvailable: boolean | null = null;

/**
 * Checks if Claude Desktop app is installed.
 */
export function isClaudeDesktopAvailable(): boolean {
  if (claudeDesktopAvailable !== null) return claudeDesktopAvailable;

  if (process.platform !== 'darwin') {
    claudeDesktopAvailable = false;
    return false;
  }

  try {
    execSync('test -d /Applications/Claude.app', { timeout: 3000 });
    claudeDesktopAvailable = true;
    console.log('[ClaudeDesktop] Found at /Applications/Claude.app');
  } catch {
    claudeDesktopAvailable = false;
    console.log('[ClaudeDesktop] Not installed');
  }

  return claudeDesktopAvailable;
}

/**
 * Checks if Claude Desktop is currently running.
 */
export function isClaudeDesktopRunning(): boolean {
  try {
    const result = execSync(
      'osascript -e \'tell application "System Events" to (name of every process) contains "Claude"\'',
      { encoding: 'utf-8', timeout: 3000 },
    ).trim();
    return result === 'true';
  } catch {
    return false;
  }
}

/**
 * Sends a prompt to Claude Desktop by simulating keyboard input.
 * Activates Claude Desktop, types the text, and presses Enter.
 *
 * @param prompt - The text to send to Claude Desktop
 * @returns Execution result
 */
export async function sendToClaudeDesktop(prompt: string): Promise<CommandResult> {
  const startTime = Date.now();
  const commandId = generateCommandId();

  if (!isClaudeDesktopAvailable()) {
    return {
      commandId,
      success: false,
      output: '',
      error: 'Claude Desktop is not installed',
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  // Escape special characters for AppleScript
  const escapedPrompt = prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const script = `
tell application "Claude" to activate
delay 0.5
tell application "System Events"
    tell process "Claude"
        keystroke "a" using command down
        key code 51
        delay 0.2
        keystroke "${escapedPrompt}"
        delay 0.3
        key code 36
    end tell
end tell
`;

  return new Promise((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 10000 }, (err) => {
      if (err) {
        resolve({
          commandId,
          success: false,
          output: '',
          error: `Failed to send to Claude Desktop: ${err.message}`,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      } else {
        console.log(`[ClaudeDesktop] Sent prompt: "${prompt.slice(0, 60)}..."`);
        resolve({
          commandId,
          success: true,
          output: `Sent to Claude Desktop: "${prompt.slice(0, 100)}"`,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
        });
      }
    });
  });
}
