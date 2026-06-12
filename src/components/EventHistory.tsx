import type { NexusRouteDetail } from '@/types/consignment';

interface Props {
  routeDetails: NexusRouteDetail[];
}

export function EventHistory({ routeDetails }: Props) {
  if (routeDetails.length === 0) return null;

  // Reverse-chronological — PORT-04; do not mutate the prop
  const sorted = [...routeDetails].reverse();

  return (
    <section aria-label="Scan history">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">Scan history</h2>
      <ol className="flex flex-col gap-3">
        {sorted.map((event, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <time className="text-zinc-500 w-24 shrink-0">{event.routeDate}</time>
            <span className="text-zinc-900">
              {event.status} — {event.type}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
