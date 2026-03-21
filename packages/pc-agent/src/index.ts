/**
 * DeskPilot PC Agent — Daemon entry point.
 *
 * Connects to TRTC room, publishes screen capture,
 * listens for command payloads from the AI bot, and executes them.
 *
 * Modes:
 *   (default)   — Production: connect to Cloud, create session, show pairing code
 *   --demo      — Test command execution without TRTC
 *   --classify  — Test intent classification pipeline
 *   --local     — Local dev mode: WebSocket relay only, no TRTC
 */

import './config.js'; // Load env vars first
import { hostname } from 'node:os';
import type { CommandPayload } from '@deskpilot/shared';
import { joinRoom, startScreenCapture, onCommandReceived, sendCommandResult, simulateIncomingCommand } from './trtc/room.js';
import { routeCommand } from './executors/router.js';
import { processUtterance } from './intent/pipeline.js';
import { createSession, generatePairingCode } from './cloud-client.js';
import { connectToCloudWs } from './cloud-ws.js';

/**
 * Handles incoming command payloads from the AI bot.
 * @param command - The command to execute
 */
async function handleCommand(command: CommandPayload): Promise<void> {
  console.log(`[Agent] Received command: ${command.intentType} → ${command.executor}`);

  const result = await routeCommand(command);
  sendCommandResult(result);

  if (result.success) {
    console.log(`[Agent] Command ${command.commandId} completed successfully`);
  } else {
    console.log(`[Agent] Command ${command.commandId} failed: ${result.error ?? 'unknown'}`);
  }
}

async function main(): Promise<void> {
  console.log('[Agent] Starting DeskPilot PC Agent...');

  // Register command handler
  onCommandReceived((command: CommandPayload) => {
    handleCommand(command).catch((err: unknown) => {
      console.error('[Agent] Unhandled error in command handler:', err);
    });
  });

  // If started with --demo flag, run a quick demo
  if (process.argv.includes('--demo')) {
    await runDemo();
    return;
  }

  // If started with --classify, run interactive intent classification
  if (process.argv.includes('--classify')) {
    await runClassifyDemo();
    return;
  }

  // If started with --local, run in local dev mode (WebSocket only, no TRTC)
  if (process.argv.includes('--local')) {
    await runLocal();
    return;
  }

  // Production mode: connect to Cloud API, create session, show pairing code
  await runProduction();
}

/**
 * Production mode — connects to Cloud API, creates session,
 * displays pairing code, joins TRTC room, and starts WebSocket relay.
 */
async function runProduction(): Promise<void> {
  const pcUserId = `pc_${hostname()}_${Date.now()}`;

  console.log(`[Agent] PC User ID: ${pcUserId}`);
  console.log('[Agent] Connecting to Cloud API...');

  try {
    // Create session
    const { session, roomConfig } = await createSession(pcUserId);
    console.log(`[Agent] Session created: ${session.sessionId}`);
    console.log(`[Agent] Room: ${session.roomId}`);

    // Generate pairing code
    const pairing = await generatePairingCode(pcUserId);
    console.log('');
    console.log('======================================');
    console.log('');
    console.log(`     Pairing Code:  ${pairing.pairingCode}`);
    console.log('');
    console.log('  Enter this code on your mobile app');
    console.log(`  Expires: ${new Date(pairing.expiresAt).toLocaleTimeString()}`);
    console.log('');
    console.log('======================================');
    console.log('');

    // Join TRTC room
    await joinRoom(roomConfig);
    await startScreenCapture();

    // Connect to Cloud WebSocket relay for voice command pipeline
    connectToCloudWs(session.roomId, pcUserId, session.hmacKey);

    console.log('[Agent] Waiting for mobile connection and voice commands...');
    console.log('[Agent] Press Ctrl+C to stop');

    // Keep process alive
    await new Promise(() => {
      // Process stays alive until Ctrl+C
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Agent] Failed to start: ${message}`);
    console.log('[Agent] Make sure the Cloud server is running (pnpm dev:cloud)');
    process.exit(1);
  }
}

/**
 * Local dev mode — WebSocket relay only, no TRTC.
 * Useful for testing the intent pipeline without live TRTC credentials.
 */
async function runLocal(): Promise<void> {
  const pcUserId = `pc_${hostname()}_local`;

  console.log('[Agent] Running in LOCAL dev mode (no TRTC)');
  console.log('[Agent] Connecting to Cloud API...');

  try {
    // Create session
    const { session } = await createSession(pcUserId);
    console.log(`[Agent] Session: ${session.sessionId}`);

    // Generate pairing code
    const pairing = await generatePairingCode(pcUserId);
    console.log('');
    console.log(`  Pairing Code: ${pairing.pairingCode}`);
    console.log('');

    // Connect to Cloud WebSocket relay (no TRTC room join)
    connectToCloudWs(session.roomId, pcUserId, session.hmacKey);

    // Support stdin for manual testing (only if TTY)
    if (process.stdin.isTTY) {
      console.log('[Agent] Type a command to test (or wait for mobile connection):');

      const readline = await import('node:readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      rl.on('line', (line: string) => {
        const utterance = line.trim();
        if (!utterance) return;

        processUtterance(utterance, session.hmacKey).catch((err: unknown) => {
          console.error('[Agent] Error:', err);
        });
      });

      rl.on('close', () => {
        process.exit(0);
      });
    } else {
      console.log('[Agent] Waiting for commands via WebSocket relay...');
      console.log('[Agent] Press Ctrl+C to stop');

      // Keep process alive
      await new Promise(() => {
        // Process stays alive until Ctrl+C
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Agent] Failed to start local mode: ${message}`);
    process.exit(1);
  }
}

/**
 * Demo mode — tests command execution without TRTC.
 */
async function runDemo(): Promise<void> {
  console.log('[Agent] Running in demo mode...\n');

  // Simulate joining a room
  await joinRoom({
    sdkAppId: 0,
    roomId: 'demo_room',
    userId: 'demo_pc',
    userSig: 'demo_sig',
  });

  await startScreenCapture();

  // Test: shell command (allowed)
  console.log('\n--- Test 1: Allowed shell command ---');
  simulateIncomingCommand({
    commandId: 'demo_1',
    intentType: 'shell.exec',
    executor: 'shell',
    instruction: 'echo "Hello from DeskPilot!"',
    parameters: {},
    timestamp: Date.now(),
    signature: 'demo',
  });

  // Give it time to execute
  await sleep(1000);

  // Test: blocked command (sudo)
  console.log('\n--- Test 2: Blocked command ---');
  simulateIncomingCommand({
    commandId: 'demo_2',
    intentType: 'shell.exec',
    executor: 'shell',
    instruction: 'sudo rm -rf /',
    parameters: {},
    timestamp: Date.now(),
    signature: 'demo',
  });

  await sleep(1000);

  // Test: destructive command (needs confirmation)
  console.log('\n--- Test 3: Destructive command (needs confirmation) ---');
  simulateIncomingCommand({
    commandId: 'demo_3',
    intentType: 'shell.exec',
    executor: 'shell',
    instruction: 'rm some-file.txt',
    parameters: {},
    timestamp: Date.now(),
    signature: 'demo',
  });

  await sleep(1000);

  // Test: system status
  console.log('\n--- Test 4: System status ---');
  simulateIncomingCommand({
    commandId: 'demo_4',
    intentType: 'system.status',
    executor: 'shell',
    instruction: 'pwd && ls -la',
    parameters: {},
    timestamp: Date.now(),
    signature: 'demo',
  });

  await sleep(2000);
  console.log('\n[Agent] Demo complete.');
}

/**
 * Interactive intent classification demo.
 * Tests the full pipeline: utterance → classify → command → execute.
 */
async function runClassifyDemo(): Promise<void> {
  console.log('[Agent] Intent classification demo\n');

  await joinRoom({ sdkAppId: 0, roomId: 'demo', userId: 'demo_pc', userSig: 'demo' });

  const testUtterances = [
    'Install express with npm',
    'Create a React login component',
    'What is running on port 3000',
    'Open localhost:8080 in the browser',
    'Yes, go ahead',
    'Fix the bug in app.ts line 42',
  ];

  for (const utterance of testUtterances) {
    console.log(`\n${'='.repeat(60)}`);
    const result = await processUtterance(utterance, 'demo_hmac_key');
    if (result) {
      console.log(`[Result] success=${String(result.success)} output=${result.output.slice(0, 100)}`);
    }
    await sleep(500);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('[Agent] Classification demo complete.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  console.error('[Agent] Fatal error:', error);
  process.exit(1);
});
