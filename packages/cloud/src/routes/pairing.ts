/**
 * Device pairing API routes.
 *
 * POST /api/pairing/generate — Generate a 6-digit pairing code (PC side)
 * POST /api/pairing/verify   — Verify a pairing code (Mobile side)
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { generatePairingCode, verifyPairingCode } from '../services/pairing-service.js';
import { generateRoomConfig, getActiveSessionByUserId } from '../services/room-service.js';
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
    console.log(`[Pairing] Verifying code: ${parsed.data.pairingCode} for mobile: ${parsed.data.mobileUserId}`);

    const pairing = await verifyPairingCode(parsed.data.pairingCode);
    if (!pairing) {
      console.log(`[Pairing] Code ${parsed.data.pairingCode} is invalid or expired`);
      res.status(400).json({ error: 'Invalid or expired pairing code' });
      return;
    }

    console.log(`[Pairing] Code valid, PC user: ${pairing.pcUserId}`);

    // Use the PC agent's existing session room so all participants share one TRTC room
    const activeSession = await getActiveSessionByUserId(pairing.pcUserId);
    const roomId = activeSession?.roomId ?? `dp_${pairing.pcUserId}_paired`;
    console.log(`[Pairing] Room: ${roomId} (from ${activeSession ? 'active session' : 'generated'})`);

    const mobileRoomConfig = generateRoomConfig(roomId, parsed.data.mobileUserId);
    const pcRoomConfig = generateRoomConfig(roomId, pairing.pcUserId);

    // Auto-create AI bot in the room on successful pairing, targeting mobile user
    if (!hasBotInRoom(roomId)) {
      try {
        const botResult = await createBot(roomId, parsed.data.mobileUserId);
        console.log(`[Pairing] Bot created for room ${roomId}, taskId: ${botResult.taskId}`);
      } catch (botErr: unknown) {
        const botMsg = botErr instanceof Error ? botErr.message : 'Unknown';
        console.error(`[Pairing] Bot creation FAILED for room ${roomId}: ${botMsg}`);
      }
    } else {
      console.log(`[Pairing] Bot already exists in room ${roomId}`);
    }

    console.log(`[Pairing] Success! Mobile config: sdkAppId=${String(mobileRoomConfig.sdkAppId)}, room=${mobileRoomConfig.roomId}, user=${mobileRoomConfig.userId}`);

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
