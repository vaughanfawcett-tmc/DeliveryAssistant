/**
 * Hand-written TypeScript row types for the Phase 1 schema.
 * Keep in sync with supabase/migrations/0001_init_foundation.sql.
 */

export interface PortalLookupRow {
  id: string;                         // uuid
  tracking_ref: string;
  postcode: string;                   // normalised (upper, no spaces)
  success: boolean;
  failure_reason: string | null;      // 'postcode_mismatch' | 'not_found' | 'api_error' | null
  looked_up_at: string;               // timestamptz as ISO string
}

export interface CallRow {
  id: string;                         // uuid
  platform_call_id: string;
  from_number: string | null;
  direction: 'inbound' | 'outbound';
  call_type: 'customer' | 'driver';
  start_at: string;                   // timestamptz as ISO string
  end_at: string | null;
  duration_ms: number | null;
  outcome: 'resolved' | 'escalated' | 'no_data' | 'failed' | null;
  tracking_ref: string | null;
  transcript: string | null;
  recording_url: string | null;         // D-08: provider recording URL; null in mock; 30-day retention
  disconnection_reason: string | null;
  parent_call_id: string | null;      // uuid references calls.id
  created_at: string;                 // timestamptz as ISO string
}

export interface DriverRow {
  id: string;                         // uuid
  name: string;
  phone_e164: string;
  active: boolean;
  created_at: string;                 // timestamptz as ISO string
  updated_at: string;                 // timestamptz as ISO string
}

/**
 * Supabase Database type for use with createClient<Database>.
 */
export interface Database {
  public: {
    Tables: {
      portal_lookups: {
        Row: PortalLookupRow;
        Insert: Omit<PortalLookupRow, 'id' | 'looked_up_at'> & {
          id?: string;
          looked_up_at?: string;
        };
        Update: Partial<Omit<PortalLookupRow, 'id'>>;
      };
      calls: {
        Row: CallRow;
        Insert: Omit<CallRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CallRow, 'id'>>;
      };
      drivers: {
        Row: DriverRow;
        Insert: Omit<DriverRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<DriverRow, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
