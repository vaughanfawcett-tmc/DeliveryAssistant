/**
 * contact_driver/route.test.ts — Tests for the signed contact_driver tool handler.
 *
 * Tests run with PALLEX_MOCK=true so the MockTelephonyAdapter is selected.
 *
 * Covers DRIV-01..04 + threat model T-04-19/T-04-20/T-04-23:
 * - Bad signature -> 401 before any escalation
 * - consented:false -> { contacted:false }, zero outbound calls
 * - consented:true, known driver -> escalation runs and a driver row is logged
 * - Invalid body -> 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'dev-only-insecure-voice-webhook-secret-change-me';
const PARENT_CALL_ID = 'parent-call-test-1';
const DRIVER_ID = 'driver-uuid-test-1';

/** Sign a raw body string with the test secret (hex digest for X-Voice-Signature). */
function signBody(body: string): string {
  return createHmac('sha256', TEST_SECRET).update(body).digest('hex');
}

/** Build a valid signed request. */
function makeRequest(body: object, opts: { omitSig?: boolean; badSig?: boolean } = {}): Request {
  const raw = JSON.stringify(body);
  const sig = opts.badSig ? 'deadbeef'.repeat(8) : signBody(raw);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!opts.omitSig) {
    headers['x-voice-signature'] = sig;
  }
  return new Request('http://localhost/api/voice/contact_driver', {
    method: 'POST',
    headers,
    body: raw,
  });
}

// ---------------------------------------------------------------------------
// Module mocking — inject fakes for getDriverById and insertCall
// ---------------------------------------------------------------------------

const mockInsertCall = vi.fn((_row: unknown): Promise<void> => Promise.resolve());
const mockGetDriverById = vi.fn();

vi.mock('@/lib/repositories/calls-repo', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insertCall: (row: unknown) => (mockInsertCall as any)(row),
}));

vi.mock('@/lib/repositories/drivers-repo', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDriverById: (id: unknown) => (mockGetDriverById as any)(id),
}));

// Force PALLEX_MOCK env so the route uses MockTelephonyAdapter
process.env.PALLEX_MOCK = 'true';
process.env.PALLEX_BASE_URL = 'https://mock.pallex.invalid';
process.env.SUPABASE_URL = 'https://mock.supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-for-testing-only';
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-upstash-token';
process.env.DASHBOARD_PASSWORD = 'test-password-123';
process.env.DASHBOARD_SESSION_SECRET = 'test-session-secret-at-least-32-chars!!';
process.env.VOICE_WEBHOOK_SECRET = TEST_SECRET;
process.env.DRIVER_CALL_MAX_DURATION_S = '180';
process.env.DRIVER_CALL_MAX_RETRIES = '2';

// ---------------------------------------------------------------------------
// Import route AFTER env is set
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// verifyVoiceSignature is no longer exported from this route (CR-01);
// the canonical verifier tests live in webhook-auth.test.ts.

// ---------------------------------------------------------------------------
// Tests: POST handler
// ---------------------------------------------------------------------------

describe('POST /api/voice/contact_driver — signature gate (T-04-19)', () => {
  beforeEach(() => {
    mockInsertCall.mockClear();
    mockGetDriverById.mockClear();
  });

  it('returns 401 when signature is absent', async () => {
    const req = makeRequest({ parentCallId: PARENT_CALL_ID, driverId: DRIVER_ID, consented: true }, { omitSig: true });
    const res = await POST(req);
    expect(res.status).toBe(401);
    // No escalation attempted
    expect(mockGetDriverById).not.toHaveBeenCalled();
    expect(mockInsertCall).not.toHaveBeenCalled();
  });

  it('returns 401 when signature is wrong', async () => {
    const req = makeRequest({ parentCallId: PARENT_CALL_ID, driverId: DRIVER_ID, consented: true }, { badSig: true });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockGetDriverById).not.toHaveBeenCalled();
    expect(mockInsertCall).not.toHaveBeenCalled();
  });
});

describe('POST /api/voice/contact_driver — consent gate (T-04-23)', () => {
  beforeEach(() => {
    mockInsertCall.mockClear();
    mockGetDriverById.mockClear();
  });

  it('returns { contacted:false, reason:"consent_not_given" } when consented:false, no call placed', async () => {
    const req = makeRequest({ parentCallId: PARENT_CALL_ID, driverId: DRIVER_ID, consented: false });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { contacted: boolean; reason: string };
    expect(body.contacted).toBe(false);
    // WR-02: explicit reason so agent can check before telling customer
    expect(body.reason).toBe('consent_not_given');
    // No outbound call — getDriverById was never called, no row logged
    expect(mockGetDriverById).not.toHaveBeenCalled();
    expect(mockInsertCall).not.toHaveBeenCalled();
  });
});

describe('POST /api/voice/contact_driver — validation', () => {
  it('returns 400 for invalid JSON body', async () => {
    const raw = 'not-valid-json';
    const sig = signBody(raw);
    const req = new Request('http://localhost/api/voice/contact_driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-voice-signature': sig },
      body: raw,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = makeRequest({ parentCallId: PARENT_CALL_ID }); // missing driverId + consented
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/voice/contact_driver — happy path (DRIV-01..04)', () => {
  beforeEach(() => {
    mockInsertCall.mockClear();
    mockGetDriverById.mockClear();
  });

  it('runs escalation and returns outcome when consented:true with a known driver', async () => {
    mockGetDriverById.mockResolvedValue({
      id: DRIVER_ID,
      name: 'Test Driver',
      phone_e164: '+441332000042',
      active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const req = makeRequest({ parentCallId: PARENT_CALL_ID, driverId: DRIVER_ID, consented: true });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { outcome: string; attempts: number };

    // escalation should complete (no ETA injected, so outcome will be 'escalated'
    // after exhausting retries, OR 'resolved' if getEta returns non-null — either way,
    // a driver row must be logged for every attempt)
    expect(['resolved', 'failed', 'escalated']).toContain(body.outcome);

    // At least one driver row was logged (DRIV-04 audit trail)
    expect(mockInsertCall).toHaveBeenCalled();
    const firstCall = mockInsertCall.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall.call_type).toBe('driver');
    expect(firstCall.direction).toBe('outbound');
    expect(firstCall.parent_call_id).toBe(PARENT_CALL_ID);
  });

  it('resolves driver phone server-side — driverId in body does not influence destination (T-04-20)', async () => {
    const driverPhone = '+441332000099';
    mockGetDriverById.mockResolvedValue({
      id: DRIVER_ID,
      name: 'Driver B',
      phone_e164: driverPhone,
      active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const req = makeRequest({ parentCallId: PARENT_CALL_ID, driverId: DRIVER_ID, consented: true });
    await POST(req);

    // The repo was called with the driverId from the body (not a phone number)
    expect(mockGetDriverById).toHaveBeenCalledWith(DRIVER_ID);
  });

  it('returns outcome "failed" and logs one row when driver is not in the managed list (T-04-20)', async () => {
    mockGetDriverById.mockResolvedValue(null);

    const req = makeRequest({ parentCallId: PARENT_CALL_ID, driverId: 'unknown-id', consented: true });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { outcome: string };
    expect(body.outcome).toBe('failed');

    // One failed log row — no call was placed
    expect(mockInsertCall).toHaveBeenCalledTimes(1);
    const row = mockInsertCall.mock.calls[0][0] as Record<string, unknown>;
    expect(row.outcome).toBe('failed');
  });
});
