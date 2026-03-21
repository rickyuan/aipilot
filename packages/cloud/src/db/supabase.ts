/**
 * Supabase client initialization.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { Database } from './types.js';

let client: SupabaseClient<Database> | null = null;

/**
 * Returns the Supabase client instance (singleton).
 * @returns Supabase client
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  }
  return client;
}
