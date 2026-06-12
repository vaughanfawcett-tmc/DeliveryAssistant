'use client';

import { useState } from 'react';
import type { CallRow } from '@/types/database';
import { maskPhone } from '@/lib/admin/mask';

// Only the fields we need — no caller PII beyond managed driver phone
interface DriverCallEntry {
  id: string;
  duration_ms: number | null;
  outcome: CallRow['outcome'];
  // Driver phone (managed data, not PII in the same sense as customer from_number)
  // but we mask it anyway for consistency
  from_number: string | null;
}

interface Props {
  calls: DriverCallEntry[];
}

// Semantic outcome badge colours (UI-09)
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

export function DriverCallSubLog({ calls }: Props) {
  const [expanded, setExpanded] = useState(false);
  const count = calls.length;

  return (
    <section className="border border-zinc-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-6 py-4 bg-zinc-50 hover:bg-zinc-100 transition-colors min-h-[44px]"
      >
        <span className="text-sm font-semibold text-zinc-700">
          Outbound driver calls ({count})
        </span>
        <span className="text-zinc-400 text-sm" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-6 py-4">
          {count === 0 ? (
            <p className="text-sm text-zinc-500">No outbound calls were made for this call.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 text-sm font-semibold text-zinc-700">Phone</th>
                  <th className="text-left py-2 text-sm font-semibold text-zinc-700">Duration</th>
                  <th className="text-left py-2 text-sm font-semibold text-zinc-700">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => {
                  const outcomeKey = call.outcome ?? 'failed';
                  const outcomeStyle = OUTCOME_STYLES[outcomeKey] ?? {
                    bg: 'bg-zinc-100 text-zinc-600',
                    label: outcomeKey,
                  };
                  return (
                    <tr key={call.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 font-mono text-sm text-zinc-600">
                        {maskPhone(call.from_number)}
                      </td>
                      <td className="py-2 text-sm text-zinc-600">
                        {formatDuration(call.duration_ms)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-sm font-semibold ${outcomeStyle.bg}`}
                          aria-label={`Outcome: ${outcomeStyle.label}`}
                        >
                          {outcomeStyle.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
