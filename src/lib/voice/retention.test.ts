import { describe, it, expect } from 'vitest';
import { RETENTION_DAYS, retentionCutoff, isExpired } from './retention';

describe('RETENTION_DAYS', () => {
  it('is exactly 30 (GDPR/PECR policy)', () => {
    expect(RETENTION_DAYS).toBe(30);
  });
});

describe('retentionCutoff', () => {
  it('returns a Date exactly RETENTION_DAYS before the reference time', () => {
    const now = new Date('2026-06-12T12:00:00Z');
    const cutoff = retentionCutoff(now);
    const expectedCutoff = new Date('2026-05-13T12:00:00Z');
    expect(cutoff.getTime()).toBe(expectedCutoff.getTime());
  });

  it('defaults to current time when no argument is provided', () => {
    const before = Date.now();
    const cutoff = retentionCutoff();
    const after = Date.now();

    // Cutoff should be approximately 30 days ago
    const thirtyDaysMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - thirtyDaysMs - 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - thirtyDaysMs + 1000);
  });

  it('does not mutate the input date', () => {
    const now = new Date('2026-06-12T12:00:00Z');
    const originalTime = now.getTime();
    retentionCutoff(now);
    expect(now.getTime()).toBe(originalTime);
  });
});

describe('isExpired', () => {
  // Reference: now = 2026-06-12T00:00:00Z
  // Cutoff    = 2026-05-13T00:00:00Z
  const NOW = new Date('2026-06-12T00:00:00Z');

  it('returns false for a recording 29 days ago (within window)', () => {
    // 29 days before now = 2026-05-14T00:00:00Z (after cutoff)
    const recordedAt = new Date(NOW);
    recordedAt.setDate(recordedAt.getDate() - 29);
    expect(isExpired(recordedAt.toISOString(), NOW)).toBe(false);
  });

  it('returns false for a recording exactly 30 days ago (on boundary — not yet expired)', () => {
    // Exactly at cutoff = not strictly before cutoff, so NOT expired
    const recordedAt = new Date(NOW);
    recordedAt.setDate(recordedAt.getDate() - 30);
    expect(isExpired(recordedAt.toISOString(), NOW)).toBe(false);
  });

  it('returns true for a recording 31 days ago (outside window)', () => {
    // 31 days before now = 2026-05-12T00:00:00Z (before cutoff)
    const recordedAt = new Date(NOW);
    recordedAt.setDate(recordedAt.getDate() - 31);
    expect(isExpired(recordedAt.toISOString(), NOW)).toBe(true);
  });

  it('returns true for a recording well outside the retention window', () => {
    const recordedAt = new Date('2025-01-01T00:00:00Z');
    expect(isExpired(recordedAt.toISOString(), NOW)).toBe(true);
  });

  it('returns false for a recording from today', () => {
    expect(isExpired(NOW.toISOString(), NOW)).toBe(false);
  });
});
