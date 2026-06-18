'use client';

import type { MilestoneStage } from '@/types/tracking';
import {
  getDeliveryGeo,
  vehiclePosition,
  type DeliveryGeo,
} from '@/lib/tracking/demo-geo';
import {
  Map,
  MapMarker,
  MarkerContent,
  MapRoute,
  MapControls,
} from '@/components/ui/mapcn-layer-markers';

interface Props {
  consignmentNumber: string;
  currentStage: MilestoneStage;
}

const ACCENT = '#009890'; // DSA brand teal — keep in sync with --accent in globals.css
const MUTED = '#94a3b8'; // slate-400

function boundsOf(geo: DeliveryGeo): [[number, number], [number, number]] {
  const lngs = [geo.depot[0], geo.destination[0]];
  const lats = [geo.depot[1], geo.destination[1]];
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export default function DeliveryMapImpl({
  consignmentNumber,
  currentStage,
}: Props) {
  const geo = getDeliveryGeo(consignmentNumber);
  if (!geo) return null;

  const vehicle = vehiclePosition(geo, currentStage);
  const delivered = currentStage === 'delivered';

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-border shadow-sm">
      <Map
        theme="light"
        bounds={boundsOf(geo)}
        fitBoundsOptions={{ padding: 56, maxZoom: 13 }}
        attributionControl={false}
      >
        {/* Travelled leg: depot → vehicle (solid brand) */}
        <MapRoute
          id="travelled"
          coordinates={[geo.depot, vehicle]}
          color={ACCENT}
          width={4}
          opacity={0.9}
        />
        {/* Remaining leg: vehicle → destination (dashed muted) */}
        {!delivered && (
          <MapRoute
            id="remaining"
            coordinates={[vehicle, geo.destination]}
            color={MUTED}
            width={3}
            opacity={0.8}
            dashArray={[1.5, 1.5]}
          />
        )}

        {/* Depot */}
        <MapMarker longitude={geo.depot[0]} latitude={geo.depot[1]}>
          <MarkerContent>
            <div className="flex flex-col items-center">
              <div className="h-3.5 w-3.5 rounded-sm border-2 border-white bg-slate-700 shadow" />
              <span className="mt-1 rounded bg-white/90 px-1 text-[10px] font-medium text-slate-600 shadow-sm">
                {geo.depotLabel}
              </span>
            </div>
          </MarkerContent>
        </MapMarker>

        {/* Destination */}
        <MapMarker
          longitude={geo.destination[0]}
          latitude={geo.destination[1]}
        >
          <MarkerContent>
            <div className="flex flex-col items-center">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow" />
              <span className="mt-1 rounded bg-white/90 px-1 text-[10px] font-medium text-slate-600 shadow-sm">
                {geo.destinationLabel}
              </span>
            </div>
          </MarkerContent>
        </MapMarker>

        {/* Vehicle (live position) */}
        {!delivered && (
          <MapMarker longitude={vehicle[0]} latitude={vehicle[1]}>
            <MarkerContent>
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-accent/40" />
                <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-accent text-[9px] shadow-lg">
                  🚚
                </span>
              </div>
            </MarkerContent>
          </MapMarker>
        )}

        <MapControls position="bottom-right" showZoom />
      </Map>
    </div>
  );
}
