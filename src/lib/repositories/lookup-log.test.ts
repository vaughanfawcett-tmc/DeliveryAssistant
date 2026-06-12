import { describe, it, expect, vi } from 'vitest';
import { createLookupLogRepo } from './lookup-log';
import type { LookupOutcome } from './lookup-log';

// ---------------------------------------------------------------------------
// In-memory fake Supabase client
// ---------------------------------------------------------------------------

interface FakeRow {
  tracking_ref: string;
  postcode: string;
  success: boolean;
  failure_reason: string | null;
  looked_up_at?: string;
}

function makeFakeClient(seedRows: FakeRow[] = [], insertError: Error | null = null) {
  const inserted: FakeRow[] = [];

  return {
    from: (table: string) => {
      expect(table).toBe('portal_lookups');
      return {
        insert: (row: FakeRow) => {
          if (insertError) {
            return Promise.resolve({ data: null, error: insertError });
          }
          inserted.push(row);
          return Promise.resolve({ data: [row], error: null });
        },
        select: (cols?: string) => ({
          gte: (column: string, value: string) => {
            const filtered = seedRows.filter((r) => {
              const ts = r.looked_up_at ?? new Date().toISOString();
              return ts >= value;
            });
            return Promise.resolve({ data: filtered, error: null });
          },
        }),
      };
    },
    _inserted: inserted,
  };
}

// ---------------------------------------------------------------------------
// logLookup — outcome to success / failure_reason mapping
// ---------------------------------------------------------------------------

describe('logLookup', () => {
  it('inserts success=true, failure_reason=null for outcome "found"', async () => {
    const fake = makeFakeClient();
    const repo = createLookupLogRepo(fake as any);

    await repo.logLookup({ trackingRef: 'ABC123', postcode: 'DE11AA', success: true, outcome: 'found' });

    expect(fake._inserted).toHaveLength(1);
    expect(fake._inserted[0]).toMatchObject({
      tracking_ref: 'ABC123',
      postcode: 'DE11AA',
      success: true,
      failure_reason: null,
    });
  });

  it('inserts success=false, failure_reason="postcode_mismatch" for that outcome', async () => {
    const fake = makeFakeClient();
    const repo = createLookupLogRepo(fake as any);

    await repo.logLookup({ trackingRef: 'ABC123', postcode: 'DE11AA', success: false, outcome: 'postcode_mismatch' });

    expect(fake._inserted[0]).toMatchObject({ success: false, failure_reason: 'postcode_mismatch' });
  });

  it('inserts success=false, failure_reason="not_found" for that outcome', async () => {
    const fake = makeFakeClient();
    const repo = createLookupLogRepo(fake as any);

    await repo.logLookup({ trackingRef: 'ABC123', postcode: 'DE11AA', success: false, outcome: 'not_found' });

    expect(fake._inserted[0]).toMatchObject({ success: false, failure_reason: 'not_found' });
  });

  it('inserts success=false, failure_reason="api_error" for that outcome', async () => {
    const fake = makeFakeClient();
    const repo = createLookupLogRepo(fake as any);

    await repo.logLookup({ trackingRef: 'ABC123', postcode: 'DE11AA', success: false, outcome: 'api_error' });

    expect(fake._inserted[0]).toMatchObject({ success: false, failure_reason: 'api_error' });
  });

  it('does NOT throw when the insert returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = makeFakeClient([], new Error('DB connection failed'));
    const repo = createLookupLogRepo(fake as any);

    // Must resolve without throwing
    await expect(
      repo.logLookup({ trackingRef: 'ABC123', postcode: 'DE11AA', success: true, outcome: 'found' }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// countByOutcome — aggregation
// ---------------------------------------------------------------------------

describe('countByOutcome', () => {
  it('aggregates rows into a Record keyed by all four LookupOutcome values', async () => {
    const since = new Date('2024-01-01T00:00:00Z');

    const seed: FakeRow[] = [
      { tracking_ref: 'A', postcode: 'AA1', success: true,  failure_reason: null,                looked_up_at: '2024-06-01T10:00:00Z' },
      { tracking_ref: 'B', postcode: 'AA2', success: true,  failure_reason: null,                looked_up_at: '2024-06-01T11:00:00Z' },
      { tracking_ref: 'C', postcode: 'AA3', success: false, failure_reason: 'not_found',         looked_up_at: '2024-06-01T12:00:00Z' },
      { tracking_ref: 'D', postcode: 'AA4', success: false, failure_reason: 'postcode_mismatch', looked_up_at: '2024-06-01T13:00:00Z' },
      { tracking_ref: 'E', postcode: 'AA5', success: false, failure_reason: 'api_error',         looked_up_at: '2024-06-01T14:00:00Z' },
    ];

    const fake = makeFakeClient(seed);
    const repo = createLookupLogRepo(fake as any);

    const result = await repo.countByOutcome(since);

    expect(result).toEqual<Record<LookupOutcome, number>>({
      found: 2,
      not_found: 1,
      postcode_mismatch: 1,
      api_error: 1,
    });
  });

  it('returns all-zero counts when no rows exist', async () => {
    const fake = makeFakeClient([]);
    const repo = createLookupLogRepo(fake as any);

    const result = await repo.countByOutcome(new Date());

    expect(result).toEqual({ found: 0, not_found: 0, postcode_mismatch: 0, api_error: 0 });
  });
});
