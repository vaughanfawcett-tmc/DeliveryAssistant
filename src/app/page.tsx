import { env } from '@/lib/env';
import { LookupForm } from '@/components/LookupForm';

// No "use client" — Server Component.
// env.CONTACT_PHONE is read server-side and passed as a prop so LookupForm
// (a client component) never imports the server-only env module directly.

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      {/* D-03: wordmark slot — replace with logo asset when available */}
      <h1 className="text-xl font-semibold text-zinc-900 mb-8">
        Derby Aggs — Track your delivery
      </h1>

      <LookupForm contactPhone={env.CONTACT_PHONE} />
    </main>
  );
}
