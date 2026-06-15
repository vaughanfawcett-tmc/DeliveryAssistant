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

  const stage = consignment.currentStage;
  const tone =
    stage === 'delivered'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : stage === 'out_for_delivery'
        ? 'bg-accent/10 text-accent ring-accent/20'
        : 'bg-slate-100 text-slate-600 ring-slate-500/20';

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
        {plainStatus}
      </span>
      <p className="text-base text-slate-700">{description}</p>
      <p className="text-sm text-muted-foreground">
        Estimated delivery:{' '}
        <strong className="font-semibold text-slate-900">{etaDisplay}</strong>
      </p>
    </div>
  );
}
