/**
 * calls-repo.write.test.ts — unit tests for insertCall and updateCall
 * Uses an injected fake SupabaseLike client (no real DB).
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseLike } from './calls-repo';
import { createCallsRepo } from './calls-repo';
import type { Database } from '../../types/database';

type CallInsert = Database['public']['Tables']['calls']['Insert'];
type CallUpdate = Database['public']['Tables']['calls']['Update'];

// ---------------------------------------------------------------------------
// Fake client helpers
// ---------------------------------------------------------------------------

function makeInsertClient(error: { message: string } | null): SupabaseLike {
  return {
    from: (_table: string) => ({
      select: vi.fn(),
      insert: vi.fn().mockResolvedValue({ data: null, error }),
      update: vi.fn(),
      delete: vi.fn(),
    }),
  } as unknown as SupabaseLike;
}

function makeUpdateClient(error: { message: string } | null): SupabaseLike {
  // updateCall chains three .eq() calls (platform_call_id, call_type, direction)
  // before awaiting. Build a chainable stub that resolves on the third .eq().
  const finalBuilder = {
    then: (resolve: (v: { data: null; error: typeof error }) => void) =>
      Promise.resolve({ data: null, error }).then(resolve),
  };
  const thirdEq = vi.fn().mockReturnValue(finalBuilder);
  const secondEq = vi.fn().mockReturnValue({ eq: thirdEq });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });

  return {
    from: (_table: string) => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn().mockReturnValue({ eq: firstEq }),
      delete: vi.fn(),
    }),
  } as unknown as SupabaseLike;
}

// ---------------------------------------------------------------------------
// insertCall
// ---------------------------------------------------------------------------

describe('insertCall', () => {
  const minimalInsert: CallInsert = {
    platform_call_id: 'call-001',
    from_number: '+447911123456',
    direction: 'inbound',
    call_type: 'customer',
    start_at: new Date().toISOString(),
    end_at: null,
    duration_ms: null,
    outcome: null,
    tracking_ref: null,
    transcript: null,
    recording_url: null,
    disconnection_reason: null,
    parent_call_id: null,
  };

  it('resolves void on success (error: null)', async () => {
    const client = makeInsertClient(null);
    const repo = createCallsRepo(client);
    await expect(repo.insertCall(minimalInsert)).resolves.toBeUndefined();
  });

  it('throws with "[calls-repo] insert failed" on error', async () => {
    const client = makeInsertClient({ message: 'duplicate key' });
    const repo = createCallsRepo(client);
    await expect(repo.insertCall(minimalInsert)).rejects.toThrow(
      '[calls-repo] insert failed: duplicate key',
    );
  });
});

// ---------------------------------------------------------------------------
// updateCall
// ---------------------------------------------------------------------------

describe('updateCall', () => {
  const platformCallId = 'call-001';
  const patch: CallUpdate = { outcome: 'resolved', duration_ms: 30000 };

  it('resolves void on success (error: null)', async () => {
    const client = makeUpdateClient(null);
    const repo = createCallsRepo(client);
    await expect(repo.updateCall(platformCallId, patch)).resolves.toBeUndefined();
  });

  it('throws with "[calls-repo] update failed" on error', async () => {
    const client = makeUpdateClient({ message: 'row not found' });
    const repo = createCallsRepo(client);
    await expect(repo.updateCall(platformCallId, patch)).rejects.toThrow(
      '[calls-repo] update failed: row not found',
    );
  });
});
