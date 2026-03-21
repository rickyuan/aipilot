/**
 * Session management API routes.
 *
 * POST /api/sessions         — Create a new session
 * GET  /api/sessions/:id     — Get session details
 * POST /api/sessions/:id/end — End a session
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { createSession, getSession, endSession, generateRoomConfig } from '../services/room-service.js';

export const sessionRouter = Router();

const createSessionSchema = z.object({
  userId: z.string().min(1),
});

/** POST /api/sessions — Create a new session with TRTC room */
sessionRouter.post('/', (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }

  const session = createSession(parsed.data.userId);
  const roomConfig = generateRoomConfig(session.roomId, parsed.data.userId);

  res.status(201).json({
    session,
    roomConfig,
  });
});

/** GET /api/sessions/:id — Get session details */
sessionRouter.get('/:id', (req, res) => {
  const session = getSession(req.params['id'] ?? '');
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ session });
});

/** POST /api/sessions/:id/end — End a session */
sessionRouter.post('/:id/end', (req, res) => {
  const ended = endSession(req.params['id'] ?? '');
  if (!ended) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ message: 'Session ended' });
});
