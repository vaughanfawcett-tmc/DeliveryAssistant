'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const PERIODS = ['today', '7d', '30d'] as const;
const LABELS: Record<(typeof PERIODS)[number], string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
};

export function PeriodTabs() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = (searchParams.get('period') ?? 'today') as (typeof PERIODS)[number];

  return (
    <div className="flex border-b border-zinc-200 mb-6">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => router.push(`${pathname}?period=${p}`)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors
            ${
              current === p
                ? 'text-accent border-b-2 border-accent'
                : 'text-zinc-500 border-transparent hover:text-zinc-700'
            }`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
