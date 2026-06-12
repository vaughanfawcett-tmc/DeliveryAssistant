/**
 * token.ts — Signed share-token codec (PORT-08, D-12).
 *
 * Produces and verifies short-lived HMAC-SHA256 tokens that authorise a
 * postcode-gate-free re-fetch of a single consignment's status.
 *
 * Token format: <base64url(JSON({c, exp}))>.<base64url(HMAC-SHA256)>
 *
 * Security properties:
 * - The token encodes ONLY the consignment number (c) and expiry (exp) —
 *   never the postcode or any other PII (T-02-06).
 * - HMAC-SHA256 is keyed on env.SHARE_TOKEN_SECRET (server-only) so forgery
 *   requires knowledge of the secret (T-02-04).
 * - The signature covers the full payload, so altering `c` invalidates the
 *   signature (T-02-05, tamper rejection).
 * - Comparison uses crypto.timingSafeEqual to prevent timing oracles (T-02-04).
 * - Tokens expire after DEFAULT_TTL seconds; replay value is low because the
 *   share view exposes only read-only status — no PII (T-02-08).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';

const SEP = '.';
const DEFAULT_TTL = 60 * 60 * 24; // 24 hours

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sign(payload: string): string {
  return createHmac('sha256', env.SHARE_TOKEN_SECRET).update(payload).digest('base64url');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a signed share token for the given consignment number.
 *
 * @param consignmentNumber  The consignment to authorise a share view for.
 * @param ttlSeconds         Token lifetime in seconds (default 24 h). Pass a
 *                           negative value to produce an already-expired token
 *                           (useful in tests).
 * @returns  A `<base64url-payload>.<base64url-sig>` string.
 */
export function createShareToken(
  consignmentNumber: string,
  ttlSeconds: number = DEFAULT_TTL,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ c: consignmentNumber, exp })).toString('base64url');
  const sig = sign(payload);
  return `${payload}${SEP}${sig}`;
}

/**
 * Verify a share token and return the encoded consignment number.
 *
 * Returns null (never throws) on any of:
 * - Missing or extra separators (malformed)
 * - Signature mismatch (forgery or tamper)
 * - JSON parse failure (malformed payload)
 * - Missing required fields in payload
 * - Expired token (exp <= now)
 */
export function verifyShareToken(token: string): string | null {
  try {
    const sepIndex = token.indexOf(SEP);
    // No separator, or separator is at start/end, or more than one separator
    if (sepIndex <= 0 || sepIndex === token.length - 1) {
      return null;
    }
    // Ensure exactly one separator: the substring after the first SEP should
    // not contain another SEP.
    const payload = token.slice(0, sepIndex);
    const receivedSig = token.slice(sepIndex + 1);
    if (receivedSig.includes(SEP)) {
      return null;
    }

    // Recompute signature over the received payload
    const expectedSig = sign(payload);

    // Constant-time comparison to prevent timing oracles (T-02-04)
    // timingSafeEqual requires equal-length Buffers; guard against length mismatch
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const receivedBuf = Buffer.from(receivedSig, 'utf8');
    if (expectedBuf.length !== receivedBuf.length) {
      return null;
    }
    if (!timingSafeEqual(expectedBuf, receivedBuf)) {
      return null;
    }

    // Decode and parse the payload (only after signature is verified)
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;

    // Validate payload shape
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof (decoded as Record<string, unknown>).c !== 'string' ||
      typeof (decoded as Record<string, unknown>).exp !== 'number'
    ) {
      return null;
    }

    const { c, exp } = decoded as { c: string; exp: number };

    // Reject expired tokens
    if (exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return c;
  } catch {
    // Any unexpected error (Buffer.from failure, JSON.parse etc.) -> null
    return null;
  }
}
