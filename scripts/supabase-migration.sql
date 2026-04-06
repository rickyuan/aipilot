-- DeskPilot database migration
-- Run this in the Supabase SQL Editor

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  hmac_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_active ON sessions(active) WHERE active = true;

-- Pairings table
CREATE TABLE IF NOT EXISTS pairings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pairing_code TEXT NOT NULL,
  pc_user_id TEXT NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_pairings_code ON pairings(pairing_code) WHERE consumed = false;
CREATE INDEX idx_pairings_pc_user ON pairings(pc_user_id);

-- Conversation history table (for multi-turn context)
CREATE TABLE IF NOT EXISTS conversation_rounds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL,
  user_utterance TEXT NOT NULL DEFAULT '',
  intent_type TEXT NOT NULL DEFAULT '',
  instruction TEXT NOT NULL DEFAULT '',
  executor_output TEXT NOT NULL DEFAULT '',
  bot_response TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_session ON conversation_rounds(session_id, created_at DESC);
CREATE INDEX idx_conversation_round ON conversation_rounds(session_id, round_id);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Cloud Orchestrator uses service key)
CREATE POLICY "Service role full access on sessions"
  ON sessions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on pairings"
  ON pairings FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE conversation_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on conversation_rounds"
  ON conversation_rounds FOR ALL
  USING (true)
  WITH CHECK (true);
