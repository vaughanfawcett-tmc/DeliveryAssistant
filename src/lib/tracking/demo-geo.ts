import type { MilestoneStage } from '@/types/tracking';

/**
 * Demo geography for the live tracking map.
 *
 * The mock Nexus API carries no lat/lng, so for the demo we derive a believable
 * journey per consignment: a fixed Derby Aggregates depot, a destination near the
 * delivery postcode, and a vehicle position interpolated from the milestone stage.
 * When real telematics land, this is the only file that changes — the map reads
 * coordinates, not hard-coded demo data.
 */

export interface DeliveryGeo {
  /** [lng, lat] */
  depot: [number, number];
  destination: [number, number];
  depotLabel: string;
  destinationLabel: string;
}

const DERBY_DEPOT: [number, number] = [-1.443, 52.915]; // Pride Park, Derby

export const DEMO_GEO: Record<string, DeliveryGeo> = {
  'PA-12345': {
    depot: DERBY_DEPOT,
    destination: [-1.4769, 52.9228],
    depotLabel: 'Derby depot',
    destinationLabel: 'Derby · DE1',
  },
  'PA-67890': {
    depot: DERBY_DEPOT,
    destination: [-1.327, 52.846],
    depotLabel: 'Derby depot',
    destinationLabel: 'Castle Donington · DE74',
  },
  'PA-99999': {
    depot: DERBY_DEPOT,
    destination: [-1.15, 52.953],
    depotLabel: 'Derby depot',
    destinationLabel: 'Nottingham · NG1',
  },
};

const STAGE_FRACTION: Record<MilestoneStage, number> = {
  booked: 0,
  at_hub: 0.15,
  in_transit: 0.5,
  out_for_delivery: 0.85,
  delivered: 1,
};

export function getDeliveryGeo(consignmentNumber: string): DeliveryGeo | null {
  return DEMO_GEO[consignmentNumber] ?? null;
}

/** Linear interpolation from depot → destination by milestone stage. */
export function vehiclePosition(
  geo: DeliveryGeo,
  stage: MilestoneStage,
): [number, number] {
  const f = STAGE_FRACTION[stage];
  return [
    geo.depot[0] + (geo.destination[0] - geo.depot[0]) * f,
    geo.depot[1] + (geo.destination[1] - geo.depot[1]) * f,
  ];
}
