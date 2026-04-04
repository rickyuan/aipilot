/**
 * DeskPilot Cloud Orchestrator — Express entry point.
 *
 * Manages room provisioning, device pairing, session auth,
 * TRTC Conversational AI bot lifecycle, and WebSocket relay.
 */

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { sessionRouter } from './routes/sessions.js';
import { pairingRouter } from './routes/pairing.js';
import { roomRouter } from './routes/rooms.js';
import { botCallbackRouter } from './routes/bot-callback.js';
import { cleanupTimedOutSessions } from './services/room-service.js';
import { cleanupExpiredPairings } from './services/pairing-service.js';
import { initWebSocketRelay } from './ws/relay.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'deskpilot-cloud' });
});

// Mobile web client (served before API routes)
app.use('/mobile', express.static(resolve(__dirname, '..', 'static'), { index: 'mobile.html' }));

// API routes
app.use('/api/sessions', sessionRouter);
app.use('/api/pairing', pairingRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/bot', botCallbackRouter);

// Initialize WebSocket relay
initWebSocketRelay(server);

// Start server
server.listen(config.PORT, () => {
  console.log(`[Cloud] DeskPilot Cloud Orchestrator listening on port ${String(config.PORT)}`);
  console.log(`[Cloud] TRTC SDKAppID: ${String(config.TRTC_SDK_APP_ID)}`);
  console.log(`[Cloud] WebSocket relay: ws://localhost:${String(config.PORT)}/ws/agent`);
  console.log(`[Cloud] Log level: ${config.DESKPILOT_LOG_LEVEL}`);

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    cleanupTimedOutSessions().catch(console.error);
    cleanupExpiredPairings().catch(console.error);
  }, 5 * 60 * 1000);
});

export { app };
