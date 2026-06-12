import { notFound } from 'next/navigation';
import { verifyShareToken } from '@/lib/share/token';
import { lookupForShare } from '@/lib/tracking/service';
import { TrackingResult } from '@/components/TrackingResult';

// No "use client" — Server Component.
// The token in the URL contains only the HMAC-signed consignment number and
// expiry — never the postcode (T-02-13, D-12).

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;

  // Verify the token before any Nexus call (T-02-14)
  const consignmentNumber = verifyShareToken(token);
  if (!consignmentNumber) notFound();

  // Re-fetch status without postcode gate (the signed token is the authorisation)
  const result = await lookupForShare(consignmentNumber);
  if (!result.ok) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      {/* readOnly=true: no ShareBar rendered on the share page */}
      <TrackingResult consignment={result.consignment} readOnly />
    </main>
  );
}
