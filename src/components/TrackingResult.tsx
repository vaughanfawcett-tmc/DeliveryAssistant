import type { MappedConsignment } from '@/types/tracking';
import { getDeliveryGeo } from '@/lib/tracking/demo-geo';
import { StatusHeader } from './StatusHeader';
import { DeliveryMap } from './DeliveryMap';
import { MilestoneStepper } from './MilestoneStepper';
import { TimeWindow } from './TimeWindow';
import { EventHistory } from './EventHistory';
import { VehicleDetails } from './VehicleDetails';

interface Props {
  consignment: MappedConsignment;
  readOnly?: boolean; // true on signed share page — hides share slot
}

export function TrackingResult({ consignment }: Props) {
  const hasMap = getDeliveryGeo(consignment.consignmentNumber) !== null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      {/* Above fold: status + ETA + milestone — PORT-02, D-07 */}
      <StatusHeader consignment={consignment} />

      {/* Live map — the focal "where is it" view (demo consignments only). */}
      {hasMap && (
        <DeliveryMap
          consignmentNumber={consignment.consignmentNumber}
          currentStage={consignment.currentStage}
        />
      )}

      <MilestoneStepper currentStage={consignment.currentStage} />

      {/* Estimated delivery window — shown whenever a window is known and the
          parcel is still on its way (in transit / out for delivery). Hidden once
          delivered or while only booked (no confirmed window). */}
      {consignment.startWindow &&
        consignment.endWindow &&
        (consignment.currentStage === 'in_transit' ||
          consignment.currentStage === 'out_for_delivery') && (
          <TimeWindow start={consignment.startWindow} end={consignment.endWindow} />
        )}

      {/* Below fold — PORT-04, PORT-07 */}
      <EventHistory routeDetails={consignment.routeDetails} />
      <VehicleDetails routeDetails={consignment.routeDetails} />

      {/* ShareBar is rendered by PortalView (not here) so this stays a pure
          presentation component; the share page renders it with readOnly and no ShareBar. */}
    </div>
  );
}
