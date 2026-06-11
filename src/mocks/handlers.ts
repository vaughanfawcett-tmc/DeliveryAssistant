import { http, HttpResponse } from 'msw';
import { KNOWN_CONSIGNMENTS } from './fixtures';
import type { NexusConsignment } from '../types/consignment';

/**
 * The base URL for Pall-Ex Nexus API calls.
 * Read lazily from process.env to avoid env-parse failures at import time.
 * In tests, set process.env.PALLEX_BASE_URL before importing this module.
 */
function getBaseUrl(): string {
  return process.env.PALLEX_BASE_URL ?? 'https://mock.pallex.test';
}

/**
 * Match a searchTerm against the known fixtures:
 *   - Prefix match on consignmentNumber (spec: start-match)
 *   - Exact match on customerReference
 */
function matchConsignments(searchTerm: string): NexusConsignment[] {
  if (!searchTerm) return [];
  return KNOWN_CONSIGNMENTS.filter(
    (c) =>
      c.consignmentNumber.startsWith(searchTerm) ||
      (c.customerReference !== null && c.customerReference === searchTerm),
  );
}

export const handlers = [
  /**
   * POST /Account/login
   * Returns mock bearer and refresh tokens.
   */
  http.post(`${getBaseUrl()}/Account/login`, () => {
    return HttpResponse.json({ bearerToken: 'mock-bearer', refreshToken: 'mock-refresh' });
  }),

  /**
   * GET /Consignments
   * Reads searchTerm from query params, matches against KNOWN_CONSIGNMENTS.
   *
   * Special triggers:
   *   - searchTerm === 'TRIGGER-503' → 503 to test circuit-breaker downtime path
   *
   * Empty match → empty array (client maps empty → not_found).
   */
  http.get(`${getBaseUrl()}/Consignments`, ({ request }) => {
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get('searchTerm') ?? '';

    // Downtime simulation — trips the circuit breaker after volumeThreshold calls
    if (searchTerm === 'TRIGGER-503') {
      return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
    }

    const matches = matchConsignments(searchTerm);
    return HttpResponse.json(matches);
  }),
];
