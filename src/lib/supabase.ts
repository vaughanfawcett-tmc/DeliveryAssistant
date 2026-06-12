// SERVER ONLY — never import into a client component; service role bypasses RLS.
// Driver phone numbers and lookup logs are personal data; all DB access goes through this module.
// The `server-only` import makes the Next.js bundler throw at build time if this module
// is ever pulled into a client bundle, preventing the service-role key from leaking (T-01-09).
import 'server-only';

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
