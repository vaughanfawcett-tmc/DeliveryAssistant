import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { CallSummary } from '@/lib/admin/types';

interface Props {
  rows: CallSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasActiveFilters?: boolean;
  /** WR-06: serialised filter params (outcome, q, from, to) — merged with page on pagination links */
  baseParams?: string;
}

// Semantic outcome badge colours — never use accent for status (UI-09)
const OUTCOME_STYLES: Record<string, { bg: string; label: string }> = {
  resolved: { bg: 'bg-green-100 text-green-600', label: 'Resolved' },
  no_data: { bg: 'bg-amber-100 text-amber-600', label: 'Missed' },
  escalated: { bg: 'bg-zinc-100 text-zinc-600', label: 'Escalated' },
  failed: { bg: 'bg-zinc-100 text-zinc-600', label: 'Failed' },
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm');
  } catch {
    return iso;
  }
}

function OutcomeBadge({ outcome }: { outcome: CallSummary['outcome'] }) {
  const key = outcome ?? 'failed';
  const style = OUTCOME_STYLES[key] ?? { bg: 'bg-zinc-100 text-zinc-600', label: key };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-sm font-semibold ${style.bg}`}
      aria-label={`Outcome: ${style.label}`}
    >
      {style.label}
    </span>
  );
}

export function CallHistoryTable({ rows, total, page, pageSize, hasActiveFilters, baseParams }: Props) {
  // Empty states — exact UI-SPEC copy
  if (total === 0) {
    return (
      <div className="py-12 text-center">
        {hasActiveFilters ? (
          <>
            <p className="text-base font-semibold text-zinc-900">No calls found</p>
            <p className="text-sm text-zinc-500 mt-1">
              No calls match your filters. Try adjusting the date range or outcome.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            No calls recorded yet. Voice agent data will appear here after Phase 4.
          </p>
        )}
      </div>
    );
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = endItem < total;

  // WR-06: build pagination hrefs that preserve active filter params.
  const prevParams = new URLSearchParams(baseParams ?? '');
  prevParams.set('page', String(page - 1));
  const nextParams = new URLSearchParams(baseParams ?? '');
  nextParams.set('page', String(page + 1));

  return (
    <div>
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700">
                Date / time
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700">Duration</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700">
                Tracking ref
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700">Outcome</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-zinc-700">Caller</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-3 px-4 font-mono text-sm text-zinc-600">
                  {formatDateTime(row.start_at)}
                </td>
                <td className="py-3 px-4 text-sm text-zinc-600">{formatDuration(row.duration_ms)}</td>
                <td className="py-3 px-4 font-mono text-sm text-zinc-900">
                  {row.tracking_ref ?? '—'}
                </td>
                <td className="py-3 px-4">
                  <OutcomeBadge outcome={row.outcome} />
                </td>
                <td className="py-3 px-4 font-mono text-sm text-zinc-500">
                  {row.from_number_masked}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/dashboard/calls/${row.id}`}
                    className="text-accent text-sm underline min-h-[44px] inline-flex items-center"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — shown below 768px */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="border border-zinc-200 rounded-lg p-4 mb-2">
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-sm text-zinc-600">{formatDateTime(row.start_at)}</span>
              <OutcomeBadge outcome={row.outcome} />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Tracking ref</span>
                <span className="font-mono text-zinc-900">{row.tracking_ref ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Duration</span>
                <span className="text-zinc-600">{formatDuration(row.duration_ms)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Caller</span>
                <span className="font-mono text-zinc-500">{row.from_number_masked}</span>
              </div>
            </div>
            <div className="mt-3">
              <Link
                href={`/dashboard/calls/${row.id}`}
                className="text-accent text-sm underline min-h-[44px] inline-flex items-center"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between mt-4 py-3 border-t border-zinc-200">
        <p className="text-sm text-zinc-400">
          Showing {startItem}–{endItem} of {total} calls
        </p>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link
              href={`?${prevParams.toString()}`}
              className="text-sm text-zinc-600 px-3 py-1 border border-zinc-200 rounded hover:bg-zinc-50"
            >
              Previous
            </Link>
          ) : (
            <span className="text-sm text-zinc-600 px-3 py-1 border border-zinc-200 rounded opacity-40 cursor-not-allowed">
              Previous
            </span>
          )}
          {hasNext ? (
            <Link
              href={`?${nextParams.toString()}`}
              className="text-sm text-zinc-600 px-3 py-1 border border-zinc-200 rounded hover:bg-zinc-50"
            >
              Next
            </Link>
          ) : (
            <span className="text-sm text-zinc-600 px-3 py-1 border border-zinc-200 rounded opacity-40 cursor-not-allowed">
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
