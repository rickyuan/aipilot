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

export const pairingRouter = Router();

const generateSchema = z.object({
  pcUserId: z.string().min(1),
});

const verifySchema = z.object({
  pairingCode: z.string().length(6),
  mobileUserId: z.string().min(1),
});

/** POST /api/pairing/generate — PC requests a pairing code */
pairingRouter.post('/generate', (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }

  const pairing = generatePairingCode(parsed.data.pcUserId);
  res.status(201).json({ pairingCode: pairing.pairingCode, expiresAt: pairing.expiresAt });
});

/** POST /api/pairing/verify — Mobile verifies a pairing code */
pairingRouter.post('/verify', (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }

  const pairing = verifyPairingCode(parsed.data.pairingCode);
  if (!pairing) {
    res.status(400).json({ error: 'Invalid or expired pairing code' });
    return;
  }

  // Generate TRTC room config for the mobile device
  // The roomId will come from the session — for now use a deterministic one
  const roomId = `dp_${pairing.pcUserId}_paired`;
  const mobileRoomConfig = generateRoomConfig(roomId, parsed.data.mobileUserId);
  const pcRoomConfig = generateRoomConfig(roomId, pairing.pcUserId);

  res.json({
    message: 'Pairing successful',
    roomId,
    pcUserId: pairing.pcUserId,
    mobileRoomConfig,
    pcRoomConfig,
  });
});
