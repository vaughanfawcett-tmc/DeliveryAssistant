'use client';

import { useState } from 'react';
import type { TrackingResult } from '@/types/tracking';
import { lookupByConsignment } from '@/app/actions/lookup';
import { TrackingResult as TrackingResultComponent } from './TrackingResult';
import { ErrorState } from './ErrorState';
import { ShareBar } from './ShareBar';

interface Props {
  result: TrackingResult;
  contactPhone: string;
}

export function PortalView({ result: initialResult, contactPhone }: Props) {
  const [result, setResult] = useState<TrackingResult>(initialResult);

  async function handleSelect(consignmentNumber: string) {
    const resolved = await lookupByConsignment(consignmentNumber);
    setResult(resolved);
  }

  if (result.ok) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <TrackingResultComponent consignment={result.consignment} />
        <ShareBar consignmentNumber={result.consignment.consignmentNumber} />
      </div>
    );
  }

  return (
    <ErrorState
      reason={result.reason}
      candidates={result.reason === 'multiple_matches' ? result.candidates : undefined}
      onSelect={handleSelect}
      contactPhone={contactPhone}
    />
  );
}
