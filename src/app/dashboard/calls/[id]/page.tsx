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

// WR-06: Validate UUID format before hitting the DB. Supabase .eq() is
// parameterised (no SQL injection risk) but an invalid UUID still causes a
// Supabase error — rejecting early prevents unnecessary DB traffic and
// avoids any schema information leaking from Supabase error messages.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

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

      {/* Recording — D-08: recording_url set on call_ended; null in mock mode */}
      <div className="mb-6">
        <RecordingPlayer recordingUrl={call.recording_url} />
      </div>

      {/* Outbound driver call sub-log */}
      <DriverCallSubLog
        calls={driverCalls.map((dc) => ({
          id: dc.id,
          duration_ms: dc.duration_ms,
          outcome: dc.outcome,
          // WR-01: mask at server boundary so raw E.164 never enters the serialised React tree
          from_number_masked: maskPhone(dc.from_number ?? null),
        }))}
      />
    </main>
  );
}
