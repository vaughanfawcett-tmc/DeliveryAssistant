'use client';

import type { LookupFailureReason, MatchCandidate } from '@/types/tracking';

interface Props {
  reason: LookupFailureReason;
  candidates?: MatchCandidate[];
  onSelect?: (consignmentNumber: string) => void;
  /**
   * Contact phone number — supplied by the server parent (TrackingResult page or layout).
   * ErrorState is a client component and must NOT import env directly (server-only module).
   */
  contactPhone: string;
}

const MESSAGES: Record<LookupFailureReason, { heading: string; body: string }> = {
  not_found: {
    heading: "We couldn't find that delivery",
    body: "Check your tracking number and make sure you're using the delivery postcode.",
  },
  postcode_mismatch: {
    heading: "Postcode doesn't match",
    body: "The postcode you entered doesn't match the delivery address for that tracking number.",
  },
  multiple_matches: {
    heading: 'Multiple deliveries found',
    body: 'We found more than one delivery. Please choose yours below.',
  },
  api_error: {
    heading: 'Service unavailable',
    body: "We can't reach the delivery system right now. Please try again in a moment.",
  },
};

export function ErrorState({ reason, candidates, onSelect, contactPhone }: Props) {
  const { heading, body } = MESSAGES[reason];
  const showCallUs = reason === 'not_found' || reason === 'api_error';

  return (
    <div role="alert" className="flex flex-col gap-4 w-full max-w-md">
      <h2 className="text-lg font-semibold text-zinc-900">{heading}</h2>
      <p className="text-zinc-600">{body}</p>

      {/* Multiple-match chooser — D-10: no postcode exposed */}
      {reason === 'multiple_matches' && candidates && (
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li key={c.consignmentNumber}>
              <button
                onClick={() => onSelect?.(c.consignmentNumber)}
                className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200
                           hover:border-accent hover:bg-accent/5 transition-colors"
              >
                <span className="font-mono text-sm">{c.consignmentNumber}</span>
                {c.delAddressTown && (
                  <span className="text-zinc-500 ml-2">— {c.delAddressTown}</span>
                )}
                <span className="block text-xs text-zinc-500 mt-0.5">{c.plainStatus}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Dead-end prevention — D-11: Call us only on not_found/api_error */}
      {showCallUs && (
        <p className="text-sm text-zinc-600">
          Need help?{' '}
          <a href={`tel:${contactPhone}`} className="text-accent underline font-medium">
            Call us on {contactPhone}
          </a>
        </p>
      )}

      {/* Retry link always present */}
      <a href="/" className="text-sm text-accent underline">
        Try again
      </a>
    </div>
  );
}
