/**
 * mask.ts — PII masking utilities for the admin dashboard.
 *
 * from_number (caller phone) must NEVER reach any client component unmasked.
 * Apply maskPhone at the repository boundary before it crosses to the client.
 * (Threat T-03-07 — Pitfall 4 in RESEARCH.md)
 */

/**
 * Mask a raw phone number to show only the last 4 digits.
 *
 * - null / empty  → '—'   (no number available)
 * - < 4 digits    → '•••' (too short to reveal safely)
 * - ≥ 4 digits    → '••• ••• XXXX' where XXXX is the last 4 digits
 */
export function maskPhone(raw: string | null): string {
  if (raw === null || raw === '') return '—';

  // Extract only the digits from the raw string
  const digits = raw.replace(/\D/g, '');

  if (digits.length < 4) return '•••';

  const last4 = digits.slice(-4);
  return `••• ••• ${last4}`;
}
