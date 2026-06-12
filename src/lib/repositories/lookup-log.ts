/**
 * lookup-log.ts — portal_lookups repository (API-07 instrumentation).
 *
 * Logs every tracking lookup outcome to the portal_lookups table so success
 * metrics can be derived from the database (Phase 1 success criterion 5).
 *
 * NEVER throws to the caller on insert failure — logging must never break a
 * customer lookup. Insert errors are warned and silently swallowed.
 *
 * The postcode stored here must already be normalised by the caller
 * (upper-case, no spaces). This module does not re-normalise.
 */

// supabase singleton is imported dynamically in getDefaultRepo() to avoid
// eagerly evaluating env validation when this module is imported in tests.
import type { Database } from '../../types/database';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LookupOutcome = 'found' | 'not_found' | 'postcode_mismatch' | 'api_error';

export interface LogLookupInput {
  trackingRef: string;
  /** Must be normalised (upper-case, no spaces) before passing here. */
  postcode: string;
  success: boolean;
  outcome: LookupOutcome;
}

// ---------------------------------------------------------------------------
// Internal: a minimal type for the injectable Supabase-like client
// ---------------------------------------------------------------------------

type InsertResult = { data: unknown; error: Error | null };
type SelectBuilder = {
  gte: (column: string, value: string) => Promise<{ data: unknown[] | null; error: Error | null }>;
};
type FromBuilder = {
  insert: (row: object) => Promise<InsertResult>;
  select: (cols?: string) => SelectBuilder;
};

export interface SupabaseLike {
  from: (table: string) => FromBuilder;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createLookupLogRepo(client: SupabaseLike) {
  /**
   * Write a single lookup outcome to portal_lookups.
   * Maps the four LookupOutcome values to the (success, failure_reason) columns.
   */
  async function logLookup(input: LogLookupInput): Promise<void> {
    const success = input.outcome === 'found';
    const failure_reason: string | null = input.outcome === 'found' ? null : input.outcome;

    const { error } = await client
      .from('portal_lookups')
      .insert({
        tracking_ref: input.trackingRef,
        postcode: input.postcode,
        success,
        failure_reason,
      });

    if (error) {
      console.warn('[lookup-log] Failed to insert lookup log:', error);
    }
  }

  /**
   * Count lookup outcomes since the given timestamp.
   * Aggregates in JS rather than SQL so it works against the fake client in
   * tests and avoids a Supabase RPC for a simple Phase-3 metrics query.
   *
   * All four outcome keys are always present, initialised to 0.
   */
  async function countByOutcome(since: Date): Promise<Record<LookupOutcome, number>> {
    const counts: Record<LookupOutcome, number> = {
      found: 0,
      not_found: 0,
      postcode_mismatch: 0,
      api_error: 0,
    };

    const { data, error } = await client
      .from('portal_lookups')
      .select('success,failure_reason,looked_up_at')
      .gte('looked_up_at', since.toISOString());

    if (error) {
      console.warn('[lookup-log] Failed to query lookup counts:', error);
      return counts;
    }

    const rows = (data ?? []) as Array<{
      success: boolean;
      failure_reason: string | null;
    }>;

    for (const row of rows) {
      if (row.success) {
        counts.found += 1;
      } else if (row.failure_reason === 'not_found') {
        counts.not_found += 1;
      } else if (row.failure_reason === 'postcode_mismatch') {
        counts.postcode_mismatch += 1;
      } else if (row.failure_reason === 'api_error') {
        counts.api_error += 1;
      }
    }

    return counts;
  }

  return { logLookup, countByOutcome };
}

// ---------------------------------------------------------------------------
// Default exports bound to the real server-side Supabase client (lazy init)
// The supabase singleton is accessed lazily so the module can be safely
// imported in test environments where env vars are not present — tests inject
// their own client via createLookupLogRepo and never call these exports.
// ---------------------------------------------------------------------------

let _defaultRepo: ReturnType<typeof createLookupLogRepo> | null = null;

async function getDefaultRepo() {
  if (!_defaultRepo) {
    const { supabase } = await import('../supabase');
    _defaultRepo = createLookupLogRepo(supabase as unknown as SupabaseLike);
  }
  return _defaultRepo;
}

export async function logLookup(input: LogLookupInput): Promise<void> {
  const repo = await getDefaultRepo();
  return repo.logLookup(input);
}

export async function countByOutcome(since: Date): Promise<Record<LookupOutcome, number>> {
  const repo = await getDefaultRepo();
  return repo.countByOutcome(since);
}
