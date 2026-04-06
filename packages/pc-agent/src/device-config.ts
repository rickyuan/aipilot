/**
 * Persistent device configuration.
 *
 * Stores PC identity in ~/.deskpilot/device.json.
 * Generated once on first launch, reused forever.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir, hostname } from 'node:os';
import { randomBytes } from 'node:crypto';

const CONFIG_DIR = resolve(homedir(), '.deskpilot');
const CONFIG_FILE = resolve(CONFIG_DIR, 'device.json');

export interface DeviceConfig {
  /** Unique PC device identifier (persists across restarts) */
  pcId: string;
  /** Fixed pairing code from Cloud (set after first registration) */
  pairingCode?: string;
  /** Persistent room ID from Cloud */
  roomId?: string;
  /** HMAC key for command signing */
  hmacKey?: string;
  /** Display name for this PC */
  displayName: string;
}

/**
 * Loads device config from disk, or creates a new one.
 * @returns The device configuration
 */
export async function loadDeviceConfig(): Promise<DeviceConfig> {
  if (existsSync(CONFIG_FILE)) {
    try {
      const raw = await readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(raw) as DeviceConfig;
      console.log(`[Device] Loaded config: ${config.pcId}`);
      return config;
    } catch {
      console.warn('[Device] Failed to read device.json, creating new');
    }
  }

  // Generate new device identity
  const pcId = `pc_${hostname()}_${randomBytes(4).toString('hex')}`;
  const config: DeviceConfig = {
    pcId,
    displayName: hostname(),
  };

  await saveDeviceConfig(config);
  console.log(`[Device] New device created: ${pcId}`);
  return config;
}

/**
 * Saves device config to disk.
 * @param config - The configuration to save
 */
export async function saveDeviceConfig(config: DeviceConfig): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}
