/**
 * Session management API routes.
 *
 * POST /api/sessions         — Create a new session
 * GET  /api/sessions/:id     — Get session details
 * POST /api/sessions/:id/end — End a session
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { createSession, getSession, endSession, generateRoomConfig, registerDevice } from '../services/room-service.js';

export const sessionRouter = Router();

const createSessionSchema = z.object({
  userId: z.string().min(1),
});

/** POST /api/sessions — Create a new session with TRTC room */
sessionRouter.post('/', async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }

  try {
    const session = await createSession(parsed.data.userId);
    const roomConfig = generateRoomConfig(session.roomId, parsed.data.userId);
    res.status(201).json({ session, roomConfig });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** GET /api/sessions/:id — Get session details */
sessionRouter.get('/:id', async (req, res) => {
  const session = await getSession(req.params['id'] ?? '');
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ session });
});

/** POST /api/sessions/register-device — Register a persistent PC device */
sessionRouter.post('/register-device', async (req, res) => {
  const schema = z.object({
    pcId: z.string().min(1),
    displayName: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  try {
    const device = await registerDevice(parsed.data.pcId, parsed.data.displayName);
    const roomConfig = generateRoomConfig(device.roomId, parsed.data.pcId);
    res.status(200).json({
      pcId: parsed.data.pcId,
      pairingCode: device.pairingCode,
      roomId: device.roomId,
      hmacKey: device.hmacKey,
      roomConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/sessions/:id/end — End a session */
sessionRouter.post('/:id/end', async (req, res) => {
  const ended = await endSession(req.params['id'] ?? '');
  if (!ended) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ message: 'Session ended' });
});
