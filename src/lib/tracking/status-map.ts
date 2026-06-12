/**
 * status-map.ts — Maps raw Nexus status.name values to plain-language labels
 * and the 5-stage milestone (API-04).
 *
 * The 5 canonical milestone stages in order (MILESTONE_ORDER):
 *   booked -> at_hub -> in_transit -> out_for_delivery -> delivered
 *
 * PITFALLS.md Pitfall 3: unknown status values must NEVER throw and must NEVER
 * invent ETAs or fabricate data. A safe fallback is returned instead, and the
 * unknown value is logged as a console warning so new API statuses surface.
 */

import type { MilestoneStage } from '../../types/tracking';

export interface StatusMapping {
  stage: MilestoneStage;
  plainStatus: string;
  description: string;
}

/**
 * Lookup table: normalised (lowercase) Nexus status.name -> StatusMapping.
 * Keys are the lowercase-trimmed raw values returned by the Nexus API.
 */
const STATUS_TABLE: Record<string, StatusMapping> = {
  booked: {
    stage: 'booked',
    plainStatus: 'Booked',
    description: 'Your delivery has been booked and is awaiting collection.',
  },
  'at hub': {
    stage: 'at_hub',
    plainStatus: 'At hub',
    description: 'Your delivery is at one of our hubs and is being sorted.',
  },
  'at depot': {
    stage: 'at_hub',
    plainStatus: 'At depot',
    description: 'Your delivery is at a depot and is being prepared for onward transport.',
  },
  'in transit': {
    stage: 'in_transit',
    plainStatus: 'On its way',
    description: 'Your delivery is on its way to you.',
  },
  'out for delivery': {
    stage: 'out_for_delivery',
    plainStatus: 'Out for delivery',
    description: 'Your delivery is out for delivery today.',
  },
  delivered: {
    stage: 'delivered',
    plainStatus: 'Delivered',
    description: 'Your delivery has been completed.',
  },
};

/**
 * Safe fallback used when a raw status.name value is not in the lookup table.
 * Never throws. Never invents ETAs. Logs a warning to surface unmapped values.
 */
const UNKNOWN_STATUS_FALLBACK: StatusMapping = {
  stage: 'in_transit',
  plainStatus: 'Status update',
  description: 'Your delivery is being processed. Please check back shortly.',
};

/**
 * Map a raw Nexus `status.name` value to a plain-language status label,
 * description, and the 5-stage milestone stage.
 *
 * @param rawName  The `status.name` string from the Nexus API response
 * @returns  A StatusMapping — guaranteed never to throw
 */
export function mapStatusName(rawName: string): StatusMapping {
  const key = rawName.trim().toLowerCase();
  const mapping = STATUS_TABLE[key];
  if (!mapping) {
    console.warn(`[status-map] Unmapped Nexus status.name: "${rawName}" — using safe fallback`);
    return UNKNOWN_STATUS_FALLBACK;
  }
  return mapping;
}
