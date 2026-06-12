/**
 * /api/voice/lookup_consignment — ElevenLabs server tool: delivery lookup.
 *
 * Security (T-04-13, T-04-14, T-04-15):
 * - HMAC signature verified FIRST; unsigned/invalid → 401 before any parse or lookup.
 * - Input validated with zod; invalid → 400.
 * - Response carries ONLY fields from TrackingResult — never fabricates data (VOICE-08).
 *   The structural guarantee: this handler delegates entirely to lookupConsignment which
 *   is the only path to delivery data (D-04). It cannot invent anything.
 *
 * VOICE-08 structural guarantee: the only path from request to response runs through
 * lookupConsignment(). No data is synthesised here.
 */

import { z } from 'zod';
import { verifyProviderSignature } from '@/lib/voice/webhook-auth';
import { lookupConsignment } from '@/lib/tracking/service';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  trackingRef: z.string().min(1),
  postcode: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  // 1. Verify signature FIRST — 401 before any other work (T-04-13)
  const rawBody = await req.text();
  const verified = verifyProviderSignature('default', rawBody, req.headers);
  if (!verified) {
    return new Response(null, { status: 401 });
  }

  // 2. Parse + validate
  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = JSON.parse(rawBody);
    const result = bodySchema.safeParse(json);
    if (!result.success) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. Delegate to service — thin pass-through (VOICE-08)
  const trackingResult = await lookupConsignment({
    trackingRef: parsed.trackingRef,
    postcode: parsed.postcode,
  });

  // 4. Shape only what the TrackingResult provides
  if (!trackingResult.ok) {
    return Response.json({
      ok: false,
      reason: trackingResult.reason,
      // Only include candidates when present (multiple_matches path)
      ...(trackingResult.reason === 'multiple_matches' && trackingResult.candidates
        ? { candidates: trackingResult.candidates }
        : {}),
    });
  }

  const c = trackingResult.consignment;
  return Response.json({
    ok: true,
    consignmentNumber: c.consignmentNumber,
    plainStatus: c.plainStatus,
    description: c.description,
    currentStage: c.currentStage,
    // Null ETAs passed through as-is — never fabricated (VOICE-08 / PITFALLS.md Pitfall 3)
    estimatedDelDate: c.estimatedDelDate,
    startWindow: c.startWindow,
    endWindow: c.endWindow,
  });
}
