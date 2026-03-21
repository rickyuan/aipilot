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
