import { env } from '@/lib/env';
import { LookupForm } from '@/components/LookupForm';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

// No "use client" — Server Component.
// env.CONTACT_PHONE is read server-side and passed as a prop so LookupForm
// (a client component) never imports the server-only env module directly.

export default function Home() {
  const hasVoice = Boolean(env.ELEVENLABS_AGENT_ID);

  return (
    <>
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        {/* Logo lives in the header; keep an accessible page heading. */}
        <h1 className="sr-only">Derbyshire Specialist Aggregates — track your delivery</h1>
        <h2 className="mb-2 text-2xl font-semibold text-zinc-900">
          Where&apos;s my delivery?
        </h2>
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
        <details className="group mt-8 w-full max-w-md">
          <summary
            className="flex h-12 w-full cursor-pointer list-none items-center justify-center gap-2
                       rounded-full border-2 border-accent bg-white px-6 text-base font-semibold text-accent
                       transition-colors hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {/* Magnifier icon */}
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="m17 17-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="group-open:hidden">Track manually instead</span>
            <span className="hidden group-open:inline">Hide manual tracking</span>
          </summary>
          <div className="mt-6 flex justify-center">
            <LookupForm contactPhone={env.CONTACT_PHONE} />
          </div>
        </details>
      </main>

      <SiteFooter contactPhone={env.CONTACT_PHONE} />
    </>
  );
}
