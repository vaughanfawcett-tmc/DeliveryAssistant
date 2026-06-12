/**
 * calls-repo.ts — injectable factory for all calls table queries.
 *
 * Follows the createLookupLogRepo pattern (lookup-log.ts) exactly:
 * - Injectable SupabaseLike client for unit testing with fake clients
 * - JS-level aggregation (no Supabase RPC) for metrics
 * - Lazy default-repo singleton that dynamically imports the real Supabase client
 *
 * Security: PII masking at the repository boundary (T-03-07).
 * maskPhone() is applied inside listCustomerCalls so from_number NEVER
 * appears on any CallSummary returned to the caller.
 */

// The supabase singleton is imported dynamically in getDefaultRepo() to avoid
// eagerly evaluating env validation when this module is imported in tests.
import type { CallRow } from '../../types/database';
import type { CallMetrics, CallSummary, CallListOptions } from '../admin/types';
import { maskPhone } from '../admin/mask';

// ---------------------------------------------------------------------------
// Internal: extended injectable Supabase-like query builder type
// ---------------------------------------------------------------------------

type SingleResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type QueryResult<T> = Promise<{ data: T[] | null; error: { message: string } | null }>;

interface SelectBuilder<T = unknown> {
  eq(column: string, value: unknown): SelectBuilder<T>;
  gte(column: string, value: string): SelectBuilder<T>;
  lte(column: string, value: string): SelectBuilder<T>;
  ilike(column: string, pattern: string): SelectBuilder<T>;
  order(column: string): SelectBuilder<T>;
  range(from: number, to: number): SelectBuilder<T>;
  single(): SingleResult<T>;
  then<U>(resolve: (v: { data: T[] | null; error: { message: string } | null }) => U): Promise<U>;
}

interface FromBuilder {
  select(cols?: string): SelectBuilder;
  insert(row: object | object[]): Promise<{ data: unknown; error: { message: string } | null }>;
  update(patch: object): UpdateBuilder;
  delete(): UpdateBuilder;
}

interface UpdateBuilder {
  eq(column: string, value: unknown): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface SupabaseLike {
  from(table: string): FromBuilder;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCallsRepo(client: SupabaseLike) {
  /**
   * Aggregate call metrics for inbound customer calls since the given date.
   * Aggregation is performed in JS (same pattern as lookup-log.ts countByOutcome).
   */
  async function getMetrics(since: Date): Promise<CallMetrics> {
    const { data, error } = await (client
      .from('calls')
      .select('outcome,end_at,call_type,direction,start_at')
      .eq('call_type', 'customer')
      .eq('direction', 'inbound')
      .gte('start_at', since.toISOString()) as unknown as QueryResult<{
        outcome: string | null;
        end_at: string | null;
      }>);

    if (error || !data) return { received: 0, answered: 0, missed: 0, successRate: 0 };

    const rows = (data ?? []) as Array<{ outcome: string | null; end_at: string | null }>;
    const received = rows.length;
    const answered = rows.filter((r) => r.outcome !== null && r.outcome !== 'no_data').length;
    const resolved = rows.filter((r) => r.outcome === 'resolved').length;
    const missed = received - answered;
    const successRate = answered > 0 ? Math.round((resolved / answered) * 100) : 0;

    return { received, answered, missed, successRate };
  }

  /**
   * List inbound customer calls with optional filters and pagination.
   * Returns CallSummary[] — from_number_masked via maskPhone, never raw from_number.
   */
  async function listCustomerCalls(
    opts: CallListOptions,
  ): Promise<{ rows: CallSummary[]; total: number }> {
    const { since, until, outcome, search, page = 1, pageSize = 25 } = opts;

    let query = client
      .from('calls')
      .select('*')
      .eq('call_type', 'customer')
      .eq('direction', 'inbound') as SelectBuilder<CallRow>;

    if (since) query = query.gte('start_at', since.toISOString());
    if (until) query = query.lte('start_at', until.toISOString());
    if (outcome) query = query.eq('outcome', outcome);
    if (search) query = query.ilike('tracking_ref', `%${search}%`);

    query = query.order('start_at');

    // Fetch all matching rows first to get the total count
    const { data: allData, error } = await (query as unknown as QueryResult<CallRow>);

    if (error || !allData) return { rows: [], total: 0 };

    const total = allData.length;

    // Apply pagination slice
    const from = (page - 1) * pageSize;
    const to = page * pageSize;
    const paged = allData.slice(from, to);

    const rows: CallSummary[] = paged.map((row) => ({
      id: row.id,
      start_at: row.start_at,
      duration_ms: row.duration_ms,
      tracking_ref: row.tracking_ref,
      outcome: row.outcome,
      from_number_masked: maskPhone(row.from_number ?? null),
    }));

    return { rows, total };
  }

  /**
   * Fetch a single call row by its primary key.
   * Returns null when not found (never throws).
   */
  async function getCallById(id: string): Promise<CallRow | null> {
    const result = await (client
      .from('calls')
      .select('*')
      .eq('id', id)
      .single() as SingleResult<CallRow>);

    if (result.error || !result.data) return null;
    return result.data as CallRow;
  }

  /**
   * Fetch all driver-type calls linked to a customer call via parent_call_id.
   */
  async function getDriverCallsForParent(parentCallId: string): Promise<CallRow[]> {
    const { data, error } = await (client
      .from('calls')
      .select('*')
      .eq('call_type', 'driver')
      .eq('parent_call_id', parentCallId)
      .order('start_at') as unknown as QueryResult<CallRow>);

    if (error || !data) return [];
    return data as CallRow[];
  }

  return { getMetrics, listCustomerCalls, getCallById, getDriverCallsForParent };
}

// ---------------------------------------------------------------------------
// Default exports bound to the real server-side Supabase client (lazy init)
// ---------------------------------------------------------------------------

let _defaultRepo: ReturnType<typeof createCallsRepo> | null = null;

async function getDefaultRepo() {
  if (!_defaultRepo) {
    const { supabase } = await import('../supabase');
    _defaultRepo = createCallsRepo(supabase as unknown as SupabaseLike);
  }
  return _defaultRepo;
}

export async function getMetrics(since: Date): Promise<CallMetrics> {
  const repo = await getDefaultRepo();
  return repo.getMetrics(since);
}

export async function listCustomerCalls(
  opts: CallListOptions,
): Promise<{ rows: CallSummary[]; total: number }> {
  const repo = await getDefaultRepo();
  return repo.listCustomerCalls(opts);
}

export async function getCallById(id: string): Promise<CallRow | null> {
  const repo = await getDefaultRepo();
  return repo.getCallById(id);
}

export async function getDriverCallsForParent(parentCallId: string): Promise<CallRow[]> {
  const repo = await getDefaultRepo();
  return repo.getDriverCallsForParent(parentCallId);
}
