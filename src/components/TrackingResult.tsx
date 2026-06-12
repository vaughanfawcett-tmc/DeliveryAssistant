import type { MappedConsignment } from '@/types/tracking';
import { StatusHeader } from './StatusHeader';
import { MilestoneStepper } from './MilestoneStepper';
import { TimeWindow } from './TimeWindow';
import { EventHistory } from './EventHistory';
import { VehicleDetails } from './VehicleDetails';

interface Props {
  consignment: MappedConsignment;
  readOnly?: boolean; // true on signed share page — hides share slot
}

export function TrackingResult({ consignment, readOnly }: Props) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      {/* Above fold: status + ETA + milestone — PORT-02, D-07 */}
      <StatusHeader consignment={consignment} />
      <MilestoneStepper currentStage={consignment.currentStage} />

      {/* Time window — PORT-03: only when out_for_delivery and both window times are present */}
      {consignment.currentStage === 'out_for_delivery' &&
        consignment.startWindow &&
        consignment.endWindow && (
          <TimeWindow start={consignment.startWindow} end={consignment.endWindow} />
        )}

      {/* Below fold — PORT-04, PORT-07 */}
      <EventHistory routeDetails={consignment.routeDetails} />
      <VehicleDetails routeDetails={consignment.routeDetails} />

      {/* ShareBar wired in Plan 04 — hidden when readOnly */}
      {!readOnly && null}
    </div>
  );
}
