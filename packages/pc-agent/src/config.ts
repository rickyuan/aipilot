/**
 * PC Agent environment configuration.
 */

import { resolve } from 'node:path';
import { z } from 'zod/v4';
import dotenv from 'dotenv';

// Load .env from project root (may run from packages/pc-agent via turbo)
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  // Cloud orchestrator URL
  DESKPILOT_CLOUD_URL: z.url().default('http://localhost:3000'),

  // Optional
  DESKPILOT_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DESKPILOT_AUDIT_DIR: z.string().default('~/.deskpilot'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.issues, null, 2));
  process.exit(1);
}

export const config = parsed.data;
