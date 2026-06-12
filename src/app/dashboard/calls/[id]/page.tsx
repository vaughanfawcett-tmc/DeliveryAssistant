import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCallById, getDriverCallsForParent } from '@/lib/repositories/calls-repo';
import { maskPhone } from '@/lib/admin/mask';
import { CallDetail } from '@/components/admin/CallDetail';
import { TranscriptView } from '@/components/admin/TranscriptView';
import { RecordingPlayer } from '@/components/admin/RecordingPlayer';
import { DriverCallSubLog } from '@/components/admin/DriverCallSubLog';

// No "use client" — Server Component.
// PII masking happens here, server-side, before any client component (T-03-15, Pitfall 4).

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;

  const call = await getCallById(id);
  if (!call) notFound();

  const driverCalls = await getDriverCallsForParent(id);

  // CRITICAL (Pitfall 4): mask from_number server-side — never pass raw CallRow to any client component
  const callerMasked = maskPhone(call.from_number ?? null);

  return (
    <main className="px-4 py-8 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/calls"
        className="text-accent text-sm hover:underline inline-flex items-center gap-1 mb-6 min-h-[44px]"
      >
        ← Back to call history
      </Link>

      {/* Call metadata — only masked/safe fields passed */}
      <CallDetail
        start_at={call.start_at}
        duration_ms={call.duration_ms}
        tracking_ref={call.tracking_ref}
        outcome={call.outcome}
        callerMasked={callerMasked}
      />

      {/* Transcript — only the transcript string is passed, not the whole row */}
      <div className="mb-6">
        <TranscriptView transcript={call.transcript} />
      </div>

      {/* Recording — Phase 3 stub: no recordings yet (D-03) */}
      <div className="mb-6">
        <RecordingPlayer recordingUrl={null} />
      </div>

      {/* Outbound driver call sub-log */}
      <DriverCallSubLog
        calls={driverCalls.map((dc) => ({
          id: dc.id,
          duration_ms: dc.duration_ms,
          outcome: dc.outcome,
          from_number: dc.from_number,
        }))}
      />
    </main>
  );
}
