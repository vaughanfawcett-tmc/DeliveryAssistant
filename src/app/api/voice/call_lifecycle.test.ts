/**
 * call_lifecycle.test.ts — Tests for call_started and call_ended route handlers.
 *
 * Security assertions (T-04-13):
 * - Bad/missing signature → 401 BEFORE any repo call
 *
 * Persistence assertions (D-07, T-04-16):
 * - call_started: insertCall called with call_type:'customer', direction:'inbound'
 * - call_ended: updateCall called with recording_url + JSON-stringified transcript
 *   parseable by TranscriptView's parseTranscript (round-trip)
 *
 * Strategy: vi.mock('@/lib/repositories/calls-repo') — prevents server-only
 * import chain (supabase.ts carries server-only). Spies verify row shapes.
 */

import { createHmac } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from '@/types/database';

// ---------------------------------------------------------------------------
// Mock calls-repo — prevents server-only import chain
// ---------------------------------------------------------------------------

vi.mock('@/lib/repositories/calls-repo', () => ({
  insertCall: vi.fn(),
  updateCall: vi.fn(),
}));

import { insertCall, updateCall } from '@/lib/repositories/calls-repo';
import { POST as callStartedPost } from './call_started/route';
import { POST as callEndedPost } from './call_ended/route';

const insertMock = vi.mocked(insertCall);
const updateMock = vi.mocked(updateCall);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = process.env.VOICE_WEBHOOK_SECRET!;

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeRequest(url: string, body: Record<string, unknown>, signed = true): Request {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signed) {
    headers['x-voice-signature'] = sign(bodyStr);
  }
  return new Request(url, { method: 'POST', headers, body: bodyStr });
}

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue(undefined);
  updateMock.mockReset().mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// call_started
// ---------------------------------------------------------------------------

describe('POST /api/voice/call_started', () => {
  const URL = 'http://localhost/api/voice/call_started';

  const validBody = {
    platformCallId: 'el-call-001',
    fromNumber: '+441332123456',
    startAt: '2026-06-12T10:00:00Z',
    trackingRef: 'PA-12345',
  };

  describe('signature verification (T-04-13)', () => {
    it('returns 401 for missing signature — insertCall NOT called', async () => {
      const req = makeRequest(URL, validBody, false);
      const res = await callStartedPost(req);
      expect(res.status).toBe(401);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('returns 401 for tampered signature — insertCall NOT called', async () => {
      const bodyStr = JSON.stringify(validBody);
      const req = new Request(URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-voice-signature': 'tampered0000000000000000000000000000000000000000000000000000000000',
        },
        body: bodyStr,
      });
      const res = await callStartedPost(req);
      expect(res.status).toBe(401);
      expect(insertMock).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('returns 400 when platformCallId is missing', async () => {
      const req = makeRequest(URL, { fromNumber: '+44x', startAt: '2026-06-12T10:00:00Z' });
      const res = await callStartedPost(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 when startAt is missing', async () => {
      const req = makeRequest(URL, { platformCallId: 'el-001', fromNumber: '+44x' });
      const res = await callStartedPost(req);
      expect(res.status).toBe(400);
    });
  });

  describe('persistence (D-07)', () => {
    it('calls insertCall with call_type:customer and direction:inbound', async () => {
      const req = makeRequest(URL, validBody);
      const res = await callStartedPost(req);
      expect(res.status).toBe(200);

      expect(insertMock).toHaveBeenCalledOnce();
      const row = insertMock.mock.calls[0][0] as Database['public']['Tables']['calls']['Insert'];
      expect(row.call_type).toBe('customer');
      expect(row.direction).toBe('inbound');
      expect(row.platform_call_id).toBe('el-call-001');
      expect(row.from_number).toBe('+441332123456');
      expect(row.start_at).toBe('2026-06-12T10:00:00Z');
      expect(row.tracking_ref).toBe('PA-12345');
      // These must be null on insert
      expect(row.outcome).toBeNull();
      expect(row.transcript).toBeNull();
      expect(row.recording_url).toBeNull();
    });

    it('handles optional fields (fromNumber and trackingRef absent)', async () => {
      const body = { platformCallId: 'el-call-002', startAt: '2026-06-12T10:00:00Z' };
      const req = makeRequest(URL, body);
      await callStartedPost(req);

      const row = insertMock.mock.calls[0][0] as Database['public']['Tables']['calls']['Insert'];
      expect(row.from_number).toBeNull();
      expect(row.tracking_ref).toBeNull();
    });

    it('returns ok:true on success', async () => {
      const req = makeRequest(URL, validBody);
      const res = await callStartedPost(req);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// call_ended
// ---------------------------------------------------------------------------

describe('POST /api/voice/call_ended', () => {
  const URL = 'http://localhost/api/voice/call_ended';

  const validTranscript = [
    { speaker: 'Agent', text: 'Hello! How can I help?', ts: '10:00:01' },
    { speaker: 'Customer', text: 'I need to track PA-12345', ts: '10:00:05' },
  ];

  const validBody = {
    platformCallId: 'el-call-001',
    endAt: '2026-06-12T10:03:00Z',
    durationMs: 180000,
    outcome: 'resolved',
    transcript: validTranscript,
    recordingUrl: 'https://recordings.elevenlabs.io/el-call-001.mp3',
    disconnectionReason: 'customer_hangup',
  };

  describe('signature verification (T-04-13)', () => {
    it('returns 401 for missing signature — updateCall NOT called', async () => {
      const req = makeRequest(URL, validBody, false);
      const res = await callEndedPost(req);
      expect(res.status).toBe(401);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('returns 401 for tampered signature — updateCall NOT called', async () => {
      const bodyStr = JSON.stringify(validBody);
      const req = new Request(URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-voice-signature': 'tampered0000000000000000000000000000000000000000000000000000000000',
        },
        body: bodyStr,
      });
      const res = await callEndedPost(req);
      expect(res.status).toBe(401);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('returns 400 for invalid outcome value', async () => {
      const req = makeRequest(URL, { ...validBody, outcome: 'unknown_outcome' });
      const res = await callEndedPost(req);
      expect(res.status).toBe(400);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('returns 400 when platformCallId is missing', async () => {
      const { platformCallId: _, ...rest } = validBody;
      const req = makeRequest(URL, rest);
      const res = await callEndedPost(req);
      expect(res.status).toBe(400);
    });

    it('accepts all valid outcome values', async () => {
      for (const outcome of ['resolved', 'escalated', 'no_data', 'failed']) {
        updateMock.mockReset().mockResolvedValue(undefined);
        const req = makeRequest(URL, { ...validBody, outcome });
        const res = await callEndedPost(req);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('persistence (D-07, T-04-16)', () => {
    it('calls updateCall with the correct platformCallId', async () => {
      const req = makeRequest(URL, validBody);
      await callEndedPost(req);
      expect(updateMock).toHaveBeenCalledOnce();
      expect(updateMock.mock.calls[0][0]).toBe('el-call-001');
    });

    it('persists recording_url for allowed host (elevenlabs.io)', async () => {
      const req = makeRequest(URL, validBody);
      await callEndedPost(req);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(patch.recording_url).toBe('https://recordings.elevenlabs.io/el-call-001.mp3');
    });

    it('persists recording_url as null when absent', async () => {
      const { recordingUrl: _, ...noRecording } = validBody;
      const req = makeRequest(URL, noRecording);
      await callEndedPost(req);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(patch.recording_url).toBeNull();
    });

    it('CR-03: rejects recording_url with a non-allowlisted host — 400, updateCall NOT called', async () => {
      const req = makeRequest(URL, {
        ...validBody,
        recordingUrl: 'https://evil.example.com/steal-audio.mp3',
      });
      const res = await callEndedPost(req);
      expect(res.status).toBe(400);
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('CR-03: accepts recording_url on twilio.com subdomain', async () => {
      updateMock.mockReset().mockResolvedValue(undefined);
      const req = makeRequest(URL, {
        ...validBody,
        recordingUrl: 'https://api.twilio.com/recordings/RE123.mp3',
      });
      const res = await callEndedPost(req);
      expect(res.status).toBe(200);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(patch.recording_url).toBe('https://api.twilio.com/recordings/RE123.mp3');
    });

    it('persists JSON-stringified transcript parseable by TranscriptView', async () => {
      const req = makeRequest(URL, validBody);
      await callEndedPost(req);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(typeof patch.transcript).toBe('string');

      // Round-trip: JSON.parse must yield an array of {speaker, text} objects
      const parsed = JSON.parse(patch.transcript as string) as Array<{ speaker: string; text: string }>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].speaker).toBe('Agent');
      expect(parsed[0].text).toBe('Hello! How can I help?');
      expect(parsed[1].speaker).toBe('Customer');
    });

    it('persists duration_ms and end_at', async () => {
      const req = makeRequest(URL, validBody);
      await callEndedPost(req);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(patch.duration_ms).toBe(180000);
      expect(patch.end_at).toBe('2026-06-12T10:03:00Z');
    });

    it('persists outcome', async () => {
      const req = makeRequest(URL, validBody);
      await callEndedPost(req);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(patch.outcome).toBe('resolved');
    });

    it('persists disconnection_reason', async () => {
      const req = makeRequest(URL, validBody);
      await callEndedPost(req);
      const patch = updateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(patch.disconnection_reason).toBe('customer_hangup');
    });

    it('returns ok:true on success', async () => {
      const req = makeRequest(URL, validBody);
      const res = await callEndedPost(req);
      const body = await res.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
    });
  });
});
