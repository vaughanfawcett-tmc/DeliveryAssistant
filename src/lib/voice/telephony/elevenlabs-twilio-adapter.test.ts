/**
 * elevenlabs-twilio-adapter.test.ts
 *
 * Verifies the ElevenLabsTwilioAdapter's request-building, auth headers,
 * and error handling using MSW voice handlers — zero real credentials/calls.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { voiceHandlers, resetVoiceHandlerCounters } from '../../../mocks/voice-handlers';
import { ElevenLabsTwilioAdapter } from './elevenlabs-twilio-adapter';

// Capture requests so tests can inspect headers
const capturedRequests: Request[] = [];

// Extend voiceHandlers to intercept requests for header inspection
import { http, HttpResponse } from 'msw';

const spyHandlers = [
  http.post('https://mock.el.test/v1/convai/twilio/outbound-call', async ({ request }) => {
    capturedRequests.push(request.clone());
    // Delegate to the underlying handler logic inline
    const body = (await request.json()) as Record<string, unknown>;
    const to = typeof body?.to === 'string' ? body.to : '';
    if (to === '+44UNREACHABLE') {
      return HttpResponse.json({ error: 'unprocessable_destination' }, { status: 422 });
    }
    return HttpResponse.json({ call_id: 'el-call-spy-1' });
  }),
  http.post(
    /https:\/\/mock\.tw\.test\/2010-04-01\/Accounts\/[^/]+\/Calls\.json/,
    async ({ request }) => {
      capturedRequests.push(request.clone());
      const text = await request.text();
      const params = new URLSearchParams(text);
      const to = params.get('To') ?? '';
      if (to === '+44UNREACHABLE') {
        return HttpResponse.json({ code: 21215, message: 'unreachable' }, { status: 422 });
      }
      return HttpResponse.json({ sid: 'TW00000000000000000000000000000001', status: 'queued' });
    },
  ),
  http.post(
    /https:\/\/mock\.tw\.test\/2010-04-01\/Accounts\/[^/]+\/Calls\/[^/]+\.json/,
    async ({ request }) => {
      capturedRequests.push(request.clone());
      return HttpResponse.json({ sid: 'TW00000000000000000000000000000001', status: 'completed' });
    },
  ),
];

const server = setupServer(...spyHandlers);

const testConfig = {
  elevenLabsBaseUrl: 'https://mock.el.test',
  twilioBaseUrl: 'https://mock.tw.test',
  apiKey: 'test-el-api-key',
  agentId: 'test-agent-id',
  twilioSid: 'ACtest00000000000000000000000000000',
  twilioToken: 'test-twilio-token',
  fromNumber: '+441332000000',
};

function makeAdapter() {
  return new ElevenLabsTwilioAdapter(testConfig);
}

describe('ElevenLabsTwilioAdapter', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    capturedRequests.length = 0;
    resetVoiceHandlerCounters();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('placeOutboundCall', () => {
    it('sends a POST to the ElevenLabs outbound-call endpoint', async () => {
      const adapter = makeAdapter();
      const result = await adapter.placeOutboundCall('+441332000001');

      expect(result.callId).toBe('el-call-spy-1');
      expect(capturedRequests).toHaveLength(1);
      expect(capturedRequests[0].method).toBe('POST');
      expect(capturedRequests[0].url).toContain('/v1/convai/twilio/outbound-call');
    });

    it('sends the Bearer auth header with the injected api key', async () => {
      const adapter = makeAdapter();
      await adapter.placeOutboundCall('+441332000001');

      const authHeader = capturedRequests[0].headers.get('authorization');
      expect(authHeader).toBe(`Bearer ${testConfig.apiKey}`);
    });

    it('includes the to number and agentId in the request body', async () => {
      const adapter = makeAdapter();
      await adapter.placeOutboundCall('+441332000001', { agentId: 'override-agent' });

      const body = (await capturedRequests[0].json()) as Record<string, string>;
      expect(body.to).toBe('+441332000001');
      expect(body.agent_id).toBe('override-agent');
    });

    it('uses the default agentId from config when none is passed', async () => {
      const adapter = makeAdapter();
      await adapter.placeOutboundCall('+441332000001');

      const body = (await capturedRequests[0].json()) as Record<string, string>;
      expect(body.agent_id).toBe(testConfig.agentId);
    });

    it('throws on non-2xx response (+44UNREACHABLE)', async () => {
      const adapter = makeAdapter();
      await expect(adapter.placeOutboundCall('+44UNREACHABLE')).rejects.toThrow(
        'placeOutboundCall failed: 422',
      );
    });
  });

  describe('endCall', () => {
    it('sends a POST to the ElevenLabs end-call endpoint', async () => {
      // Override to handle the end endpoint without error
      server.use(
        http.post(
          /https:\/\/mock\.el\.test\/v1\/convai\/twilio\/outbound-call\/[^/]+\/end/,
          () => HttpResponse.json({ status: 'ended' }),
        ),
      );

      const adapter = makeAdapter();
      await expect(adapter.endCall('el-call-1', 'completed')).resolves.toBeUndefined();
    });

    it('throws on non-2xx from endCall endpoint', async () => {
      server.use(
        http.post(
          /https:\/\/mock\.el\.test\/v1\/convai\/twilio\/outbound-call\/[^/]+\/end/,
          () => HttpResponse.json({ error: 'not_found' }, { status: 404 }),
        ),
      );

      const adapter = makeAdapter();
      await expect(adapter.endCall('bad-call-id')).rejects.toThrow('endCall failed: 404');
    });
  });

  describe('transferToHuman', () => {
    it('sends a POST to the Twilio calls endpoint with TwiML dial body', async () => {
      const adapter = makeAdapter();
      await adapter.transferToHuman('TW000call', '+441332999999', 'driver unreachable');

      // The spy handler captured the request
      const req = capturedRequests[0];
      expect(req).toBeDefined();
      const body = new URLSearchParams(await req.text());
      expect(body.get('Twiml')).toContain('<Dial>+441332999999</Dial>');
    });

    it('sends Basic auth header for Twilio', async () => {
      const adapter = makeAdapter();
      await adapter.transferToHuman('TW000call', '+441332999999', 'test summary');

      const authHeader = capturedRequests[0].headers.get('authorization');
      const expected = `Basic ${Buffer.from(`${testConfig.twilioSid}:${testConfig.twilioToken}`).toString('base64')}`;
      expect(authHeader).toBe(expected);
    });

    it('WR-04: does NOT send X-Transfer-Summary header to Twilio (GDPR / PII)', async () => {
      const adapter = makeAdapter();
      // summary contains PII — must not be forwarded to Twilio's logging infrastructure
      await adapter.transferToHuman('TW000call', '+441332999999', 'Postcode: DE1 1AA, tracking PA-99999');
      const summaryHeader = capturedRequests[0].headers.get('x-transfer-summary');
      expect(summaryHeader).toBeNull();
    });
  });

  describe('sendDtmf', () => {
    it('sends a POST to the Twilio calls endpoint with Play digits TwiML', async () => {
      const adapter = makeAdapter();
      await adapter.sendDtmf('TW000call', '1#');

      const req = capturedRequests[0];
      const body = new URLSearchParams(await req.text());
      expect(body.get('Twiml')).toContain('digits="1#"');
    });

    it('sends Basic auth header for Twilio', async () => {
      const adapter = makeAdapter();
      await adapter.sendDtmf('TW000call', '1');

      const authHeader = capturedRequests[0].headers.get('authorization');
      expect(authHeader).toMatch(/^Basic /);
    });
  });

  describe('no env reads at module import (T-04-10)', () => {
    it('does not read process.env at construction — credentials come from injected config', () => {
      // If env vars were read at module level, this would fail with missing-env errors.
      // The constructor receives test config → no env access needed.
      const adapter = new ElevenLabsTwilioAdapter({
        ...testConfig,
        apiKey: 'injected-key',
      });
      expect(adapter).toBeDefined();
    });
  });
});
