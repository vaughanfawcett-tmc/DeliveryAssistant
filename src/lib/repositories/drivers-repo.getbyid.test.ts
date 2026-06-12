/**
 * drivers-repo.getbyid.test.ts — unit tests for getDriverById
 * Uses an injected fake SupabaseLike client (no real DB).
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseLike } from './drivers-repo';
import { createDriversRepo } from './drivers-repo';
import type { DriverRow } from '../../types/database';

// ---------------------------------------------------------------------------
// Fake client helpers
// ---------------------------------------------------------------------------

const DRIVER: DriverRow = {
  id: 'driver-uuid-001',
  name: 'Dave Smith',
  phone_e164: '+447700900001',
  active: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

function makeGetByIdClient(
  result: { data: DriverRow | null; error: { message: string } | null },
): SupabaseLike {
  return {
    from: (_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn(),
          single: vi.fn().mockResolvedValue(result),
          then: vi.fn(),
        }),
      }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }),
  } as unknown as SupabaseLike;
}

// ---------------------------------------------------------------------------
// getDriverById
// ---------------------------------------------------------------------------

describe('getDriverById', () => {
  it('returns the DriverRow when found', async () => {
    const client = makeGetByIdClient({ data: DRIVER, error: null });
    const repo = createDriversRepo(client);
    const result = await repo.getDriverById('driver-uuid-001');
    expect(result).toEqual(DRIVER);
  });

  it('returns null when not found (data: null, error: null)', async () => {
    const client = makeGetByIdClient({ data: null, error: null });
    const repo = createDriversRepo(client);
    const result = await repo.getDriverById('missing-id');
    expect(result).toBeNull();
  });

  it('returns null on error (never throws)', async () => {
    const client = makeGetByIdClient({ data: null, error: { message: 'not found' } });
    const repo = createDriversRepo(client);
    const result = await repo.getDriverById('bad-id');
    expect(result).toBeNull();
  });
});
