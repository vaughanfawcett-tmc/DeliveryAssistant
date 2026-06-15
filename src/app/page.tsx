import { env } from '@/lib/env';
import { LookupForm } from '@/components/LookupForm';
import { VoiceAssistant } from '@/components/VoiceAssistant';

// No "use client" — Server Component.
// env.CONTACT_PHONE is read server-side and passed as a prop so LookupForm
// (a client component) never imports the server-only env module directly.

export default function Home() {
  const hasVoice = Boolean(env.ELEVENLABS_AGENT_ID);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      {/* D-03: wordmark slot — replace with logo asset when available */}
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
        Derby Aggregates
      </h1>
      <p className="mb-8 text-center text-zinc-500">
        {hasVoice
          ? 'Call us and our assistant will tell you where your delivery is.'
          : 'Track your delivery.'}
      </p>

      {/* Voice agent is the primary call-to-action. */}
      {hasVoice && (
        <div className="w-full max-w-md">
          <VoiceAssistant agentId={env.ELEVENLABS_AGENT_ID!} />
        </div>
      )}

      {/* Manual tracking — secondary path below the voice CTA. */}
      <details className="mt-8 w-full max-w-md">
        <summary className="cursor-pointer list-none text-center text-sm text-zinc-500 hover:text-zinc-700">
          or track manually
        </summary>
        <div className="mt-6 flex justify-center">
          <LookupForm contactPhone={env.CONTACT_PHONE} />
        </div>
      </details>
    </main>
  );
}
