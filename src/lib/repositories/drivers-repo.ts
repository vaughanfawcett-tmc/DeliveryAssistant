/**
 * drivers-repo.ts — injectable CRUD factory for the drivers table.
 *
 * Follows the createLookupLogRepo pattern (lookup-log.ts) exactly.
 *
 * Error handling contract (T-03-09 — no silent data loss):
 * - Reads: warn + return empty array (logging must never break the UI)
 * - Mutations (insert/update/delete): throw on error so the caller surfaces failure
 *
 * The supabase singleton is imported dynamically in getDefaultRepo() so this
 * module is safely importable in tests without triggering env validation.
 */

import type { DriverRow } from '../../types/database';

// ---------------------------------------------------------------------------
// Internal: injectable Supabase-like type
// ---------------------------------------------------------------------------

interface SelectBuilder {
  eq(column: string, value: unknown): SelectBuilder;
  order(column: string): SelectBuilder;
  then<U>(
    resolve: (v: { data: DriverRow[] | null; error: { message: string } | null }) => U,
  ): Promise<U>;
}

interface UpdateBuilder {
  eq(
    column: string,
    value: unknown,
  ): Promise<{ data: DriverRow[] | null; error: { message: string } | null }>;
}

interface DeleteBuilder {
  eq(column: string, value: unknown): Promise<{ data: unknown; error: { message: string } | null }>;
}

interface FromBuilder {
  select(cols?: string): SelectBuilder;
  insert(row: object): Promise<{ data: DriverRow[] | null; error: { message: string } | null }>;
  update(patch: object): UpdateBuilder;
  delete(): DeleteBuilder;
}

export interface SupabaseLike {
  from(table: string): FromBuilder;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDriversRepo(client: SupabaseLike) {
  /**
   * List all drivers ordered by name.
   * If activeOnly=true, only active drivers are returned.
   * Warns + returns [] on read error (non-throwing for UI safety).
   */
  async function listDrivers(activeOnly?: boolean): Promise<DriverRow[]> {
    let query: SelectBuilder = client.from('drivers').select('*').order('name');
    if (activeOnly) query = query.eq('active', true);

    const { data, error } = await query;

    if (error) {
      console.warn('[drivers-repo] list failed:', error);
      return [];
    }
    return (data ?? []) as DriverRow[];
  }

  /**
   * Insert a new driver row.
   * Throws on error — driver data must save or surface failure to the user (T-03-09).
   */
  async function insertDriver(input: { name: string; phone_e164: string }): Promise<DriverRow> {
    const { data, error } = await client.from('drivers').insert(input);
    if (error) throw new Error(`[drivers-repo] insert failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('[drivers-repo] insert returned no row');
    return data[0] as DriverRow;
  }

  /**
   * Update a driver row by id.
   * Throws on error — mutations must not silently swallow failures (T-03-09).
   */
  async function updateDriver(
    id: string,
    patch: Partial<{ name: string; phone_e164: string; active: boolean }>,
  ): Promise<DriverRow> {
    const { data, error } = await client.from('drivers').update(patch).eq('id', id);
    if (error) throw new Error(`[drivers-repo] update failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error('[drivers-repo] update returned no row');
    return data[0] as DriverRow;
  }

  /**
   * Hard-delete a driver row by id (D-10: deactivate is soft via updateDriver active=false).
   * Throws on error — hard delete must succeed or surface failure (T-03-09).
   */
  async function deleteDriver(id: string): Promise<void> {
    const { error } = await client.from('drivers').delete().eq('id', id);
    if (error) throw new Error(`[drivers-repo] delete failed: ${error.message}`);
  }

  return { listDrivers, insertDriver, updateDriver, deleteDriver };
}

// ---------------------------------------------------------------------------
// Default exports bound to the real server-side Supabase client (lazy init)
// ---------------------------------------------------------------------------

let _defaultRepo: ReturnType<typeof createDriversRepo> | null = null;

async function getDefaultRepo() {
  if (!_defaultRepo) {
    const { supabase } = await import('../supabase');
    _defaultRepo = createDriversRepo(supabase as unknown as SupabaseLike);
  }
  return _defaultRepo;
}

export async function listDrivers(activeOnly?: boolean): Promise<DriverRow[]> {
  const repo = await getDefaultRepo();
  return repo.listDrivers(activeOnly);
}

export async function insertDriver(input: {
  name: string;
  phone_e164: string;
}): Promise<DriverRow> {
  const repo = await getDefaultRepo();
  return repo.insertDriver(input);
}

export async function updateDriver(
  id: string,
  patch: Partial<{ name: string; phone_e164: string; active: boolean }>,
): Promise<DriverRow> {
  const repo = await getDefaultRepo();
  return repo.updateDriver(id, patch);
}

export async function deleteDriver(id: string): Promise<void> {
  const repo = await getDefaultRepo();
  return repo.deleteDriver(id);
}
