import { format, parseISO } from 'date-fns';
import type { MappedConsignment } from '@/types/tracking';

interface Props {
  consignment: MappedConsignment;
}

export function StatusHeader({ consignment }: Props) {
  const { plainStatus, description, estimatedDelDate } = consignment;

  let etaDisplay = 'Date not yet confirmed';
  if (estimatedDelDate) {
    try {
      etaDisplay = format(parseISO(estimatedDelDate), 'EEEE d MMMM');
    } catch {
      etaDisplay = estimatedDelDate;
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold text-zinc-900">{plainStatus}</h1>
      <p className="text-base text-zinc-600">{description}</p>
      <p className="text-sm text-zinc-500">
        Estimated delivery: <strong className="text-zinc-700">{etaDisplay}</strong>
      </p>
    </div>
  );
}
