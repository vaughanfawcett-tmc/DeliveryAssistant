import type { NexusRouteDetail } from './consignment';

export type MilestoneStage =
  | 'booked'
  | 'at_hub'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered';

export const MILESTONE_ORDER: MilestoneStage[] = [
  'booked', 'at_hub', 'in_transit', 'out_for_delivery', 'delivered',
];

export type LookupFailureReason =
  | 'not_found'
  | 'postcode_mismatch'
  | 'multiple_matches'
  | 'api_error';

export interface MappedConsignment {
  consignmentNumber: string;
  plainStatus: string;        // plain-language status label (API-04)
  description: string;        // plain-language description (API-04)
  currentStage: MilestoneStage;
  estimatedDelDate: string | null;
  startWindow: string | null;
  endWindow: string | null;
  routeDetails: NexusRouteDetail[];
}

/**
 * Safe per-candidate detail for the multiple-match chooser (D-10, PORT-05).
 *
 * Contains ONLY non-sensitive distinguishing information — destination town and
 * plain-language status. No postcode or full address is included because the
 * customer has already supplied the postcode to reach this branch; the chooser
 * only needs enough to tell similar consignments apart.
 */
export interface MatchCandidate {
  consignmentNumber: string;
  delAddressTown: string | null;
  plainStatus: string;
}

export type TrackingResult =
  | { ok: true; consignment: MappedConsignment }
  | { ok: false; reason: 'multiple_matches'; candidates: MatchCandidate[] }
  | { ok: false; reason: Exclude<LookupFailureReason, 'multiple_matches'> };
