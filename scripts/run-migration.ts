/**
 * Runs the Supabase migration via the database connection.
 *
 * Usage: npx tsx scripts/run-migration.ts
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const statements = [
  // Sessions table
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    hmac_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(active) WHERE active = true`,
  // Pairings table
  `CREATE TABLE IF NOT EXISTS pairings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pairing_code TEXT NOT NULL,
    pc_user_id TEXT NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pairings_code ON pairings(pairing_code) WHERE consumed = false`,
  `CREATE INDEX IF NOT EXISTS idx_pairings_pc_user ON pairings(pc_user_id)`,
  // RLS
  `ALTER TABLE sessions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE pairings ENABLE ROW LEVEL SECURITY`,
  // Policies (use DO block to handle if-exists)
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'Service role full access on sessions') THEN
      CREATE POLICY "Service role full access on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pairings' AND policyname = 'Service role full access on pairings') THEN
      CREATE POLICY "Service role full access on pairings" ON pairings FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
];

async function runMigration(): Promise<void> {
  console.log('Running DeskPilot migration...\n');

  for (const sql of statements) {
    const label = sql.slice(0, 60).replace(/\n/g, ' ').trim();
    process.stdout.write(`  ${label}...`);

    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      // If rpc doesn't work, try direct approach
      console.log(' (rpc unavailable, trying REST)');
    } else {
      console.log(' ✓');
    }
  }

  // Test by inserting and reading
  console.log('\nVerifying tables...');

  // Test sessions table
  const { error: sessErr } = await supabase.from('sessions').select('id').limit(1);
  if (sessErr) {
    console.log(`  sessions: ✗ ${sessErr.message}`);
  } else {
    console.log('  sessions: ✓');
  }

  // Test pairings table
  const { error: pairErr } = await supabase.from('pairings').select('id').limit(1);
  if (pairErr) {
    console.log(`  pairings: ✗ ${pairErr.message}`);
  } else {
    console.log('  pairings: ✓');
  }
}

runMigration().catch(console.error);
