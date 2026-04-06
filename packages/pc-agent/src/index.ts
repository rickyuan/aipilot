/**
 * DeskPilot PC Agent — Daemon entry point.
 *
 * Persistent device model:
 * - First launch: registers with Cloud, gets fixed pairing code
 * - Connects WebSocket and waits for mobile to request screen share
 * - Screen capture only starts on demand from mobile
 * - Stops capture when mobile disconnects, returns to standby
 *
 * Modes:
 *   (default)   — Production: register device, standby, on-demand screen share
 *   --demo      — Test command execution without TRTC
 *   --classify  — Test intent classification pipeline
 *   --local     — Local dev mode: WebSocket relay only, no TRTC
 */

import './config.js';
import type { CommandPayload } from '@deskpilot/shared';
import { joinRoom, leaveRoom, onCommandReceived, sendCommandResult, simulateIncomingCommand, startScreenCapture } from './trtc/room.js';
import { routeCommand } from './executors/router.js';
import { processUtterance } from './intent/pipeline.js';
import { registerDeviceWithCloud, getRoomConfig } from './cloud-client.js';
import { connectToCloudWs } from './cloud-ws.js';
import { loadDeviceConfig, saveDeviceConfig } from './device-config.js';
import { isClaudeCodeAvailable } from './executors/claude-code.js';
import { isClaudeDesktopAvailable, isClaudeDesktopRunning } from './executors/claude-desktop.js';
import type { TRTCRoomConfig } from '@deskpilot/shared';

let currentRoomConfig: TRTCRoomConfig | null = null;
let isScreenSharing = false;

/**
 * Handles incoming command payloads from the AI bot.
 */
async function handleCommand(command: CommandPayload): Promise<void> {
  console.log(`[Agent] Received command: ${command.intentType} → ${command.executor}`);
  const result = await routeCommand(command);
  sendCommandResult(result);
  console.log(`[Agent] Command ${command.commandId} ${result.success ? 'completed' : `failed: ${result.error ?? 'unknown'}`}`);
}

/**
 * Handles screen share request from mobile (via WebSocket).
 */
async function handleScreenShareRequest(): Promise<void> {
  if (isScreenSharing) {
    console.log('[Agent] Screen share already active');
    return;
  }
  if (!currentRoomConfig) {
    console.error('[Agent] No room config — cannot start screen share');
    return;
  }

  console.log('[Agent] Mobile requested screen share — joining room + starting capture');
  isScreenSharing = true;
  await joinRoom(currentRoomConfig);
  updateElectronStatus('Screen sharing');
}

/**
 * Handles screen share stop from mobile.
 */
async function handleScreenShareStop(): Promise<void> {
  if (!isScreenSharing) return;

  console.log('[Agent] Mobile stopped screen share — leaving room');
  isScreenSharing = false;
  await leaveRoom();
  updateElectronStatus('Ready');
}

/**
 * Sends status update to Electron window via IPC.
 */
function updateElectronStatus(status: string, extra?: Record<string, unknown>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      wins[0].webContents.send('status-update', { status, ...extra });
    }
  } catch {
    // Not in Electron
  }
}

async function main(): Promise<void> {
  console.log('[Agent] Starting DeskPilot PC Agent...');

  onCommandReceived((command: CommandPayload) => {
    handleCommand(command).catch(console.error);
  });

  if (process.argv.includes('--demo')) { await runDemo(); return; }
  if (process.argv.includes('--classify')) { await runClassifyDemo(); return; }
  if (process.argv.includes('--local')) { await runLocal(); return; }

  await runProduction();
}

/**
 * Production mode — persistent device, standby, on-demand screen share.
 */
async function runProduction(): Promise<void> {
  // Load or create persistent device identity
  const deviceConfig = await loadDeviceConfig();
  console.log(`[Agent] Device ID: ${deviceConfig.pcId}`);

  // Detect Claude capabilities
  const hasClaudeDesktop = isClaudeDesktopAvailable();
  const hasClaudeCode = isClaudeCodeAvailable();
  const claudeDesktopRunning = hasClaudeDesktop && isClaudeDesktopRunning();

  if (claudeDesktopRunning) {
    console.log('[Agent] Claude Desktop: running (voice → Claude Desktop directly, preserves context)');
  } else if (hasClaudeCode) {
    console.log('[Agent] Claude Code CLI: available (voice → Claude Code)');
  } else {
    console.log('[Agent] No local Claude found (using Cloud LLM intent classification)');
  }

  console.log('[Agent] Connecting to Cloud API...');

  try {
    // Register device (idempotent — returns existing if already registered)
    const registration = await registerDeviceWithCloud(deviceConfig.pcId, deviceConfig.displayName);

    // Save persistent config locally
    deviceConfig.pairingCode = registration.pairingCode;
    deviceConfig.roomId = registration.roomId;
    deviceConfig.hmacKey = registration.hmacKey;
    await saveDeviceConfig(deviceConfig);

    currentRoomConfig = registration.roomConfig;

    console.log(`[Agent] Room: ${registration.roomId}`);
    console.log('');
    console.log('======================================');
    console.log('');
    console.log(`     Pairing Code:  ${registration.pairingCode}`);
    console.log('');
    console.log('  This code never expires.');
    console.log('  Enter it once on your mobile app.');
    console.log('');
    console.log('======================================');
    console.log('');

    // Update Electron window
    updateElectronStatus('Ready', { pairingCode: registration.pairingCode });

    // Connect WebSocket — but DON'T join TRTC room yet
    connectToCloudWs(
      registration.roomId,
      deviceConfig.pcId,
      registration.hmacKey,
      `sess_persistent_${deviceConfig.pcId}`,
      handleScreenShareRequest,
      handleScreenShareStop,
    );

    console.log('[Agent] Standing by — waiting for mobile to connect');
    console.log('[Agent] Press Ctrl+C to stop');

    await new Promise(() => {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Agent] Failed to start: ${message}`);
    console.log('[Agent] Make sure the Cloud server is running (pnpm dev:cloud)');
    process.exit(1);
  }
}

/**
 * Local dev mode — WebSocket relay only, no TRTC.
 */
async function runLocal(): Promise<void> {
  const deviceConfig = await loadDeviceConfig();
  console.log('[Agent] Running in LOCAL dev mode (no TRTC)');

  try {
    const registration = await registerDeviceWithCloud(deviceConfig.pcId, deviceConfig.displayName);
    deviceConfig.pairingCode = registration.pairingCode;
    deviceConfig.roomId = registration.roomId;
    deviceConfig.hmacKey = registration.hmacKey;
    await saveDeviceConfig(deviceConfig);

    console.log(`  Pairing Code: ${registration.pairingCode} (fixed)`);

    connectToCloudWs(
      registration.roomId,
      deviceConfig.pcId,
      registration.hmacKey,
      `sess_local_${deviceConfig.pcId}`,
    );

    if (process.stdin.isTTY) {
      console.log('[Agent] Type a command to test:');
      const readline = await import('node:readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.on('line', (line: string) => {
        const utterance = line.trim();
        if (!utterance) return;
        processUtterance(utterance, registration.hmacKey).catch(console.error);
      });
      rl.on('close', () => process.exit(0));
    } else {
      console.log('[Agent] Waiting for commands via WebSocket...');
      await new Promise(() => {});
    }
  } catch (err: unknown) {
    console.error(`[Agent] Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    process.exit(1);
  }
}

async function runDemo(): Promise<void> {
  console.log('[Agent] Demo mode...\n');
  await joinRoom({ sdkAppId: 0, roomId: 'demo', userId: 'demo_pc', userSig: 'demo' });

  simulateIncomingCommand({
    commandId: 'demo_1', intentType: 'shell.exec', executor: 'shell',
    instruction: 'echo "Hello from DeskPilot!"',
    parameters: {}, timestamp: Date.now(), signature: 'demo',
  });
  await sleep(2000);
  console.log('\n[Agent] Demo complete.');
}

async function runClassifyDemo(): Promise<void> {
  console.log('[Agent] Classification demo\n');
  await joinRoom({ sdkAppId: 0, roomId: 'demo', userId: 'demo_pc', userSig: 'demo' });

  for (const utterance of ['Install express', 'What is on port 3000', 'Open localhost:8080']) {
    console.log(`\n${'='.repeat(40)}`);
    const result = await processUtterance(utterance, 'demo');
    if (result) console.log(`success=${String(result.success)} output=${result.output.slice(0, 80)}`);
    await sleep(500);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((error: unknown) => {
  console.error('[Agent] Fatal error:', error);
  process.exit(1);
});
