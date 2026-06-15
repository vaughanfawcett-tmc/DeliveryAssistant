/**
 * /api/voice/demo_lookup — same-origin lookup for the in-browser ElevenLabs
 * voice demo (client tool handler). First-party only: the voice widget runs in
 * our own page and calls this route directly, so no webhook HMAC is required
 * (unlike /api/voice/lookup_consignment, which is the signed phone-path tool).
 *
 * Returns ONLY fields from the TrackingResult — never fabricates data (VOICE-08).
 */

import { z } from 'zod';
import { lookupConsignment } from '@/lib/tracking/service';

const bodySchema = z.object({
  trackingRef: z.string().min(1),
  postcode: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    const result = bodySchema.safeParse(json);
    if (!result.success) {
      return Response.json({ ok: false, reason: 'invalid_request' }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return Response.json({ ok: false, reason: 'invalid_request' }, { status: 400 });
  }

  const trackingResult = await lookupConsignment({
    trackingRef: parsed.trackingRef,
    postcode: parsed.postcode,
  });

  if (!trackingResult.ok) {
    return Response.json({ ok: false, reason: trackingResult.reason });
  }

  const c = trackingResult.consignment;
  return Response.json({
    ok: true,
    consignmentNumber: c.consignmentNumber,
    plainStatus: c.plainStatus,
    description: c.description,
    currentStage: c.currentStage,
    estimatedDelDate: c.estimatedDelDate,
    startWindow: c.startWindow,
    endWindow: c.endWindow,
  });
}
