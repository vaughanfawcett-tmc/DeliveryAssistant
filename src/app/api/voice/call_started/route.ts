/**
 * /api/voice/call_started — Lifecycle webhook: persist incoming customer call.
 *
 * Security (T-04-13): HMAC signature verified FIRST; unsigned/invalid → 401
 * before any parse or DB write.
 *
 * Persistence (D-07): inserts a calls row with call_type:'customer',
 * direction:'inbound'. Throws on insert error (call records must save).
 */

import { z } from 'zod';
import { verifyProviderSignature } from '@/lib/voice/webhook-auth';
import { insertCall } from '@/lib/repositories/calls-repo';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  platformCallId: z.string().min(1),
  fromNumber: z.string().optional(),
  startAt: z.string().min(1),
  trackingRef: z.string().optional(),
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
      return Response.json({ error: 'Invalid request body', issues: result.error.issues }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. Persist the call row (D-07, DRIV-04 customer leg)
  await insertCall({
    platform_call_id: parsed.platformCallId,
    from_number: parsed.fromNumber ?? null,
    direction: 'inbound',
    call_type: 'customer',
    start_at: parsed.startAt,
    end_at: null,
    duration_ms: null,
    outcome: null,
    tracking_ref: parsed.trackingRef ?? null,
    transcript: null,
    recording_url: null,
    disconnection_reason: null,
    parent_call_id: null,
  });

  return Response.json({ ok: true });
}
