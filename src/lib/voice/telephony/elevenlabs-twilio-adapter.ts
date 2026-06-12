/**
 * elevenlabs-twilio-adapter.ts — VoiceTelephonyAdapter over ElevenLabs + Twilio REST.
 *
 * Security (T-04-09 / T-04-10):
 * - Config is INJECTED at construction — no process.env at module top-level.
 *   The module is safely importable in tests without triggering env validation.
 * - A lazy factory `createElevenLabsTwilioAdapter()` reads env vars at call
 *   time for production use; secrets never land in test snapshots.
 * - Auth credentials are NOT logged anywhere in this file.
 * - The adapter accepts only the configured base URLs — no arbitrary URL
 *   injection from callers, removing SSRF surface (T-04-09).
 *
 * Auth:
 * - ElevenLabs: Bearer <apiKey> in Authorization header
 * - Twilio: HTTP Basic, base64(<accountSid>:<authToken>)
 */

import type { VoiceTelephonyAdapter, OutboundCallResult } from './adapter';

// ---------------------------------------------------------------------------
// Config type (fully injectable — never reads env at module top level)
// ---------------------------------------------------------------------------

export interface ElevenLabsTwilioConfig {
  elevenLabsBaseUrl: string;
  twilioBaseUrl: string;
  /** ElevenLabs API key — used as Bearer token */
  apiKey: string;
  /** ElevenLabs agent ID for outbound calls */
  agentId: string;
  /** Twilio Account SID */
  twilioSid: string;
  /** Twilio Auth Token */
  twilioToken: string;
  /** Twilio phone number to use as caller ID (E.164) */
  fromNumber: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basicAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

async function assertOk(response: Response, context: string): Promise<void> {
  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      // ignore read errors
    }
    throw new Error(
      `[ElevenLabsTwilioAdapter] ${context} failed: ${response.status} ${response.statusText} — ${body}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class ElevenLabsTwilioAdapter implements VoiceTelephonyAdapter {
  private readonly cfg: ElevenLabsTwilioConfig;

  constructor(config: ElevenLabsTwilioConfig) {
    this.cfg = config;
  }

  async placeOutboundCall(to: string, opts?: { agentId?: string }): Promise<OutboundCallResult> {
    const agentId = opts?.agentId ?? this.cfg.agentId;
    const url = `${this.cfg.elevenLabsBaseUrl}/v1/convai/twilio/outbound-call`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({ to, agent_id: agentId }),
    });

    await assertOk(response, 'placeOutboundCall');

    const data = (await response.json()) as { call_id: string };
    return { callId: data.call_id };
  }

  async endCall(callId: string, reason?: string): Promise<void> {
    // ElevenLabs exposes a PATCH /v1/convai/twilio/outbound-call/{callId}/end
    const url = `${this.cfg.elevenLabsBaseUrl}/v1/convai/twilio/outbound-call/${encodeURIComponent(callId)}/end`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({ reason: reason ?? null }),
    });

    await assertOk(response, 'endCall');
  }

  async transferToHuman(callId: string, toNumber: string, summary: string): Promise<void> {
    // Twilio call update — transfer via TwiML redirect
    const url = `${this.cfg.twilioBaseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.cfg.twilioSid)}/Calls/${encodeURIComponent(callId)}.json`;

    const body = new URLSearchParams({
      Twiml: `<Response><Dial>${toNumber}</Dial></Response>`,
    });
    // WR-04: summary intentionally NOT sent to Twilio — Twilio logs all request
    // headers (including custom ones) in their request inspector and data retention.
    // The summary may contain PII (postcodes, transcript excerpts) outside any
    // GDPR data-processing agreement scope for that field. Warm-handoff context is
    // available server-side via the calls-repo audit trail instead.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuth(this.cfg.twilioSid, this.cfg.twilioToken),
      },
      body: body.toString(),
    });

    await assertOk(response, 'transferToHuman');
  }

  async sendDtmf(callId: string, digits: string): Promise<void> {
    // Twilio PlayDtmf via call update with TwiML
    const url = `${this.cfg.twilioBaseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.cfg.twilioSid)}/Calls/${encodeURIComponent(callId)}.json`;

    const body = new URLSearchParams({
      Twiml: `<Response><Play digits="${digits}"/></Response>`,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuth(this.cfg.twilioSid, this.cfg.twilioToken),
      },
      body: body.toString(),
    });

    await assertOk(response, 'sendDtmf');
  }
}

// ---------------------------------------------------------------------------
// Lazy factory for production use — reads env at call time, NEVER at import
// ---------------------------------------------------------------------------

/**
 * createElevenLabsTwilioAdapter — production factory.
 * Call this inside a request handler or server action; never call at module scope.
 * Reads env vars lazily to avoid test-snapshot leaks (T-04-10).
 */
export function createElevenLabsTwilioAdapter(): ElevenLabsTwilioAdapter {
  return new ElevenLabsTwilioAdapter({
    elevenLabsBaseUrl:
      process.env.ELEVENLABS_BASE_URL ?? 'https://api.elevenlabs.io',
    twilioBaseUrl:
      process.env.TWILIO_BASE_URL ?? 'https://api.twilio.com',
    apiKey: process.env.ELEVENLABS_API_KEY ?? '',
    agentId: process.env.ELEVENLABS_AGENT_ID ?? '',
    twilioSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    twilioToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
  });
}
