/**
 * windows.ts — Date window helpers for admin metrics period filtering.
 *
 * Three fixed windows: today, 7 days, 30 days.
 * Uses date-fns (already in package.json) for DST-safe arithmetic.
 */

import { startOfDay, subDays } from 'date-fns';

export type Period = 'today' | '7d' | '30d';

/**
 * Return the start of the given period window.
 * - 'today'  → start of today (midnight local time)
 * - '7d'     → start of day 7 days ago
 * - '30d'    → start of day 30 days ago
 */
export function getWindowStart(period: Period): Date {
  const now = new Date();
  if (period === 'today') return startOfDay(now);
  if (period === '7d') return startOfDay(subDays(now, 7));
  return startOfDay(subDays(now, 30));
}
