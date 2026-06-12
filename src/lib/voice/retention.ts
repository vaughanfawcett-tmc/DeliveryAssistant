/**
 * GDPR/PECR retention helper for call recordings and transcripts (D-12, T-04-26).
 *
 * Policy: recordings and transcripts are retained for 30 days after the call,
 * then purged. This module provides the pure calculation helpers.
 *
 * IMPORTANT — activation is a human/ops runbook step (D-12 / SC-6):
 *   The scheduled purge job that actually deletes rows/files must be enabled
 *   by an operator following 04-PRODUCTION-RUNBOOK.md Step 5.
 *   This module is intentionally I/O-free — it cannot activate itself.
 *
 * Usage example (purge job):
 *   import { retentionCutoff } from '@/lib/voice/retention';
 *   const cutoff = retentionCutoff();   // rows with recorded_at < cutoff can be deleted
 */

/** Number of days recordings and transcripts are retained (GDPR/PECR policy). */
export const RETENTION_DAYS = 30;

/**
 * Returns the cutoff Date before which recordings/transcripts may be purged.
 *
 * Any call record whose `recorded_at` timestamp is earlier than this date
 * has exceeded the retention window and is eligible for deletion.
 *
 * @param now - Reference time (defaults to current UTC time). Pass a fixed
 *              value in tests and scheduled jobs for deterministic results.
 */
export function retentionCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff;
}

/**
 * Returns true if a recording is outside the retention window and may be purged.
 *
 * @param recordedAt - ISO-8601 timestamp string of when the call was recorded.
 * @param now        - Reference time (defaults to current UTC time).
 */
export function isExpired(recordedAt: string, now: Date = new Date()): boolean {
  const recorded = new Date(recordedAt);
  const cutoff = retentionCutoff(now);
  // A recording is expired when it was recorded strictly before the cutoff.
  return recorded < cutoff;
}
