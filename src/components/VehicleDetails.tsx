import type { NexusRouteDetail } from '@/types/consignment';

interface Props {
  routeDetails: NexusRouteDetail[];
}

export function VehicleDetails({ routeDetails }: Props) {
  // PORT-07: render only when the API provides a delivery route detail
  const deliveryRoute = routeDetails.find((r) => r.type === 'Delivery');
  if (!deliveryRoute) return null;

  return (
    <section aria-label="Vehicle details" className="text-sm text-zinc-700">
      <h2 className="font-semibold mb-1">Vehicle details</h2>
      <p>
        Registration: <span className="font-mono">{deliveryRoute.regNo}</span>
      </p>
      <p>Route status: {deliveryRoute.status}</p>
    </section>
  );
}
