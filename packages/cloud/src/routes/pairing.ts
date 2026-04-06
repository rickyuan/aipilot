/**
 * Device pairing API routes.
 *
 * POST /api/pairing/generate — Generate a 6-digit pairing code (PC side)
 * POST /api/pairing/verify   — Verify a pairing code (Mobile side)
 */

import { Router } from 'express';
import { z } from 'zod/v4';
import { generatePairingCode, verifyPairingCode } from '../services/pairing-service.js';
import { generateRoomConfig, getActiveSessionByUserId, findDeviceByCode, registerDevice } from '../services/room-service.js';
import { createBot, destroyBot, hasBotInRoom } from '../services/bot-service.js';

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

    // First try persistent device code (new model)
    const device = await findDeviceByCode(parsed.data.pairingCode);

    // Fallback to legacy temporary pairing code
    const pairing = device ? null : await verifyPairingCode(parsed.data.pairingCode);

    if (!device && !pairing) {
      console.log(`[Pairing] Code ${parsed.data.pairingCode} is invalid or expired`);
      res.status(400).json({ error: 'Invalid or expired pairing code' });
      return;
    }

    const pcUserId = device?.pcId ?? pairing!.pcUserId;
    const roomId = device?.roomId ?? (await getActiveSessionByUserId(pairing!.pcUserId))?.roomId ?? `dp_${pairing!.pcUserId}_paired`;

    console.log(`[Pairing] Code valid, PC: ${pcUserId}, Room: ${roomId} (${device ? 'persistent device' : 'legacy pairing'})`);

    const mobileRoomConfig = generateRoomConfig(roomId, parsed.data.mobileUserId);
    const pcRoomConfig = generateRoomConfig(roomId, pcUserId);

    // Recreate AI bot targeting the current mobile user
    // (destroy old bot first if exists, since targetUserId may have changed)
    if (hasBotInRoom(roomId)) {
      try {
        await destroyBot(roomId);
        console.log(`[Pairing] Destroyed old bot in room ${roomId}`);
      } catch { /* ignore */ }
    }
    try {
      const botResult = await createBot(roomId, parsed.data.mobileUserId);
      console.log(`[Pairing] Bot created for room ${roomId}, target: ${parsed.data.mobileUserId}, taskId: ${botResult.taskId}`);
    } catch (botErr: unknown) {
      const botMsg = botErr instanceof Error ? botErr.message : 'Unknown';
      console.error(`[Pairing] Bot creation FAILED for room ${roomId}: ${botMsg}`);
    }

    console.log(`[Pairing] Success! Mobile config: sdkAppId=${String(mobileRoomConfig.sdkAppId)}, room=${mobileRoomConfig.roomId}, user=${mobileRoomConfig.userId}`);

    res.json({
      message: 'Pairing successful',
      roomId,
      pcUserId,
      pcDisplayName: device?.displayName ?? pcUserId,
      mobileRoomConfig,
      pcRoomConfig,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
