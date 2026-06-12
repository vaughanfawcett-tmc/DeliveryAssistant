/**
 * webhook-auth.ts — Constant-time per-provider HMAC webhook verifier.
 *
 * Security properties (T-04-13):
 * - HMAC-SHA256 over the raw request body, keyed on the provider's secret.
 * - Comparison uses crypto.timingSafeEqual to prevent timing oracles.
 * - Length guard prevents timingSafeEqual from throwing when signature
 *   lengths differ (same pattern as src/lib/share/token.ts).
 * - Never throws: all failure paths return false.
 * - CR-02: Timestamp staleness window (±300 s) enforced for ElevenLabs structured
 *   signatures. Replayed payloads older than 5 minutes are rejected.
 *
 * Provider header mapping:
 *   elevenlabs → elevenlabs-signature  structured `t=<ts>,v1=<hex>` format
 *                (secret: ELEVENLABS_WEBHOOK_SECRET ?? VOICE_WEBHOOK_SECRET)
 *   twilio     → x-twilio-signature    bare hex
 *                (secret: VOICE_WEBHOOK_SECRET)
 *   default    → x-voice-signature     bare hex
 *                (secret: VOICE_WEBHOOK_SECRET)
 *
 * ElevenLabs header format (canonical — matches real ElevenLabs webhook docs):
 *   elevenlabs-signature: t=1718000000,v1=<hex>
 * The `t=` field is a Unix timestamp (seconds). Signatures more than
 * MAX_SIG_AGE_SECONDS old are rejected to prevent indefinite replay attacks (CR-02).
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Maximum age (in seconds) for ElevenLabs structured signatures (CR-02). */
const MAX_SIG_AGE_SECONDS = 300;

// ---------------------------------------------------------------------------
// Core: signature computation
// ---------------------------------------------------------------------------

function computeSignature(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

// ---------------------------------------------------------------------------
// Public API: raw verifier
// ---------------------------------------------------------------------------

/**
 * Verify that `signature` is the HMAC-SHA256 of `rawBody` under `secret`.
 *
 * Returns false (never throws) on:
 * - null or empty signature
 * - empty secret
 * - length mismatch (length guard before timingSafeEqual)
 * - hash mismatch (constant-time)
 */
export function verifyVoiceSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  try {
    if (!signature) return false;

    const expectedSig = computeSignature(rawBody, secret);

    // Constant-time comparison — timingSafeEqual requires equal-length Buffers.
    // Guard against length mismatch before calling it (same pattern as token.ts).
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== receivedBuf.length) return false;

    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    // Any unexpected error (bad encoding, etc.) -> false
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API: per-provider verifier (reads env lazily)
// ---------------------------------------------------------------------------

/**
 * Verify the webhook signature for a given provider.
 *
 * Reads the correct header and secret for the provider, then delegates to
 * verifyVoiceSignature. Secrets are read lazily from process.env so tests
 * can stub them without a module-cache reset.
 *
 * For the 'elevenlabs' provider, the header MUST use the structured format:
 *   elevenlabs-signature: t=<unix_ts>,v1=<hex>
 * Both `t=` and `v1=` fields are required. The timestamp is checked against
 * the current clock; signatures older than MAX_SIG_AGE_SECONDS are rejected
 * regardless of HMAC validity (CR-02 replay protection).
 *
 * @param provider   'elevenlabs' | 'twilio' | 'default'
 * @param rawBody    The raw request body string (before JSON.parse)
 * @param headers    The incoming request Headers object
 * @returns          true if verified, false otherwise (never throws)
 */
export function verifyProviderSignature(
  provider: 'elevenlabs' | 'twilio' | 'default',
  rawBody: string,
  headers: Headers,
): boolean {
  try {
    const voiceSecret =
      process.env.VOICE_WEBHOOK_SECRET ?? '';

    switch (provider) {
      case 'elevenlabs': {
        // ElevenLabs canonical header: elevenlabs-signature: t=<ts>,v1=<hex>
        const sigHeader = headers.get('elevenlabs-signature') ?? '';
        const tMatch = sigHeader.match(/t=(\d+)/);
        const v1Match = sigHeader.match(/v1=([0-9a-f]+)/i);

        // Both fields are required (CR-02: timestamp is mandatory)
        if (!tMatch || !v1Match) return false;

        // Timestamp staleness check (CR-02): reject replays older than 5 minutes
        const signedAt = parseInt(tMatch[1], 10);
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - signedAt) > MAX_SIG_AGE_SECONDS) return false;

        // Use ElevenLabs-specific secret if set, fall back to VOICE_WEBHOOK_SECRET
        const secret =
          process.env.ELEVENLABS_WEBHOOK_SECRET && process.env.ELEVENLABS_WEBHOOK_SECRET.length > 0
            ? process.env.ELEVENLABS_WEBHOOK_SECRET
            : voiceSecret;
        return verifyVoiceSignature(rawBody, v1Match[1], secret);
      }

      case 'twilio': {
        const signature = headers.get('x-twilio-signature');
        return verifyVoiceSignature(rawBody, signature, voiceSecret);
      }

      case 'default':
      default: {
        const signature = headers.get('x-voice-signature');
        return verifyVoiceSignature(rawBody, signature, voiceSecret);
      }
    }
  } catch {
    return false;
  }
}
