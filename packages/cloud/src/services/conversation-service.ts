/**
 * Conversation history service — stores and retrieves multi-turn context.
 *
 * Each "round" represents one voice utterance → intent → execution → response cycle.
 * The LLM uses recent rounds to understand context (e.g. "fix those" refers to
 * the lint errors from the previous round).
 */

import { getSupabase } from '../db/supabase.js';

/** A single conversation round */
export interface ConversationRound {
  roundId: string;
  userUtterance: string;
  intentType: string;
  instruction: string;
  executorOutput: string;
  botResponse: string;
  createdAt: string;
}

/**
 * Saves a new conversation round.
 * @param sessionId - The session this round belongs to
 * @param round - The round data
 */
export async function saveRound(
  sessionId: string,
  round: Omit<ConversationRound, 'createdAt'>,
): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('conversation_rounds').insert({
    session_id: sessionId,
    round_id: round.roundId,
    user_utterance: round.userUtterance,
    intent_type: round.intentType,
    instruction: round.instruction,
    executor_output: round.executorOutput,
    bot_response: round.botResponse,
  });

  if (error) {
    console.error(`[Conversation] Failed to save round: ${error.message}`);
  }
}

/**
 * Updates the executor output for an existing round (when PC Agent returns results).
 * @param sessionId - The session ID
 * @param roundId - The round to update
 * @param executorOutput - The execution result text
 */
export async function updateRoundOutput(
  sessionId: string,
  roundId: string,
  executorOutput: string,
): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from('conversation_rounds')
    .update({ executor_output: executorOutput })
    .eq('session_id', sessionId)
    .eq('round_id', roundId);

  if (error) {
    console.error(`[Conversation] Failed to update round output: ${error.message}`);
  }
}

/**
 * Retrieves the most recent conversation rounds for a session.
 * @param sessionId - The session ID
 * @param limit - Max rounds to return (default 5)
 * @returns Recent rounds, oldest first
 */
export async function getRecentRounds(
  sessionId: string,
  limit = 5,
): Promise<ConversationRound[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('conversation_rounds')
    .select('round_id, user_utterance, intent_type, instruction, executor_output, bot_response, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[Conversation] Failed to get rounds: ${error.message}`);
    return [];
  }

  type RoundRow = {
    round_id: string;
    user_utterance: string;
    intent_type: string;
    instruction: string;
    executor_output: string;
    bot_response: string;
    created_at: string;
  };

  return ((data ?? []) as unknown as RoundRow[])
    .reverse()
    .map((row) => ({
      roundId: row.round_id,
      userUtterance: row.user_utterance,
      intentType: row.intent_type,
      instruction: row.instruction,
      executorOutput: row.executor_output,
      botResponse: row.bot_response,
      createdAt: row.created_at,
    }));
}

/**
 * Clears all conversation rounds for a session.
 * @param sessionId - The session to clear
 */
export async function clearSession(sessionId: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from('conversation_rounds')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error(`[Conversation] Failed to clear session: ${error.message}`);
  }
}
