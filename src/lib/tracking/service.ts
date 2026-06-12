/**
 * service.ts — Tracking Service (API-02, API-03, API-04).
 *
 * Orchestrates the full lookup flow:
 *   1. Search Nexus by tracking ref (API-02)
 *   2. Verify supplied postcode against delAddressPostcode BEFORE shaping any
 *      data (API-03 — postcode gate must run before mapStatusName, T-01-13)
 *   3. Map raw status to plain-language label + 5-stage milestone (API-04)
 *   4. Log every outcome exactly once (API-07 / T-01-16)
 *
 * PITFALLS.md Pitfall 3: null ETAs are passed through as-is; api_error never
 * fabricates a status or ETA; unknown status.name values are handled by the
 * safe fallback in status-map.ts.
 *
 * ARCHITECTURE.md Pattern 1: this is the single shared service called by both
 * the Phase 2 portal and the Phase 4 voice tool.
 */

import type { TrackingResult, MappedConsignment } from '../../types/tracking';
import type { NexusLookupResult } from '../nexus/client';
import type { LookupOutcome, LogLookupInput } from '../repositories/lookup-log';
import { normalisePostcode, postcodesMatch } from './postcode';
import { mapStatusName as defaultMapStatusName } from './status-map';

// ---------------------------------------------------------------------------
// Factory types
// ---------------------------------------------------------------------------

export interface TrackingServiceDeps {
  /** Injected Nexus lookup function (real or spy in tests). */
  nexusLookup: (searchTerm: string) => Promise<NexusLookupResult>;
  /** Injected logLookup function (real or spy in tests). */
  logLookup: (input: LogLookupInput) => Promise<void>;
  /**
   * Injected mapStatusName function — optional, defaults to the real
   * implementation. Tests may inject a spy here to verify the postcode gate
   * prevents mapStatusName from being called on mismatch (T-01-13).
   */
  mapStatusName?: typeof defaultMapStatusName;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a tracking service with injected dependencies.
 * Use this in tests to pass spies for nexusLookup, logLookup, and mapStatusName.
 */
export function createTrackingService(deps: TrackingServiceDeps) {
  const {
    nexusLookup,
    logLookup,
    mapStatusName = defaultMapStatusName,
  } = deps;

  async function lookupConsignment(input: {
    trackingRef: string;
    postcode: string;
  }): Promise<TrackingResult> {
    const { trackingRef, postcode } = input;

    // Normalise the supplied postcode once upfront for use in the gate + logging
    const normalisedPostcode = normalisePostcode(postcode);

    // Step 1: Call Nexus (plan 02 client — authenticated, breaker-wrapped, validated)
    const nexusResult = await nexusLookup(trackingRef);

    // Step 2a: Nexus unavailable — return api_error without shaping any data (Pitfall 3)
    if (!nexusResult.ok) {
      if (nexusResult.error === 'nexus_unavailable') {
        await logLookup({ trackingRef, postcode: normalisedPostcode, success: false, outcome: 'api_error' });
        return { ok: false, reason: 'api_error' };
      }

      // Step 2b: not_found
      await logLookup({ trackingRef, postcode: normalisedPostcode, success: false, outcome: 'not_found' });
      return { ok: false, reason: 'not_found' };
    }

    // Step 3: Multiple matches — no auto-pick (T-01-15); log under not_found bucket
    // until Phase 2 adds disambiguation (multiple_matches surfaced to caller)
    if (nexusResult.consignments.length > 1) {
      // multiple_matches surfaced to caller; logged under not_found bucket until Phase 2 adds disambiguation
      await logLookup({ trackingRef, postcode: normalisedPostcode, success: false, outcome: 'not_found' });
      return { ok: false, reason: 'multiple_matches' };
    }

    const consignment = nexusResult.consignments[0];

    // Step 4: POSTCODE GATE — MUST run BEFORE mapStatusName so no status data is
    // shaped for a non-matching postcode (success criterion 2, T-01-13)
    if (!postcodesMatch(postcode, consignment.delAddressPostcode)) {
      await logLookup({ trackingRef, postcode: normalisedPostcode, success: false, outcome: 'postcode_mismatch' });
      return { ok: false, reason: 'postcode_mismatch' };
    }

    // Step 5: Gate passed — now it is safe to shape the status data
    const { stage, plainStatus, description } = mapStatusName(consignment.status.name);

    const mapped: MappedConsignment = {
      consignmentNumber: consignment.consignmentNumber,
      plainStatus,
      description,
      currentStage: stage,
      // Null ETAs are passed through as-is — NEVER fabricated (PITFALLS.md Pitfall 3)
      estimatedDelDate: consignment.estimatedDelDate,
      startWindow: consignment.startWindow,
      endWindow: consignment.endWindow,
      routeDetails: consignment.routeDetails,
    };

    await logLookup({ trackingRef, postcode: normalisedPostcode, success: true, outcome: 'found' });
    return { ok: true, consignment: mapped };
  }

  return { lookupConsignment };
}

// ---------------------------------------------------------------------------
// Default singleton bound to the real dependencies (lazy to avoid env access)
// ---------------------------------------------------------------------------

let _defaultService: ReturnType<typeof createTrackingService> | undefined;

async function getDefaultService(): Promise<ReturnType<typeof createTrackingService>> {
  if (!_defaultService) {
    const [{ getConsignmentsBySearchTerm }, { logLookup }] = await Promise.all([
      import('../nexus/client'),
      import('../repositories/lookup-log'),
    ]);
    _defaultService = createTrackingService({ nexusLookup: getConsignmentsBySearchTerm, logLookup });
  }
  return _defaultService;
}

/**
 * Look up a consignment by tracking ref + postcode.
 *
 * This is the public API consumed by Phase 2 (portal) and Phase 4 (voice tool).
 *
 * @param input.trackingRef  The consignment number or search term
 * @param input.postcode     The postcode supplied by the caller (user input)
 * @returns  TrackingResult — ok:true with mapped consignment, or ok:false with reason
 */
export async function lookupConsignment(input: {
  trackingRef: string;
  postcode: string;
}): Promise<TrackingResult> {
  const service = await getDefaultService();
  return service.lookupConsignment(input);
}
