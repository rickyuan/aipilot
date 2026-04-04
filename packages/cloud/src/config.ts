/**
 * Environment configuration with validation.
 */

import { resolve } from 'node:path';
import { z } from 'zod/v4';
import dotenv from 'dotenv';

// Load .env from project root (may run from packages/cloud via turbo)
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  // TRTC (for UserSig generation)
  TRTC_SDK_APP_ID: z.coerce.number(),
  TRTC_SECRET_KEY: z.string().min(1),

  // Tencent Cloud API credentials (for TRTC REST API calls)
  // Falls back to TRTC_SECRET_KEY if not provided
  TENCENT_SECRET_ID: z.string().min(1).optional(),
  TENCENT_SECRET_KEY: z.string().min(1).optional(),

  // Supabase
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // ElevenLabs TTS
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_VOICE_ID: z.string().min(1).optional(),

  // Groq LLM (for intent classification)
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_API_URL: z.string().optional(),
  GROQ_MODEL: z.string().optional(),

  // Optional
  PORT: z.coerce.number().default(3000),
  DESKPILOT_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DESKPILOT_MAX_SESSION_MINUTES: z.coerce.number().default(30),
  DESKPILOT_PUBLIC_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.issues, null, 2));
  process.exit(1);
}

/** Validated environment configuration */
export const config = parsed.data;
