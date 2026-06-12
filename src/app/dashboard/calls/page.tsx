import { listCustomerCalls } from '@/lib/repositories/calls-repo';
import { CallFilters } from '@/components/admin/CallFilters';
import { CallHistoryTable } from '@/components/admin/CallHistoryTable';
import type { CallListOptions } from '@/lib/admin/types';
import type { CallRow } from '@/types/database';

interface Props {
  searchParams: Promise<{
    outcome?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

// WR-03: validate date strings before constructing Date objects.
// new Date('arbitrary') produces an Invalid Date; calling .toISOString() on it throws RangeError.
function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

// Maps the outcome URL value (which may include display labels) to a CallRow outcome
function parseOutcome(value: string | undefined): CallRow['outcome'] | undefined {
  if (!value) return undefined;
  // Accept the raw db values and the 'missed' UI label alias
  const valid = ['resolved', 'escalated', 'no_data', 'failed'] as const;
  if ((valid as readonly string[]).includes(value)) {
    return value as CallRow['outcome'];
  }
  return undefined;
}

export default async function CallHistoryPage({ searchParams }: Props) {
  const sp = await searchParams;

  const rawPage = Number(sp.page ?? '1');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = 25;

  const opts: CallListOptions = {
    page,
    pageSize,
    outcome: parseOutcome(sp.outcome),
    search: sp.q || undefined,
    since: parseDate(sp.from),
    until: parseDate(sp.to),
  };

  const { rows, total } = await listCustomerCalls(opts);

  const hasActiveFilters = !!(sp.outcome || sp.q || sp.from || sp.to);

  // WR-06: build a serialised base param string that carries the active filters
  // so CallHistoryTable can merge only the page change into pagination hrefs.
  const baseParams = new URLSearchParams();
  if (sp.outcome) baseParams.set('outcome', sp.outcome);
  if (sp.q) baseParams.set('q', sp.q);
  if (sp.from) baseParams.set('from', sp.from);
  if (sp.to) baseParams.set('to', sp.to);

  return (
    <main className="px-4 py-8 lg:px-8">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Call history</h1>
      <CallFilters />
      <CallHistoryTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        hasActiveFilters={hasActiveFilters}
        baseParams={baseParams.toString()}
      />
    </main>
  );
}
