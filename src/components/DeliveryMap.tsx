'use client';

import dynamic from 'next/dynamic';
import type { MilestoneStage } from '@/types/tracking';

/**
 * Client-only wrapper for the live delivery map. MapLibre touches `window`, so
 * the actual implementation is loaded with ssr:false to keep it out of the
 * server render. A lightweight skeleton holds the layout while it loads.
 */
const DeliveryMapImpl = dynamic(() => import('./DeliveryMapImpl'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-2xl border border-border bg-muted" />
  ),
});

interface Props {
  consignmentNumber: string;
  currentStage: MilestoneStage;
}

export function DeliveryMap(props: Props) {
  return <DeliveryMapImpl {...props} />;
}
