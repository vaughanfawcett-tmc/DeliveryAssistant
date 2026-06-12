import { format, parseISO } from 'date-fns';
import type { CallRow } from '@/types/database';

// Semantic outcome badge colours (UI-09)
const OUTCOME_STYLES: Record<string, { bg: string; label: string }> = {
  resolved: { bg: 'bg-green-100 text-green-600', label: 'Resolved' },
  no_data: { bg: 'bg-amber-100 text-amber-600', label: 'Missed' },
  escalated: { bg: 'bg-zinc-100 text-zinc-600', label: 'Escalated' },
  failed: { bg: 'bg-zinc-100 text-zinc-600', label: 'Failed' },
};

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm:ss');
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

interface Props {
  start_at: string;
  duration_ms: number | null;
  tracking_ref: string | null;
  outcome: CallRow['outcome'];
  callerMasked: string;
}

export function CallDetail({ start_at, duration_ms, tracking_ref, outcome, callerMasked }: Props) {
  const outcomeKey = outcome ?? 'failed';
  const outcomeStyle = OUTCOME_STYLES[outcomeKey] ?? {
    bg: 'bg-zinc-100 text-zinc-600',
    label: outcomeKey,
  };

  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Date / time', value: <span className="font-mono">{formatDateTime(start_at)}</span> },
    { label: 'Duration', value: formatDuration(duration_ms) },
    {
      label: 'Tracking ref',
      value: (
        <span className="font-mono">{tracking_ref ?? '—'}</span>
      ),
    },
    {
      label: 'Outcome',
      value: (
        <span
          className={`rounded-full px-2 py-0.5 text-sm font-semibold ${outcomeStyle.bg}`}
          aria-label={`Outcome: ${outcomeStyle.label}`}
        >
          {outcomeStyle.label}
        </span>
      ),
    },
    { label: 'Caller', value: <span className="font-mono">{callerMasked}</span> },
  ];

  return (
    <section className="border border-zinc-200 rounded-xl p-6 bg-zinc-50 mb-6">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-zinc-500">{label}</dt>
            <dd className="text-sm font-semibold text-zinc-900 mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
