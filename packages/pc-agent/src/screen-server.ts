/**
 * Local HTTP server for the screen share web page.
 *
 * Serves the static screen-share.html and provides API endpoints
 * for the page to fetch room config and regenerate pairing codes.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import type { TRTCRoomConfig } from '@deskpilot/shared';
import { generatePairingCode } from './cloud-client.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

let currentConfig: { roomConfig: TRTCRoomConfig; pairingCode?: string } | null = null;
let currentPcUserId = '';

/**
 * Updates the room config that the screen share page will fetch.
 * @param roomConfig - TRTC room config for screen share
 * @param pairingCode - Optional pairing code to display
 */
export function setScreenShareConfig(roomConfig: TRTCRoomConfig, pairingCode?: string): void {
  currentConfig = { roomConfig, pairingCode };
}

/**
 * Sets the PC user ID for pairing code regeneration.
 * @param pcUserId - The PC Agent's user ID
 */
export function setPcUserId(pcUserId: string): void {
  currentPcUserId = pcUserId;
}

/**
 * Starts the local HTTP server for the screen share page.
 * @param port - Port to listen on (default: 8089)
 * @returns The server instance
 */
export function startScreenServer(port = 8089): ReturnType<typeof createServer> {
  const staticDir = resolve(__dirname, '..', 'static');

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${String(port)}`);

    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API: return current room config
    if (url.pathname === '/api/screen-config') {
      if (!currentConfig) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Room config not ready yet' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(currentConfig));
      return;
    }

    // API: regenerate pairing code
    if (url.pathname === '/api/regenerate-pairing' && req.method === 'POST') {
      if (!currentPcUserId) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PC user ID not set' }));
        return;
      }

      try {
        const pairing = await generatePairingCode(currentPcUserId);
        // Update the stored config with new pairing code
        if (currentConfig) {
          currentConfig.pairingCode = pairing.pairingCode;
        }
        console.log(`[ScreenServer] New pairing code: ${pairing.pairingCode}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ pairingCode: pairing.pairingCode, expiresAt: pairing.expiresAt }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    // Serve trtc-sdk-v5 from node_modules
    if (url.pathname === '/trtc.js') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sdkPath: string = require.resolve('trtc-sdk-v5/trtc.js');
        const content = await readFile(sdkPath);
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('TRTC SDK not found — run pnpm install');
      }
      return;
    }

    // Serve static files
    const filePath = url.pathname === '/' ? '/screen-share.html' : url.pathname;
    const fullPath = resolve(staticDir, `.${filePath}`);

    // Prevent directory traversal
    if (!fullPath.startsWith(staticDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const content = await readFile(fullPath);
      const ext = extname(fullPath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      try {
        const fallback = await readFile(resolve(staticDir, 'screen-share.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallback);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  });

  server.listen(port, () => {
    console.log(`[ScreenServer] Screen share page: http://localhost:${String(port)}`);
  });

  return server;
}
