/**
 * route.test.ts — Tests for /api/voice/request_human
 *
 * Security assertion (T-04-13):
 * - Bad/missing signature → 401 before returning any phone number
 *
 * VOICE-06:
 * - Returns transferTo === CONTACT_PHONE
 * - Optionally includes the summary string
 */

import { createHmac } from 'crypto';
import { describe, it, expect } from 'vitest';
import { POST } from './route';

// ---------------------------------------------------------------------------
// Helper
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
  return new Request('http://localhost/api/voice/request_human', {
    method: 'POST',
    headers,
    body: bodyStr,
  });
}

// CONTACT_PHONE has a default in env schema: '+44 000 000 0000'
const EXPECTED_CONTACT_PHONE = process.env.CONTACT_PHONE ?? '+44 000 000 0000';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/voice/request_human', () => {
  describe('signature verification (T-04-13)', () => {
    it('returns 401 for a missing signature', async () => {
      const req = makeRequest({}, false);
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 for a tampered signature', async () => {
      const bodyStr = JSON.stringify({ summary: 'test' });
      const req = new Request('http://localhost/api/voice/request_human', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-voice-signature': 'baaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad00',
        },
        body: bodyStr,
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe('warm handoff response (VOICE-06)', () => {
    it('returns transferTo === CONTACT_PHONE', async () => {
      const req = makeRequest({});
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.transferTo).toBe(EXPECTED_CONTACT_PHONE);
    });

    it('includes the summary when provided', async () => {
      const req = makeRequest({ summary: 'Customer asked about PA-12345, postcode DE1 1AA' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.summary).toBe('Customer asked about PA-12345, postcode DE1 1AA');
    });

    it('returns null summary when not provided', async () => {
      const req = makeRequest({});
      const res = await POST(req);
      const body = await res.json() as Record<string, unknown>;
      expect(body.summary).toBeNull();
    });
  });
});
