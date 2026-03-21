/**
 * DeskPilot PC Agent — Daemon entry point.
 *
 * Connects to TRTC room, publishes screen capture,
 * listens for command payloads from the AI bot, and executes them.
 */

import './config.js'; // Load env vars first
import type { CommandPayload } from '@deskpilot/shared';
import { joinRoom, startScreenCapture, onCommandReceived, sendCommandResult, simulateIncomingCommand } from './trtc/room.js';
import { routeCommand } from './executors/router.js';

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

  // In production: fetch room config from Cloud API and join
  // For now, wait for room config to be provided
  console.log('[Agent] Ready. Waiting for room configuration...');
  console.log('[Agent] Run with --demo to test command execution locally');
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  console.error('[Agent] Fatal error:', error);
  process.exit(1);
});
