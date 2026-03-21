/**
 * DeskPilot Cloud Orchestrator — Express entry point.
 *
 * Manages room provisioning, device pairing, session auth,
 * and TRTC Conversational AI bot lifecycle.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { sessionRouter } from './routes/sessions.js';
import { pairingRouter } from './routes/pairing.js';
import { roomRouter } from './routes/rooms.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'deskpilot-cloud' });
});

// API routes
app.use('/api/sessions', sessionRouter);
app.use('/api/pairing', pairingRouter);
app.use('/api/rooms', roomRouter);

// Start server
app.listen(config.PORT, () => {
  console.log(`[Cloud] DeskPilot Cloud Orchestrator listening on port ${String(config.PORT)}`);
  console.log(`[Cloud] TRTC SDKAppID: ${String(config.TRTC_SDK_APP_ID)}`);
  console.log(`[Cloud] Log level: ${config.DESKPILOT_LOG_LEVEL}`);
});

export { app };
