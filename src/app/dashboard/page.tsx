import { PeriodTabs } from '@/components/admin/PeriodTabs';
import { MetricCard } from '@/components/admin/MetricCard';
import { CoBrand } from '@/components/CoBrand';
import { getMetrics } from '@/lib/repositories/calls-repo';
import { getWindowStart, type Period } from '@/lib/admin/windows';

const VALID_PERIODS: Period[] = ['today', '7d', '30d'];

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const { period: rawPeriod } = await searchParams;
  const period: Period =
    rawPeriod && VALID_PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : 'today';

  const metrics = await getMetrics(getWindowStart(period));
  const isEmpty = metrics.received === 0;

  return (
    <div>
      {/* Co-brand lockup — Derbyshire Specialist Aggregates × The AI Agency */}
      <div className="mb-8 border-b border-zinc-200 pb-6">
        <CoBrand />
      </div>

      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Metrics</h1>
      <PeriodTabs />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard label="Total received" value={isEmpty ? '—' : metrics.received} />
        <MetricCard label="Answered" value={isEmpty ? '—' : metrics.answered} />
        <MetricCard label="Missed" value={isEmpty ? '—' : metrics.missed} />
        <MetricCard label="Success rate" value={isEmpty ? '—' : `${metrics.successRate}%`} />
      </div>
      {isEmpty && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Metrics will appear here once the voice agent is live and receiving calls.
        </p>
      )}
    </div>
  );
}
