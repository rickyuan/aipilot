/**
 * Device pairing API routes.
 *
 * POST /api/pairing/generate — Generate a 6-digit pairing code (PC side)
 * POST /api/pairing/verify   — Verify a pairing code (Mobile side)
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { generatePairingCode, verifyPairingCode } from '../services/pairing-service.js';
import { generateRoomConfig } from '../services/room-service.js';
import { createBot, hasBotInRoom } from '../services/bot-service.js';

export const pairingRouter = Router();

const generateSchema = z.object({
  pcUserId: z.string().min(1),
});

const verifySchema = z.object({
  pairingCode: z.string().length(6),
  mobileUserId: z.string().min(1),
});

/** POST /api/pairing/generate — PC requests a pairing code */
pairingRouter.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }

  try {
    const pairing = await generatePairingCode(parsed.data.pcUserId);
    res.status(201).json({ pairingCode: pairing.pairingCode, expiresAt: pairing.expiresAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/** POST /api/pairing/verify — Mobile verifies a pairing code */
pairingRouter.post('/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }

  try {
    const pairing = await verifyPairingCode(parsed.data.pairingCode);
    if (!pairing) {
      res.status(400).json({ error: 'Invalid or expired pairing code' });
      return;
    }

    const roomId = `dp_${pairing.pcUserId}_paired`;
    const mobileRoomConfig = generateRoomConfig(roomId, parsed.data.mobileUserId);
    const pcRoomConfig = generateRoomConfig(roomId, pairing.pcUserId);

    // Auto-create AI bot in the room on successful pairing
    if (!hasBotInRoom(roomId)) {
      try {
        await createBot(roomId);
        console.log(`[Cloud] Bot auto-created for room ${roomId} after pairing`);
      } catch (botErr: unknown) {
        // Bot creation failure shouldn't block pairing
        const botMsg = botErr instanceof Error ? botErr.message : 'Unknown';
        console.warn(`[Cloud] Bot creation failed for room ${roomId}: ${botMsg}`);
      }
    }

    res.json({
      message: 'Pairing successful',
      roomId,
      pcUserId: pairing.pcUserId,
      mobileRoomConfig,
      pcRoomConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
