/**
 * Supabase database type definitions.
 *
 * These types match the tables created by the migration script.
 */

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          user_id: string;
          room_id: string;
          active: boolean;
          hmac_key: string;
          created_at: string;
          last_activity_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          room_id: string;
          active?: boolean;
          hmac_key: string;
          last_activity_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          room_id?: string;
          active?: boolean;
          hmac_key?: string;
          last_activity_at?: string;
        };
        Relationships: [];
      };
      pc_devices: {
        Row: {
          pc_id: string;
          pairing_code: string;
          room_id: string;
          display_name: string;
          hmac_key: string;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          pc_id: string;
          pairing_code: string;
          room_id: string;
          display_name?: string;
          hmac_key: string;
        };
        Update: {
          last_seen_at?: string;
          display_name?: string;
        };
        Relationships: [];
      };
      conversation_rounds: {
        Row: {
          id: number;
          session_id: string;
          round_id: string;
          user_utterance: string;
          intent_type: string;
          instruction: string;
          executor_output: string;
          bot_response: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          round_id: string;
          user_utterance: string;
          intent_type?: string;
          instruction?: string;
          executor_output?: string;
          bot_response?: string;
        };
        Update: {
          executor_output?: string;
          bot_response?: string;
        };
        Relationships: [];
      };
      pairings: {
        Row: {
          id: number;
          pairing_code: string;
          pc_user_id: string;
          consumed: boolean;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          pairing_code: string;
          pc_user_id: string;
          consumed?: boolean;
          expires_at: string;
        };
        Update: {
          pairing_code?: string;
          pc_user_id?: string;
          consumed?: boolean;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
