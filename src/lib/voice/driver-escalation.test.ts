/**
 * driver-escalation.test.ts — TDD tests for the driver escalation state machine.
 *
 * Uses MockTelephonyAdapter + injected fakes — zero real calls or DB.
 *
 * Covers DRIV-01..04:
 * - Happy path: resolved, exactly 1 driver row logged
 * - Driver not found: failed, no call placed
 * - Unreachable driver: maxRetries+1 attempts, each logged 'failed', outcome 'escalated'
 * - Duration exceeded: endCall invoked, attempt logged 'failed'
 */

import { describe, it, expect, vi } from 'vitest';
import { MockTelephonyAdapter } from './telephony/mock-adapter';
import { runDriverEscalation, MAX_RETRIES, MAX_DURATION_S } from './driver-escalation';
import type { Database } from '@/types/database';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type CallInsert = Database['public']['Tables']['calls']['Insert'];

function makeInsertSpy() {
  return vi.fn((_row: CallInsert): Promise<void> => Promise.resolve());
}

function makeDriver(overrides: Partial<{ id: string; phone_e164: string; name: string }> = {}) {
  return {
    id: overrides.id ?? 'driver-uuid-1',
    name: overrides.name ?? 'Test Driver',
    phone_e164: overrides.phone_e164 ?? '+441332000001',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runDriverEscalation — exported constants', () => {
  it('exports MAX_RETRIES (default reference)', () => {
    expect(typeof MAX_RETRIES).toBe('number');
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(0);
  });

  it('exports MAX_DURATION_S (default reference)', () => {
    expect(typeof MAX_DURATION_S).toBe('number');
    expect(MAX_DURATION_S).toBeGreaterThan(0);
  });
});

describe('runDriverEscalation — happy path (DRIV-02/04)', () => {
  it('resolves with outcome "resolved" and relays the ETA', async () => {
    const adapter = new MockTelephonyAdapter();
    const insertCallSpy = makeInsertSpy();
    const getDriverById = vi.fn().mockResolvedValue(makeDriver());

    const result = await runDriverEscalation(
      { parentCallId: 'parent-call-1', driverId: 'driver-uuid-1', maxDurationS: 180, maxRetries: 2 },
      { adapter, getDriverById, insertCall: insertCallSpy, getEta: async () => '14:00–16:00' },
    );

    expect(result.outcome).toBe('resolved');
    expect(result.eta).toBe('14:00–16:00');
    expect(result.attempts).toBe(1);
  });

  it('logs exactly 1 driver/outbound row with outcome "resolved" and parent_call_id set', async () => {
    const adapter = new MockTelephonyAdapter();
    const insertCallSpy = makeInsertSpy();
    const getDriverById = vi.fn().mockResolvedValue(makeDriver());

    await runDriverEscalation(
      { parentCallId: 'parent-call-1', driverId: 'driver-uuid-1', maxDurationS: 180, maxRetries: 2 },
      { adapter, getDriverById, insertCall: insertCallSpy, getEta: async () => '14:00–16:00' },
    );

    expect(insertCallSpy).toHaveBeenCalledTimes(1);
    const logged = insertCallSpy.mock.calls[0][0];
    expect(logged.call_type).toBe('driver');
    expect(logged.direction).toBe('outbound');
    expect(logged.parent_call_id).toBe('parent-call-1');
    expect(logged.outcome).toBe('resolved');
    expect(logged.duration_ms).toBeGreaterThan(0);
  });

  it('calls placeOutboundCall with the driver phone_e164 (not a caller-supplied number)', async () => {
    const adapter = new MockTelephonyAdapter();
    const insertCallSpy = makeInsertSpy();
    const driver = makeDriver({ phone_e164: '+441332000099' });
    const getDriverById = vi.fn().mockResolvedValue(driver);

    await runDriverEscalation(
      { parentCallId: 'parent-call-1', driverId: 'driver-uuid-1', maxDurationS: 180, maxRetries: 2 },
      { adapter, getDriverById, insertCall: insertCallSpy, getEta: async () => '10:00–12:00' },
    );

    const placed = adapter.events.find(e => e.op === 'placeOutboundCall');
    expect(placed).toBeDefined();
    expect((placed!.args as { to: string }).to).toBe('+441332000099');
  });
});

describe('runDriverEscalation — driver not found (DRIV-02/04 T-04-20)', () => {
  it('returns outcome "failed" with no call placed when getDriverById returns null', async () => {
    const adapter = new MockTelephonyAdapter();
    const insertCallSpy = makeInsertSpy();
    const getDriverById = vi.fn().mockResolvedValue(null);

    const result = await runDriverEscalation(
      { parentCallId: 'parent-call-2', driverId: 'unknown-id', maxDurationS: 180, maxRetries: 2 },
      { adapter, getDriverById, insertCall: insertCallSpy, getEta: async () => null },
    );

    expect(result.outcome).toBe('failed');
    expect(result.attempts).toBe(0);
    // No call placed
    expect(adapter.events.filter(e => e.op === 'placeOutboundCall').length).toBe(0);
    // One failed row logged
    expect(insertCallSpy).toHaveBeenCalledTimes(1);
    const logged = insertCallSpy.mock.calls[0][0];
    expect(logged.call_type).toBe('driver');
    expect(logged.direction).toBe('outbound');
    expect(logged.parent_call_id).toBe('parent-call-2');
    expect(logged.outcome).toBe('failed');
  });
});

describe('runDriverEscalation — unreachable driver (DRIV-03/04 T-04-21)', () => {
  it('retries maxRetries+1 times total, each attempt logs a failed row, final outcome is escalated', async () => {
    const maxRetries = 2;
    const adapter = new MockTelephonyAdapter();
    // Make ALL placement attempts fail
    // failNextPlace only fails once, so we need to override placeOutboundCall to always fail
    vi.spyOn(adapter, 'placeOutboundCall').mockRejectedValue(new Error('Simulated unreachable'));

    const insertCallSpy = makeInsertSpy();
    const getDriverById = vi.fn().mockResolvedValue(makeDriver());

    const result = await runDriverEscalation(
      { parentCallId: 'parent-call-3', driverId: 'driver-uuid-1', maxDurationS: 180, maxRetries },
      { adapter, getDriverById, insertCall: insertCallSpy, getEta: async () => null },
    );

    // Total attempts = maxRetries + 1 (initial + retries)
    expect(result.attempts).toBe(maxRetries + 1);
    expect(result.outcome).toBe('escalated');

    // Each attempt logged its own failed row
    expect(insertCallSpy).toHaveBeenCalledTimes(maxRetries + 1);
    for (const [callArg] of insertCallSpy.mock.calls) {
      expect(callArg.call_type).toBe('driver');
      expect(callArg.direction).toBe('outbound');
      expect(callArg.parent_call_id).toBe('parent-call-3');
      expect(callArg.outcome).toBe('failed');
    }
  });

  it('uses failNextPlace for one retry then succeeds on the next', async () => {
    const adapter = new MockTelephonyAdapter();
    adapter.failNextPlace = true; // First call fails, second succeeds

    const insertCallSpy = makeInsertSpy();
    const getDriverById = vi.fn().mockResolvedValue(makeDriver());

    const result = await runDriverEscalation(
      { parentCallId: 'parent-call-4', driverId: 'driver-uuid-1', maxDurationS: 180, maxRetries: 2 },
      { adapter, getDriverById, insertCall: insertCallSpy, getEta: async () => '15:00–17:00' },
    );

    expect(result.outcome).toBe('resolved');
    expect(result.attempts).toBe(2); // 1 fail + 1 success
    expect(result.eta).toBe('15:00–17:00');
    // 2 rows: 1 failed (first attempt) + 1 resolved (second attempt)
    expect(insertCallSpy).toHaveBeenCalledTimes(2);
    expect(insertCallSpy.mock.calls[0][0].outcome).toBe('failed');
    expect(insertCallSpy.mock.calls[1][0].outcome).toBe('resolved');
  });
});

describe('runDriverEscalation — duration exceeded (DRIV-04 T-04-21)', () => {
  it('calls endCall and logs a failed row when simulated duration exceeds maxDurationS', async () => {
    const adapter = new MockTelephonyAdapter();
    const insertCallSpy = makeInsertSpy();
    const getDriverById = vi.fn().mockResolvedValue(makeDriver());

    // Inject a clock that advances past maxDurationS when getEta resolves
    let callStartMs: number | null = null;
    const slowEta = async () => {
      // Simulate that the call took too long (duration injection via now())
      return null as string | null; // returning null signals timeout path
    };

    // Use a custom `now` that simulates timeout
    const maxDurationS = 5; // Very short limit
    const fakeNow = vi.fn();
    const baseMs = 1000000;
    fakeNow.mockReturnValueOnce(baseMs).mockReturnValue(baseMs + (maxDurationS + 1) * 1000);

    const result = await runDriverEscalation(
      {
        parentCallId: 'parent-call-5',
        driverId: 'driver-uuid-1',
        maxDurationS,
        maxRetries: 0, // no retries to keep test focused
      },
      {
        adapter,
        getDriverById,
        insertCall: insertCallSpy,
        getEta: slowEta,
        now: fakeNow,
      },
    );

    // endCall should have been invoked
    expect(adapter.events.some(e => e.op === 'endCall')).toBe(true);
    // The attempt row should be logged as failed
    expect(insertCallSpy).toHaveBeenCalledTimes(1);
    expect(insertCallSpy.mock.calls[0][0].outcome).toBe('failed');
  });
});
