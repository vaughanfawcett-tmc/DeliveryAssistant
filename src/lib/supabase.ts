// SERVER ONLY — never import into a client component; service role bypasses RLS.
// Driver phone numbers and lookup logs are personal data; all DB access goes through this module.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { env } from './env';

/**
 * Singleton server-side Supabase client using the SERVICE_ROLE key.
 * Must never be imported in client-side code.
 */
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);
