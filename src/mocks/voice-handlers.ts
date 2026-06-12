/**
 * voice-handlers.ts — MSW handlers for ElevenLabs + Twilio outbound telephony HTTP.
 *
 * Mirrors the lazy-base-url pattern from handlers.ts so the adapters can be
 * tested without real credentials or network access.
 *
 * Special triggers:
 *   - POST to ElevenLabs with body `{ to: "+44UNREACHABLE" }` → 422
 *   - POST to Twilio with body `To=+44UNREACHABLE`             → 422
 * This lets Plan 05 test the driver-unreachable retry/callback branch offline.
 *
 * Usage in tests:
 *   import { setupServer } from 'msw/node';
 *   import { voiceHandlers } from '@/mocks/voice-handlers';
 *   const server = setupServer(...voiceHandlers);
 */

import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Lazy base URL helpers (mirrors handlers.getBaseUrl pattern)
// ---------------------------------------------------------------------------

function elevenLabsBase(): string {
  return process.env.ELEVENLABS_BASE_URL ?? 'https://mock.elevenlabs.test';
}

function twilioBase(): string {
  return process.env.TWILIO_BASE_URL ?? 'https://mock.twilio.test';
}

// ---------------------------------------------------------------------------
// Counter for deterministic call IDs in tests
// ---------------------------------------------------------------------------

let _elCallCounter = 0;
let _twCallCounter = 0;

/** Reset call ID counters (call in afterEach when tests need fresh IDs). */
export function resetVoiceHandlerCounters(): void {
  _elCallCounter = 0;
  _twCallCounter = 0;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const voiceHandlers = [
  /**
   * POST /v1/convai/twilio/outbound-call
   * ElevenLabs outbound call initiation.
   *
   * Expected body (JSON): { to: string; agent_id?: string }
   * Returns: { call_id: string }
   */
  http.post(`${elevenLabsBase()}/v1/convai/twilio/outbound-call`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const to = typeof body?.to === 'string' ? body.to : '';

    if (to === '+44UNREACHABLE') {
      return HttpResponse.json(
        { error: 'unprocessable_destination', message: 'Destination number is unreachable' },
        { status: 422 },
      );
    }

    const callId = `el-call-${++_elCallCounter}`;
    return HttpResponse.json({ call_id: callId });
  }),

  /**
   * POST /2010-04-01/Accounts/{accountSid}/Calls.json
   * Twilio outbound call creation.
   *
   * Expected body (form-encoded): To=+44xxx&From=+44yyy&Url=...
   * Returns: { sid: string, status: string }
   */
  http.post(
    new RegExp(`${twilioBase()}/2010-04-01/Accounts/[^/]+/Calls\\.json`),
    async ({ request }) => {
      const text = await request.text();
      const params = new URLSearchParams(text);
      const to = params.get('To') ?? '';

      if (to === '+44UNREACHABLE') {
        return HttpResponse.json(
          { code: 21215, message: 'Invalid To: +44UNREACHABLE' },
          { status: 422 },
        );
      }

      const sid = `TW${String(++_twCallCounter).padStart(32, '0')}`;
      return HttpResponse.json({ sid, status: 'queued' });
    },
  ),
];
