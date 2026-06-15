import { MILESTONE_ORDER, type MilestoneStage } from '@/types/tracking';

const LABELS: Record<MilestoneStage, string> = {
  booked: 'Booked',
  at_hub: 'At hub',
  in_transit: 'On its way',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

interface Props {
  currentStage: MilestoneStage;
}

export function MilestoneStepper({ currentStage }: Props) {
  const activeIdx = MILESTONE_ORDER.indexOf(currentStage);

  return (
    <ol
      className="flex items-center justify-between w-full gap-1"
      aria-label="Delivery progress"
    >
      {MILESTONE_ORDER.map((stage, idx) => {
        const done = idx <= activeIdx;
        const active = idx === activeIdx;
        return (
          <li key={stage} className="flex flex-col items-center flex-1 text-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors
                ${active ? 'bg-accent text-white ring-4 ring-accent/15' : done ? 'bg-accent text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              {done ? '✓' : idx + 1}
            </div>
            <span
              className={`mt-1.5 text-[10px] leading-tight
                ${active ? 'font-semibold text-accent' : done ? 'text-slate-600' : 'text-slate-400'}`}
            >
              {LABELS[stage]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
