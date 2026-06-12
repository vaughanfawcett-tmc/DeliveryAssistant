/**
 * webhook-auth.ts — Constant-time per-provider HMAC webhook verifier.
 *
 * Security properties (T-04-13):
 * - HMAC-SHA256 over the raw request body, keyed on the provider's secret.
 * - Comparison uses crypto.timingSafeEqual to prevent timing oracles.
 * - Length guard prevents timingSafeEqual from throwing when signature
 *   lengths differ (same pattern as src/lib/share/token.ts).
 * - Never throws: all failure paths return false.
 *
 * Provider header mapping:
 *   elevenlabs → elevenlabs-signature  (secret: ELEVENLABS_WEBHOOK_SECRET ?? VOICE_WEBHOOK_SECRET)
 *   twilio     → x-twilio-signature    (secret: VOICE_WEBHOOK_SECRET)
 *   default    → x-voice-signature     (secret: VOICE_WEBHOOK_SECRET)
 */

import { createHmac, timingSafeEqual } from 'crypto';

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
        const signature = headers.get('elevenlabs-signature');
        // Use ElevenLabs-specific secret if set, fall back to VOICE_WEBHOOK_SECRET
        const secret =
          process.env.ELEVENLABS_WEBHOOK_SECRET && process.env.ELEVENLABS_WEBHOOK_SECRET.length > 0
            ? process.env.ELEVENLABS_WEBHOOK_SECRET
            : voiceSecret;
        return verifyVoiceSignature(rawBody, signature, secret);
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
