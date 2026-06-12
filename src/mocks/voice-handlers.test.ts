/**
 * voice-handlers.test.ts
 *
 * Unit tests for the MSW voiceHandlers — verifying the handler responses and
 * the +44UNREACHABLE trigger work correctly in isolation.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { voiceHandlers, resetVoiceHandlerCounters } from './voice-handlers';

// Use the default mock base URLs that the handlers use (defaults from process.env)
const EL_BASE = 'https://mock.elevenlabs.test';
const TW_BASE = 'https://mock.twilio.test';
const TW_SID = 'ACtest00000000000000000000000000001';

const server = setupServer(...voiceHandlers);

describe('voiceHandlers', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    resetVoiceHandlerCounters();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('ElevenLabs outbound-call handler', () => {
    it('returns a call_id for a valid destination', async () => {
      const res = await fetch(`${EL_BASE}/v1/convai/twilio/outbound-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: '+441332000001', agent_id: 'test-agent' }),
      });

      expect(res.ok).toBe(true);
      const body = (await res.json()) as { call_id: string };
      expect(body.call_id).toBe('el-call-1');
    });

    it('returns incrementing call IDs', async () => {
      const makeCall = (to: string) =>
        fetch(`${EL_BASE}/v1/convai/twilio/outbound-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to }),
        }).then((r) => r.json() as Promise<{ call_id: string }>);

      const [r1, r2] = await Promise.all([
        makeCall('+441332000001'),
        makeCall('+441332000002'),
      ]);

      // Both IDs follow the el-call-N pattern
      expect(r1.call_id).toMatch(/^el-call-/);
      expect(r2.call_id).toMatch(/^el-call-/);
      expect(r1.call_id).not.toBe(r2.call_id);
    });

    it('returns 422 for +44UNREACHABLE destination', async () => {
      const res = await fetch(`${EL_BASE}/v1/convai/twilio/outbound-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: '+44UNREACHABLE' }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('unprocessable_destination');
    });
  });

  describe('Twilio Calls handler', () => {
    it('returns a sid for a valid call', async () => {
      const body = new URLSearchParams({
        To: '+441332000001',
        From: '+441332000000',
        Url: 'https://example.com/twiml',
      });

      const res = await fetch(
        `${TW_BASE}/2010-04-01/Accounts/${TW_SID}/Calls.json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );

      expect(res.ok).toBe(true);
      const data = (await res.json()) as { sid: string; status: string };
      expect(data.sid).toMatch(/^TW/);
      expect(data.status).toBe('queued');
    });

    it('returns 422 for +44UNREACHABLE To number', async () => {
      const body = new URLSearchParams({
        To: '+44UNREACHABLE',
        From: '+441332000000',
        Url: 'https://example.com/twiml',
      });

      const res = await fetch(
        `${TW_BASE}/2010-04-01/Accounts/${TW_SID}/Calls.json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        },
      );

      expect(res.status).toBe(422);
      const data = (await res.json()) as { code: number };
      expect(data.code).toBe(21215);
    });
  });

  describe('handler count (acceptance criteria)', () => {
    it('exports at least 2 http.post handlers', () => {
      // voiceHandlers is an array; verify at least two entries
      expect(voiceHandlers.length).toBeGreaterThanOrEqual(2);
    });
  });
});
