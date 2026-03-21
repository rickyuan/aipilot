/**
 * TRTC room management API routes.
 *
 * POST   /api/rooms           — Provision a new TRTC room
 * GET    /api/rooms/:id/config — Get room config for a user
 * POST   /api/rooms/:id/bot   — Create AI bot for the room
 * DELETE /api/rooms/:id/bot   — Destroy AI bot
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { generateRoomConfig } from '../services/room-service.js';
import { createBot, destroyBot, hasBotInRoom } from '../services/bot-service.js';

export const roomRouter = Router();

const roomConfigSchema = z.object({
  userId: z.string().min(1),
});

/** GET /api/rooms/:id/config — Get TRTC room config for a user to join */
roomRouter.get('/:id/config', (req, res) => {
  const userId = req.query['userId'];
  if (typeof userId !== 'string' || !userId) {
    res.status(400).json({ error: 'userId query parameter is required' });
    return;
  }

  const roomConfig = generateRoomConfig(req.params['id'] ?? '', userId);
  res.json({ roomConfig });
});

/** POST /api/rooms/:id/bot — Create an AI bot in the room */
roomRouter.post('/:id/bot', async (req, res) => {
  const roomId = req.params['id'] ?? '';

  if (hasBotInRoom(roomId)) {
    res.status(409).json({ error: 'Bot already exists in this room' });
    return;
  }

  try {
    const { botConfig, taskId } = await createBot(roomId);
    res.status(201).json({ botConfig, taskId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Cloud] Failed to create bot for room ${roomId}:`, error);
    res.status(500).json({ error: 'Failed to create bot', detail: message });
  }
});

/** DELETE /api/rooms/:id/bot — Destroy the AI bot in the room */
roomRouter.delete('/:id/bot', async (req, res) => {
  const roomId = req.params['id'] ?? '';

  try {
    const destroyed = await destroyBot(roomId);
    if (!destroyed) {
      res.status(404).json({ error: 'No bot found in this room' });
      return;
    }
    res.json({ message: 'Bot destroyed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Cloud] Failed to destroy bot for room ${roomId}:`, error);
    res.status(500).json({ error: 'Failed to destroy bot', detail: message });
  }
});
