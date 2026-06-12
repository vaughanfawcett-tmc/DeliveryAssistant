'use server';

import { lookupConsignment, lookupForShare } from '@/lib/tracking/service';
import { createShareToken } from '@/lib/share/token';
import type { TrackingResult } from '@/types/tracking';

/**
 * Server action for the lookup form (PORT-01, D-05).
 *
 * Signature is compatible with useActionState(lookup, null):
 *   prevState — previous TrackingResult (unused; required by the hook contract)
 *   formData  — form submission data
 *
 * Input caps applied before calling the service (PITFALLS.md security: T-02-15).
 * Blank inputs or over-length inputs return not_found — never throw.
 */
export async function lookup(
  prevState: TrackingResult | null,
  formData: FormData,
): Promise<TrackingResult> {
  const trackingRef = ((formData.get('trackingRef') as string | null) ?? '').trim();
  const postcode = ((formData.get('postcode') as string | null) ?? '').trim();

  // Input caps (T-02-15): reject over-length inputs rather than passing to service
  if (!trackingRef || !postcode || trackingRef.length > 30 || postcode.length > 20) {
    return { ok: false, reason: 'not_found' };
  }

  return lookupConsignment({ trackingRef, postcode });
}

/**
 * Server action for PortalView's multiple-match chooser.
 *
 * The consignment number was already validated by the prior postcode-gated
 * lookup in this session — lookupForShare bypasses the postcode gate safely.
 */
export async function lookupByConsignment(consignmentNumber: string): Promise<TrackingResult> {
  // Input cap (WR-01): server actions are publicly addressable POST endpoints, so
  // never trust the caller — reject blank/over-length refs rather than forwarding.
  const ref = (consignmentNumber ?? '').trim();
  if (!ref || ref.length > 30) {
    return { ok: false, reason: 'not_found' };
  }
  return lookupForShare(ref);
}

/**
 * Server action — mint a signed share URL for the given consignment number.
 *
 * Runs server-side so the SHARE_TOKEN_SECRET never reaches the browser (T-02-16).
 */
export async function makeShareUrl(consignmentNumber: string): Promise<string> {
  'use server';
  // Input cap (WR-01): refuse to mint a token for a blank/over-length ref.
  const ref = (consignmentNumber ?? '').trim();
  if (!ref || ref.length > 30) {
    throw new Error('Invalid consignment number for share link');
  }
  return `/track/${createShareToken(ref)}`;
}
