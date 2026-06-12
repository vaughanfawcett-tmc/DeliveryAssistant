'use client';

import { useActionState } from 'react';
import { lookup } from '@/app/actions/lookup';
import { PortalView } from './PortalView';

interface Props {
  contactPhone: string;
}

export function LookupForm({ contactPhone }: Props) {
  const [result, formAction, pending] = useActionState(lookup, null);

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <form action={formAction} className="flex flex-col gap-4 w-full">
        <div>
          <label htmlFor="trackingRef" className="block text-sm font-medium text-zinc-700">
            Tracking number
          </label>
          <input
            id="trackingRef"
            name="trackingRef"
            type="text"
            required
            maxLength={30}
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
                       focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label htmlFor="postcode" className="block text-sm font-medium text-zinc-700">
            Delivery postcode
          </label>
          <input
            id="postcode"
            name="postcode"
            type="text"
            required
            maxLength={20}
            autoComplete="postal-code"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
                       focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {/* D-06: minimal inline guidance */}
          <p className="text-sm text-zinc-500 mt-1">
            Enter the postcode where we&apos;re delivering to.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full h-12 rounded-full bg-accent text-white font-medium
                     transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Checking…' : 'Track delivery'}
        </button>
      </form>

      {result && <PortalView result={result} contactPhone={contactPhone} />}
    </div>
  );
}
