/**
 * route.test.ts — Tests for /api/voice/lookup_consignment
 *
 * Security assertions (T-04-13, T-04-15):
 * - Bad signature → 401 BEFORE any lookup occurs (no side effects)
 * - Valid signature + valid body → delegates to lookupConsignment and returns
 *   only result fields — never fabricates data (VOICE-08)
 * - Valid signature + invalid body → 400
 *
 * Strategy: vi.mock('@/lib/tracking/service') so the default singleton never
 * triggers the lazy supabase import (which carries server-only). This lets us
 * verify the 401-first guarantee: the spy is NOT called when signature fails.
 */

import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrackingResult } from '@/types/tracking';

// ---------------------------------------------------------------------------
// Mock lookupConsignment — prevents server-only import chain in tests
// ---------------------------------------------------------------------------

vi.mock('@/lib/tracking/service', () => ({
  lookupConsignment: vi.fn(),
}));

import { lookupConsignment } from '@/lib/tracking/service';
import { POST } from './route';

const lookupMock = vi.mocked(lookupConsignment);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = process.env.VOICE_WEBHOOK_SECRET!;

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeRequest(body: Record<string, unknown>, signed = true): Request {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signed) {
    headers['x-voice-signature'] = sign(bodyStr);
  }
  return new Request('http://localhost/api/voice/lookup_consignment', {
    method: 'POST',
    headers,
    body: bodyStr,
  });
}

beforeEach(() => {
  lookupMock.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/voice/lookup_consignment', () => {
  describe('signature verification (T-04-13) — 401 before any lookup', () => {
    it('returns 401 for a missing signature — lookup NOT called', async () => {
      const req = makeRequest({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' }, false);
      const res = await POST(req);
      expect(res.status).toBe(401);
      // Critical: lookup must not have been called (T-04-13 401-first)
      expect(lookupMock).not.toHaveBeenCalled();
    });

    it('returns 401 for a tampered signature — lookup NOT called', async () => {
      const bodyStr = JSON.stringify({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });
      const req = new Request('http://localhost/api/voice/lookup_consignment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-voice-signature': 'tampered-sig-00000000000000000000000000000000000000000000000000000000000000',
        },
        body: bodyStr,
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(lookupMock).not.toHaveBeenCalled();
    });
  });

  describe('input validation (T-04-14)', () => {
    it('returns 400 when trackingRef is missing', async () => {
      const req = makeRequest({ postcode: 'DE1 1AA' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 when postcode is missing', async () => {
      const req = makeRequest({ trackingRef: 'PA-12345' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('successful lookup — happy path', () => {
    const mockResult: TrackingResult = {
      ok: true,
      consignment: {
        consignmentNumber: 'PA-12345',
        plainStatus: 'In Transit',
        description: 'Your shipment is on the way',
        currentStage: 'in_transit',
        estimatedDelDate: '2026-06-12',
        startWindow: '09:00',
        endWindow: '11:00',
        routeDetails: [],
      },
    };

    beforeEach(() => {
      lookupMock.mockResolvedValue(mockResult);
    });

    it('returns 200 with consignment fields from lookupConsignment', async () => {
      const req = makeRequest({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.consignmentNumber).toBe('PA-12345');
      expect(body.plainStatus).toBe('In Transit');
      expect(body.currentStage).toBe('in_transit');
    });

    it('calls lookupConsignment with the correct input', async () => {
      const req = makeRequest({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });
      await POST(req);
      expect(lookupMock).toHaveBeenCalledWith({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });
    });

    it('carries the ETA window when present', async () => {
      const req = makeRequest({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });
      const res = await POST(req);
      const body = await res.json() as Record<string, unknown>;
      expect(body.startWindow).toBe('09:00');
      expect(body.endWindow).toBe('11:00');
    });
  });

  describe('null ETA edge case (VOICE-08 — never fabricate)', () => {
    it('passes null estimatedDelDate through — no fabrication', async () => {
      const nullEtaResult: TrackingResult = {
        ok: true,
        consignment: {
          consignmentNumber: 'PA-99999',
          plainStatus: 'Booked',
          description: 'Your shipment has been booked',
          currentStage: 'booked',
          estimatedDelDate: null,
          startWindow: null,
          endWindow: null,
          routeDetails: [],
        },
      };
      lookupMock.mockResolvedValue(nullEtaResult);

      const req = makeRequest({ trackingRef: 'PA-99999', postcode: 'NG1 5FS' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.estimatedDelDate).toBeNull();
      expect(body.startWindow).toBeNull();
      expect(body.endWindow).toBeNull();
    });
  });

  describe('not_found path', () => {
    it('returns ok:false with not_found reason', async () => {
      lookupMock.mockResolvedValue({ ok: false, reason: 'not_found' });
      const req = makeRequest({ trackingRef: 'XX-NOPE', postcode: 'DE1 1AA' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(false);
      expect(body.reason).toBe('not_found');
    });
  });

  describe('postcode_mismatch path', () => {
    it('returns ok:false with postcode_mismatch reason', async () => {
      lookupMock.mockResolvedValue({ ok: false, reason: 'postcode_mismatch' });
      const req = makeRequest({ trackingRef: 'PA-12345', postcode: 'SW1A 1AA' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(false);
      expect(body.reason).toBe('postcode_mismatch');
    });
  });

  describe('api_error path', () => {
    it('returns ok:false with api_error reason', async () => {
      lookupMock.mockResolvedValue({ ok: false, reason: 'api_error' });
      const req = makeRequest({ trackingRef: 'PA-12345', postcode: 'DE1 1AA' });
      const res = await POST(req);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(false);
      expect(body.reason).toBe('api_error');
    });
  });
});
