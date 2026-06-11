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

export type TrackingResult =
  | { ok: true; consignment: MappedConsignment }
  | { ok: false; reason: LookupFailureReason };
