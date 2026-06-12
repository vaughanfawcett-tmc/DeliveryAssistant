/**
 * /api/voice/call_ended — Lifecycle webhook: finalise call with transcript/outcome.
 *
 * Security (T-04-13): HMAC signature verified FIRST; unsigned/invalid → 401
 * before any parse or DB write.
 *
 * Persistence (D-07, T-04-16 repudiation): updates the calls row with:
 * - end_at, duration_ms, outcome, disconnection_reason
 * - transcript (JSON-stringified array of {speaker, text, ts?} — shape that
 *   TranscriptView's parseTranscript expects)
 * - recording_url (provider URL; null in mock mode — D-08)
 *
 * Repudiation guard (T-04-16): every call has an auditable transcript +
 * outcome + disconnection_reason on call_ended.
 */

import { z } from 'zod';
import { verifyProviderSignature } from '@/lib/voice/webhook-auth';
import { updateCall } from '@/lib/repositories/calls-repo';
import type { TranscriptTurn } from '@/lib/voice/types';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const transcriptTurnSchema = z.object({
  speaker: z.enum(['Agent', 'Customer']),
  text: z.string(),
  ts: z.string().optional(),
});

const bodySchema = z.object({
  platformCallId: z.string().min(1),
  endAt: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  outcome: z.enum(['resolved', 'escalated', 'no_data', 'failed']),
  transcript: z.array(transcriptTurnSchema),
  recordingUrl: z.string().optional(),
  disconnectionReason: z.string().optional(),
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

  // 3. Allowlist-validate recording_url to prevent SSRF via injected URLs (CR-03)
  const ALLOWED_RECORDING_HOSTS = ['.elevenlabs.io', '.twilio.com'];
  if (parsed.recordingUrl) {
    let recordingUrlObj: URL;
    try {
      recordingUrlObj = new URL(parsed.recordingUrl);
    } catch {
      return Response.json({ error: 'Invalid recording URL' }, { status: 400 });
    }
    const allowed = ALLOWED_RECORDING_HOSTS.some((suffix) =>
      recordingUrlObj.hostname.endsWith(suffix),
    );
    if (!allowed) {
      return Response.json({ error: 'Invalid recording URL host' }, { status: 400 });
    }
  }

  // 4. Serialise transcript as the JSON array shape TranscriptView parses
  const transcriptTurns: TranscriptTurn[] = parsed.transcript.map((t) => ({
    speaker: t.speaker,
    text: t.text,
    ...(t.ts !== undefined ? { ts: t.ts } : {}),
  }));

  // 5. Update the call row (T-04-16 auditable record)
  await updateCall(parsed.platformCallId, {
    end_at: parsed.endAt,
    duration_ms: parsed.durationMs,
    outcome: parsed.outcome,
    transcript: JSON.stringify(transcriptTurns),
    recording_url: parsed.recordingUrl ?? null,
    disconnection_reason: parsed.disconnectionReason ?? null,
  });

  return Response.json({ ok: true });
}
