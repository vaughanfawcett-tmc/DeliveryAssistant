import { z } from 'zod';
import { env } from '../env';
import { createBreaker } from './circuit-breaker';
import { createTokenManager, createDefaultHttpPost, type TokenStore } from './token-manager';

/**
 * Discriminated result type — the breaker fallback is type-visible to callers.
 * Callers (Plan 04 Tracking Service) never see a raw Nexus error.
 */
export type NexusLookupResult =
  | { ok: true; consignments: NexusConsignment[] }
  | { ok: false; error: 'not_found' | 'nexus_unavailable' };

// ------- Zod schema for Nexus response validation (T-01-07) -------
// Defensive validation so callers are protected if the real API drifts from spec.

const nexusStatusSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const nexusRouteDetailSchema = z.object({
  type: z.string(),
  routeDate: z.string(),
  regNo: z.string(),
  round: z.string(),
  status: z.string(),
  palletCount: z.number(),
});

const nexusConsignmentSchema = z.object({
  consignmentNumber: z.string(),
  consignmentID: z.number(),
  customerReference: z.string().nullable(),
  status: nexusStatusSchema,
  estimatedDelDate: z.string().nullable(),
  estimatedDelTime: z.string().nullable(),
  startWindow: z.string().nullable(),
  endWindow: z.string().nullable(),
  delAddressLine1: z.string().nullable(),
  delAddressTown: z.string().nullable(),
  delAddressPostcode: z.string(),
  colDate: z.string().nullable(),
  delDateTime: z.string().nullable(),
  routeDetails: z.array(nexusRouteDetailSchema),
});

type NexusConsignment = z.infer<typeof nexusConsignmentSchema>;

const nexusConsignmentsArraySchema = z.array(nexusConsignmentSchema);

// ------- Singleton token manager and circuit breaker -------
// Lazy to avoid env access at module load time (env uses a Proxy that defers
// parsing to first property access — same pattern used throughout Plan 01/02).

let _tokenStore: TokenStore | undefined;
let _tokenManager: ReturnType<typeof createTokenManager> | undefined;
let _breaker: ((...args: [string]) => Promise<NexusLookupResult>) | undefined;

function getTokenManager(): ReturnType<typeof createTokenManager> {
  if (!_tokenManager) {
    // Use injected store if set (for tests), otherwise lazy Redis.
    // In mock mode use an in-memory store so the app is demonstrable without
    // a running Upstash Redis (production always uses redisTokenStore).
    if (!_tokenStore) {
      // Lazy Redis import to avoid env access at module load time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { redisTokenStore, inMemoryTokenStore } = require('../redis') as typeof import('../redis');
      _tokenStore =
        process.env.PALLEX_MOCK === 'true' ? inMemoryTokenStore : redisTokenStore;
    }
    // env Proxy defers parsing to first property access — safe at call time
    _tokenManager = createTokenManager(
      _tokenStore,
      createDefaultHttpPost(),
      {
        getLoginUrl: () => `${env.PALLEX_BASE_URL}/Account/login`,
        getCredentials: () => ({ username: env.PALLEX_USERNAME, password: env.PALLEX_PASSWORD }),
      },
    );
  }
  return _tokenManager;
}

/**
 * The raw Nexus lookup — authenticated fetch call.
 * Non-2xx responses throw so the circuit breaker counts them as failures.
 */
async function nexusLookupFn(searchTerm: string): Promise<NexusLookupResult> {
  const token = await getTokenManager().getToken();
  const url = `${env.PALLEX_BASE_URL}/Consignments?searchTerm=${encodeURIComponent(searchTerm)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // Non-2xx throws so the breaker records a failure (T-01-06)
    throw new Error(`Nexus API error: ${res.status}`);
  }

  const raw: unknown = await res.json();

  // Validate the response shape with zod (T-01-07 — real API may drift from spec)
  const parsed = nexusConsignmentsArraySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Nexus response validation failed: ${parsed.error.message}`);
  }

  const consignments = parsed.data;
  if (consignments.length === 0) {
    return { ok: false, error: 'not_found' };
  }

  return { ok: true, consignments };
}

/**
 * Fallback for when the circuit is open or a call fails.
 * Returns nexus_unavailable — NEVER re-throws (PITFALLS.md Pitfall 9 / T-01-06).
 */
function nexusUnavailableFallback(_searchTerm: string): NexusLookupResult {
  return { ok: false, error: 'nexus_unavailable' };
}

function getBreaker() {
  if (!_breaker) {
    _breaker = createBreaker(nexusLookupFn, nexusUnavailableFallback, {
      timeoutMs: 5000,
      errorThresholdPercentage: 50,
      resetTimeoutMs: 30000,
      volumeThreshold: 5,
    });
  }
  return _breaker;
}

/**
 * Look up consignments by search term against the Pall-Ex Nexus API.
 *
 * - Authenticated: obtains (or reuses) a cached bearer token via the token manager.
 * - Resilient: wrapped in a circuit breaker; never throws to callers (T-01-06).
 * - Validated: Nexus response shape verified with zod before returning (T-01-07).
 *
 * @param searchTerm  Consignment number, customer reference, or other term
 *                    supported by GET /Consignments?searchTerm=
 * @returns  Discriminated NexusLookupResult — ok:true with consignments on
 *           success; ok:false with error code on not-found or Nexus unavailable.
 */
export async function getConsignmentsBySearchTerm(
  searchTerm: string,
): Promise<NexusLookupResult> {
  return getBreaker()(searchTerm);
}

// Re-export factory helpers for consumers that need custom instances
export { createTokenManager, createBreaker };

/**
 * Reset singletons and optionally inject a test token store.
 * Call in test setup (beforeAll / beforeEach) for isolation.
 *
 * @param tokenStore  Optional fake store — avoids real Redis calls in tests.
 */
export function __resetSingletonsForTest(tokenStore?: TokenStore): void {
  _tokenStore = tokenStore;
  _tokenManager = undefined;
  _breaker = undefined;
}
