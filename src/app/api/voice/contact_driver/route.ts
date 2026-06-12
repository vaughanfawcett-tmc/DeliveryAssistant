/**
 * contact_driver/route.ts — Signed tool endpoint for driver escalation (DRIV-01..04).
 *
 * Security properties (threat model 04-05):
 * - T-04-19: HMAC signature verified FIRST using VOICE_WEBHOOK_SECRET — unsigned requests
 *   receive 401 immediately, before any escalation or DB operation occurs.
 * - T-04-20: Driver phone is resolved server-side via getDriverById — the caller only
 *   supplies a driverId, never a phone number. Unknown id -> 'failed', no call placed.
 * - T-04-21: Hard limits (DRIVER_CALL_MAX_DURATION_S, DRIVER_CALL_MAX_RETRIES) are read
 *   from env and passed to runDriverEscalation; the machine enforces them.
 * - T-04-22: Every attempt is logged as a driver/outbound calls row with parent_call_id.
 * - T-04-23: consented:false returns { contacted:false } immediately — no call placed.
 *
 * Webhook auth note: Plan 04-04's webhook-auth.ts is in a sibling wave and is NOT
 * available in this worktree. HMAC verification is implemented self-contained below
 * using the same timingSafeEqual pattern as src/lib/share/token.ts.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { parseEnv } from '@/lib/env';
import { runDriverEscalation } from '@/lib/voice/driver-escalation';
import { getDriverById } from '@/lib/repositories/drivers-repo';
import { insertCall } from '@/lib/repositories/calls-repo';
import { MockTelephonyAdapter } from '@/lib/voice/telephony/mock-adapter';

// ---------------------------------------------------------------------------
// Signature verification (self-contained — T-04-19)
// Mirrors the timingSafeEqual pattern from src/lib/share/token.ts.
// ---------------------------------------------------------------------------

/**
 * Verify the HMAC-SHA256 signature on the raw request body.
 *
 * ElevenLabs sends the signature as a hex digest in the X-ElevenLabs-Signature
 * header in the format `t=<timestamp>,v1=<hex>` (similar to Stripe webhook sigs).
 * When no structured header is present, we also accept a bare hex sig in
 * `X-Voice-Signature` for simpler tool-call scenarios.
 *
 * Returns true only when the computed HMAC matches the provided signature
 * using constant-time comparison (prevents timing oracle attacks).
 */
export function verifyVoiceSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  // Try X-ElevenLabs-Signature first (structured: "t=<ts>,v1=<hex>")
  const elevenlabsSig = headers.get('x-elevenlabs-signature');
  if (elevenlabsSig) {
    const v1Match = elevenlabsSig.match(/v1=([0-9a-f]+)/i);
    if (!v1Match) return false;
    const providedSig = v1Match[1];
    const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      const expected = Buffer.from(computed, 'utf8');
      const received = Buffer.from(providedSig.toLowerCase(), 'utf8');
      if (expected.length !== received.length) return false;
      return timingSafeEqual(expected, received);
    } catch {
      return false;
    }
  }

  // Fallback: bare hex in X-Voice-Signature
  const voiceSig = headers.get('x-voice-signature');
  if (voiceSig) {
    const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      const expected = Buffer.from(computed, 'utf8');
      const received = Buffer.from(voiceSig.toLowerCase(), 'utf8');
      if (expected.length !== received.length) return false;
      return timingSafeEqual(expected, received);
    } catch {
      return false;
    }
  }

  // No signature header present
  return false;
}

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------

const ContactDriverBodySchema = z.object({
  parentCallId: z.string().min(1),
  driverId: z.string().min(1),
  consented: z.boolean(),
});

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  // --- 1. Read raw body (needed for HMAC before JSON parse) -----------------
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- 2. Verify signature FIRST (T-04-19) ------------------------------------
  const envVars = parseEnv(process.env as Record<string, string | undefined>);
  if (!verifyVoiceSignature(rawBody, req.headers, envVars.VOICE_WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- 3. Parse and validate body -------------------------------------------
  let parsed: z.infer<typeof ContactDriverBodySchema>;
  try {
    const json = JSON.parse(rawBody) as unknown;
    const result = ContactDriverBodySchema.safeParse(json);
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid request body', details: result.error.flatten() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    parsed = result.data;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { parentCallId, driverId, consented } = parsed;

  // --- 4. Consent gate (DRIV-01 / T-04-23) -----------------------------------
  if (!consented) {
    return new Response(JSON.stringify({ contacted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- 5. Select adapter (MockTelephonyAdapter when PALLEX_MOCK=true) --------
  let adapter;
  if (envVars.PALLEX_MOCK) {
    adapter = new MockTelephonyAdapter();
  } else {
    // Production: dynamically import real adapter to avoid eager env reads in mock mode
    const { createElevenLabsTwilioAdapter } = await import(
      '@/lib/voice/telephony/elevenlabs-twilio-adapter'
    );
    adapter = createElevenLabsTwilioAdapter();
  }

  // --- 6. Run escalation with hard limits from env (DRIV-02/03/04) ----------
  const result = await runDriverEscalation(
    {
      parentCallId,
      driverId,
      maxDurationS: envVars.DRIVER_CALL_MAX_DURATION_S,
      maxRetries: envVars.DRIVER_CALL_MAX_RETRIES,
    },
    {
      adapter,
      getDriverById,
      insertCall,
    },
  );

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
