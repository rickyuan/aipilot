/**
 * Environment configuration with validation.
 */

import { z } from 'zod/v4';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // TRTC
  TRTC_SDK_APP_ID: z.coerce.number(),
  TRTC_SECRET_KEY: z.string().min(1),

  // Supabase
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // Optional
  PORT: z.coerce.number().default(3000),
  DESKPILOT_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DESKPILOT_MAX_SESSION_MINUTES: z.coerce.number().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.issues, null, 2));
  process.exit(1);
}

/** Validated environment configuration */
export const config = parsed.data;
