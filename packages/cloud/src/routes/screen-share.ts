/**
 * Screen share control API routes.
 *
 * Mobile requests screen share start/stop → Cloud relays to PC Agent via WebSocket.
 *
 * POST /api/screen-share/:roomId/start — Mobile requests PC to start screen sharing
 * POST /api/screen-share/:roomId/stop  — Mobile requests PC to stop screen sharing
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { sendScreenShareRequest, sendScreenShareStop } from '../ws/relay.js';
import { botSpeak } from '../services/bot-service.js';

export const screenShareRouter = Router();

const bodySchema = z.object({
  mobileUserId: z.string().min(1),
});

/** POST /api/screen-share/:roomId/speak — Make bot speak (test) */
screenShareRouter.post('/:roomId/speak', async (req, res) => {
  const { roomId } = req.params;
  const text = (req.body as Record<string, string>)['text'] ?? 'Hello from DeskPilot';
  const success = await botSpeak(roomId, text);
  res.json({ success, roomId, text });
});

/** POST /api/screen-share/:roomId/start — Request screen sharing */
screenShareRouter.post('/:roomId/start', (req, res) => {
  const { roomId } = req.params;
  const parsed = bodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  console.log(`[ScreenShare] Start requested for room ${roomId} by ${parsed.data.mobileUserId}`);
  sendScreenShareRequest(roomId, parsed.data.mobileUserId);

  res.json({ message: 'Screen share requested', roomId });
});

/** POST /api/screen-share/:roomId/stop — Stop screen sharing */
screenShareRouter.post('/:roomId/stop', (req, res) => {
  const { roomId } = req.params;
  const parsed = bodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  console.log(`[ScreenShare] Stop requested for room ${roomId} by ${parsed.data.mobileUserId}`);
  sendScreenShareStop(roomId, parsed.data.mobileUserId);

  res.json({ message: 'Screen share stopped', roomId });
});
