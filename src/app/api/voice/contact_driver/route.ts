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
 * Signature verification delegates to the canonical verifyProviderSignature from
 * webhook-auth.ts (CR-01). Uses the 'default' provider (x-voice-signature bare hex)
 * so this route's tool-call scenario continues to work without requiring the full
 * ElevenLabs structured header.
 */

import { z } from 'zod';
import { parseEnv } from '@/lib/env';
import { verifyProviderSignature } from '@/lib/voice/webhook-auth';
import { runDriverEscalation } from '@/lib/voice/driver-escalation';
import { getDriverById } from '@/lib/repositories/drivers-repo';
import { insertCall } from '@/lib/repositories/calls-repo';
import { MockTelephonyAdapter } from '@/lib/voice/telephony/mock-adapter';

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
  if (!verifyProviderSignature('default', rawBody, req.headers)) {
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
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
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
  // WR-02: Return explicit { contacted: false, reason } so the ElevenLabs agent can
  // check `contacted` before telling the customer the driver was called.
  if (!consented) {
    return new Response(JSON.stringify({ contacted: false, reason: 'consent_not_given' }), {
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
