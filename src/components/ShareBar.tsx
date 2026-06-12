'use client';

import { useState } from 'react';
import { makeShareUrl } from '@/app/actions/lookup';

interface Props {
  consignmentNumber: string;
}

/**
 * ShareBar — copy share link + print button (PORT-08, D-12).
 *
 * - "Copy share link": calls makeShareUrl (server action) to mint a signed
 *   HMAC token server-side (secret never reaches the browser), then writes the
 *   absolute URL to the clipboard.
 * - "Print": triggers window.print(); the print.css and Tailwind print:hidden
 *   class ensure form controls and this bar disappear in the printed output.
 *
 * The entire bar is hidden in print via `print:hidden` (D-12).
 */
export function ShareBar({ consignmentNumber }: Props) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCopy() {
    setLoading(true);
    try {
      const path = await makeShareUrl(consignmentNumber);
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="print:hidden flex gap-3">
      <button
        onClick={handleCopy}
        disabled={loading}
        className="flex-1 h-10 rounded-full border border-accent text-accent text-sm font-medium
                   transition-colors hover:bg-accent/5 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {copied ? 'Link copied!' : loading ? 'Generating…' : 'Copy share link'}
      </button>

      <button
        onClick={handlePrint}
        className="flex-1 h-10 rounded-full border border-zinc-300 text-zinc-700 text-sm font-medium
                   transition-colors hover:border-accent hover:text-accent"
      >
        Print
      </button>
    </div>
  );
}
