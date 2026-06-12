/**
 * types.ts — Shared admin domain types for the dashboard data layer.
 *
 * IMPORTANT: CallSummary intentionally has NO raw from_number field.
 * PII masking is enforced here in the type system (T-03-07, Pitfall 4).
 * The from_number_masked field is always populated by maskPhone() in the repo.
 */

import type { CallRow } from '@/types/database';

/** Aggregated call metrics for a given time window (today / 7d / 30d). */
export interface CallMetrics {
  received: number;
  answered: number;
  missed: number;
  successRate: number; // 0-100, percentage of answered calls that were resolved
}

/**
 * Client-safe summary of a single customer call.
 * Never includes raw from_number — only the masked representation.
 */
export interface CallSummary {
  id: string;
  start_at: string;
  duration_ms: number | null;
  tracking_ref: string | null;
  outcome: CallRow['outcome'];
  from_number_masked: string; // NEVER raw from_number (Pitfall 4)
}

/** Filter/pagination options for listCustomerCalls(). */
export interface CallListOptions {
  since?: Date;
  until?: Date;
  outcome?: CallRow['outcome'];
  search?: string;
  page?: number;
  pageSize?: number;
}
