import { describe, it, expect } from 'vitest';
import { createCallsRepo } from './calls-repo';
import type { CallRow } from '../../types/database';

// ---------------------------------------------------------------------------
// In-memory fake Supabase query builder for calls-repo tests
// ---------------------------------------------------------------------------

/**
 * A chainable builder that accumulates filters and then resolves.
 * Supports: .select .eq .gte .lte .ilike .order .range .single
 *
 * When countMode=true (select('*', { count: 'exact', head: true })),
 * resolves with { count, data: null, error } instead of { data[], error }.
 */
function makeQueryBuilder(rows: Partial<CallRow>[], countMode = false) {
  let filtered = [...rows];
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;

  const builder: any = {
    eq(col: string, val: unknown) {
      filtered = filtered.filter((r: any) => r[col] === val);
      return builder;
    },
    gte(col: string, val: string) {
      filtered = filtered.filter((r: any) => (r[col] as string) >= val);
      return builder;
    },
    lte(col: string, val: string) {
      filtered = filtered.filter((r: any) => (r[col] as string) <= val);
      return builder;
    },
    ilike(col: string, pattern: string) {
      // pattern is '%VALUE%'
      const term = pattern.replace(/%/g, '').toLowerCase();
      filtered = filtered.filter((r: any) =>
        r[col] != null && String(r[col]).toLowerCase().includes(term),
      );
      return builder;
    },
    order(_col: string) {
      return builder;
    },
    range(from: number, to: number) {
      rangeStart = from;
      rangeEnd = to;
      return builder;
    },
    single() {
      return {
        then(resolve: (v: any) => void) {
          const result =
            filtered.length === 0
              ? { data: null, error: { message: 'No rows' } }
              : { data: filtered[0], error: null };
          return Promise.resolve(result).then(resolve);
        },
      };
    },
    // Promise resolution for normal (non-single) queries
    then(resolve: (v: any) => void) {
      if (countMode) {
        // count query — return total filtered rows, no data
        return Promise.resolve({ count: filtered.length, data: null, error: null }).then(resolve);
      }
      let data = filtered;
      if (rangeStart !== null && rangeEnd !== null) {
        data = filtered.slice(rangeStart, rangeEnd + 1);
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };

  return builder;
}

interface InsertedRow {
  [key: string]: unknown;
}

function makeFakeClient(seedRows: Partial<CallRow>[] = [], insertError: Error | null = null) {
  const _inserted: InsertedRow[] = [];

  return {
    from: (_table: string) => ({
      // select('*', { count: 'exact', head: true }) → countMode builder
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) =>
        makeQueryBuilder(seedRows, opts?.count === 'exact' && opts?.head === true),
      insert: (row: InsertedRow | InsertedRow[]) => {
        if (insertError) return Promise.resolve({ data: null, error: insertError });
        const rows = Array.isArray(row) ? row : [row];
        rows.forEach((r) => _inserted.push(r));
        return Promise.resolve({ data: rows, error: null });
      },
    }),
    _inserted,
  };
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const BASE_DATE = new Date('2026-05-01T00:00:00Z');
const SINCE_DATE = new Date('2026-04-01T00:00:00Z');

function makeCustomerCall(overrides: Partial<CallRow> = {}): CallRow {
  return {
    id: crypto.randomUUID(),
    platform_call_id: 'plat-001',
    from_number: '+447911123456',
    direction: 'inbound',
    call_type: 'customer',
    start_at: BASE_DATE.toISOString(),
    end_at: null,
    duration_ms: 60000,
    outcome: 'resolved',
    tracking_ref: null,
    transcript: null,
    recording_url: null,
    disconnection_reason: null,
    parent_call_id: null,
    created_at: BASE_DATE.toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getMetrics
// ---------------------------------------------------------------------------

describe('getMetrics', () => {
  it('derives received/answered/missed/successRate from inbound customer rows', async () => {
    // 4 rows: resolved, escalated, no_data, resolved
    const rows: CallRow[] = [
      makeCustomerCall({ outcome: 'resolved',  start_at: BASE_DATE.toISOString() }),
      makeCustomerCall({ outcome: 'escalated', start_at: BASE_DATE.toISOString() }),
      makeCustomerCall({ outcome: 'no_data',   start_at: BASE_DATE.toISOString() }),
      makeCustomerCall({ outcome: 'resolved',  start_at: BASE_DATE.toISOString() }),
    ];

    const fake = makeFakeClient(rows);
    const repo = createCallsRepo(fake as any);
    const metrics = await repo.getMetrics(SINCE_DATE);

    // received = 4, answered = 3 (outcome not null and not 'no_data'), missed = 1
    // successRate = 2 resolved / 3 answered * 100 = 67
    expect(metrics).toEqual({ received: 4, answered: 3, missed: 1, successRate: 67 });
  });

  it('excludes rows outside the window (start_at < since)', async () => {
    // The fake client filters by gte — rows before SINCE_DATE should not appear
    // because the builder filters them out. Here the fake returns all rows it
    // receives; we rely on the repo calling .gte('start_at', since.toISOString()).
    // This test verifies the repo passes the filter — the builder enforces it.
    const oldRow = makeCustomerCall({ start_at: '2020-01-01T00:00:00Z' });
    const recentRow = makeCustomerCall({ outcome: 'resolved', start_at: BASE_DATE.toISOString() });
    const rows = [oldRow, recentRow];
    const fake = makeFakeClient(rows);
    const repo = createCallsRepo(fake as any);
    const metrics = await repo.getMetrics(SINCE_DATE);

    // Only the recent row passes the gte filter
    expect(metrics.received).toBe(1);
  });

  it('returns all-zero metrics on error', async () => {
    // Client that returns an error
    const errorClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ data: null, error: new Error('DB error') }),
            }),
          }),
        }),
      }),
    };
    const repo = createCallsRepo(errorClient as any);
    const metrics = await repo.getMetrics(SINCE_DATE);
    expect(metrics).toEqual({ received: 0, answered: 0, missed: 0, successRate: 0 });
  });
});

// ---------------------------------------------------------------------------
// listCustomerCalls
// ---------------------------------------------------------------------------

describe('listCustomerCalls', () => {
  it('filters to resolved outcome and maps to CallSummary with from_number_masked', async () => {
    const rows: CallRow[] = [
      makeCustomerCall({ outcome: 'resolved',  tracking_ref: 'REF-001', from_number: '+447911123456' }),
      makeCustomerCall({ outcome: 'escalated', tracking_ref: 'REF-002', from_number: '+447911654321' }),
    ];

    const fake = makeFakeClient(rows);
    const repo = createCallsRepo(fake as any);
    const { rows: summaries, total } = await repo.listCustomerCalls({ outcome: 'resolved' });

    expect(summaries).toHaveLength(1);
    expect(summaries[0].outcome).toBe('resolved');
    // PII check: summary has from_number_masked, NOT raw from_number
    expect(summaries[0]).toHaveProperty('from_number_masked');
    expect(summaries[0]).not.toHaveProperty('from_number');
    expect(summaries[0].from_number_masked).toBe('••• ••• 3456');
    expect(total).toBe(1);
  });

  it('filters by tracking_ref search term', async () => {
    const rows: CallRow[] = [
      makeCustomerCall({ tracking_ref: 'SEED-9', outcome: 'resolved' }),
      makeCustomerCall({ tracking_ref: 'SEED-10', outcome: 'escalated' }),
      makeCustomerCall({ tracking_ref: 'OTHER-1', outcome: 'resolved' }),
    ];

    const fake = makeFakeClient(rows);
    const repo = createCallsRepo(fake as any);
    const { rows: summaries, total } = await repo.listCustomerCalls({ search: 'SEED-9' });

    expect(summaries.length).toBeGreaterThanOrEqual(1);
    expect(summaries.every((s) => s.tracking_ref?.includes('SEED-9'))).toBe(true);
    expect(total).toBe(summaries.length);
  });

  it('paginates via page/pageSize', async () => {
    // Create 5 rows
    const rows: CallRow[] = Array.from({ length: 5 }, (_, i) =>
      makeCustomerCall({ tracking_ref: `SEED-${i}` }),
    );

    const fake = makeFakeClient(rows);
    const repo = createCallsRepo(fake as any);
    const { rows: page1 } = await repo.listCustomerCalls({ page: 1, pageSize: 2 });
    const { rows: page2 } = await repo.listCustomerCalls({ page: 2, pageSize: 2 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
  });

  it('never returns raw from_number on any row', async () => {
    const rows: CallRow[] = [
      makeCustomerCall({ from_number: '+447999888777', outcome: 'resolved' }),
      makeCustomerCall({ from_number: null, outcome: 'escalated' }),
    ];
    const fake = makeFakeClient(rows);
    const repo = createCallsRepo(fake as any);
    const { rows: summaries } = await repo.listCustomerCalls({});

    for (const s of summaries) {
      expect(s).not.toHaveProperty('from_number');
      expect(s).toHaveProperty('from_number_masked');
    }
    // null from_number should produce '—'
    const nullMasked = summaries.find((s) => s.from_number_masked === '—');
    expect(nullMasked).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getCallById
// ---------------------------------------------------------------------------

describe('getCallById', () => {
  it('returns the CallRow for a known id', async () => {
    const call = makeCustomerCall({ id: 'test-id-1' });
    const fake = makeFakeClient([call]);
    const repo = createCallsRepo(fake as any);
    const result = await repo.getCallById('test-id-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('test-id-1');
  });

  it('returns null when the call is not found', async () => {
    const fake = makeFakeClient([]);
    const repo = createCallsRepo(fake as any);
    const result = await repo.getCallById('does-not-exist');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateCall — CR-04 ownership guard
// ---------------------------------------------------------------------------

describe('updateCall', () => {
  it('CR-04: WHERE clause includes call_type=customer and direction=inbound filters', async () => {
    // Spy client that records the filters passed to .eq()
    const eqCalls: Array<[string, unknown]> = [];
    const updateClient = {
      from: (_table: string) => ({
        update: (_patch: object) => ({
          eq: (col: string, val: unknown) => {
            eqCalls.push([col, val]);
            return {
              eq: (col2: string, val2: unknown) => {
                eqCalls.push([col2, val2]);
                return {
                  eq: (col3: string, val3: unknown) => {
                    eqCalls.push([col3, val3]);
                    return {
                      then: (resolve: (v: { data: null; error: null }) => void) =>
                        Promise.resolve({ data: null, error: null }).then(resolve),
                    };
                  },
                };
              },
            };
          },
        }),
      }),
    };

    const repo = createCallsRepo(updateClient as any);
    await repo.updateCall('platform-call-123', { outcome: 'resolved' });

    // Must filter on all three columns
    expect(eqCalls).toContainEqual(['platform_call_id', 'platform-call-123']);
    expect(eqCalls).toContainEqual(['call_type', 'customer']);
    expect(eqCalls).toContainEqual(['direction', 'inbound']);
  });

  it('CR-04: updateCall with mismatched platformCallId does not throw (silent no-op — 0 rows updated)', async () => {
    // Supabase returns { data: null, error: null } when 0 rows match — this is by design.
    // The point is it does NOT overwrite unrelated rows.
    const noMatchClient = {
      from: (_table: string) => ({
        update: (_patch: object) => ({
          eq: (_col: string, _val: unknown) => ({
            eq: (_col2: string, _val2: unknown) => ({
              eq: (_col3: string, _val3: unknown) => ({
                then: (resolve: (v: { data: null; error: null }) => void) =>
                  Promise.resolve({ data: null, error: null }).then(resolve),
              }),
            }),
          }),
        }),
      }),
    };

    const repo = createCallsRepo(noMatchClient as any);
    // Should not throw even when 0 rows matched
    await expect(repo.updateCall('nonexistent-id', { outcome: 'failed' })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getDriverCallsForParent
// ---------------------------------------------------------------------------

describe('getDriverCallsForParent', () => {
  it('returns only driver calls linked to the given parent id', async () => {
    const parentId = 'parent-call-001';
    const driverCall = makeCustomerCall({
      call_type: 'driver',
      direction: 'outbound',
      parent_call_id: parentId,
    });
    const otherDriverCall = makeCustomerCall({
      call_type: 'driver',
      direction: 'outbound',
      parent_call_id: 'other-parent',
    });
    const customerCall = makeCustomerCall({
      call_type: 'customer',
      direction: 'inbound',
    });

    const fake = makeFakeClient([driverCall, otherDriverCall, customerCall]);
    const repo = createCallsRepo(fake as any);
    const result = await repo.getDriverCallsForParent(parentId);

    expect(result).toHaveLength(1);
    expect(result[0].parent_call_id).toBe(parentId);
    expect(result[0].call_type).toBe('driver');
  });
});
