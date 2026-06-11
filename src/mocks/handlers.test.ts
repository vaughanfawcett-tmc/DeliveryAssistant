import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import type { TokenStore } from '../lib/nexus/token-manager';

// Set required env vars BEFORE any lazy module access.
// PALLEX_MOCK=true allows credentials to be omitted.
process.env.PALLEX_MOCK = 'true';
process.env.PALLEX_BASE_URL = 'https://mock.pallex.test';
process.env.PALLEX_USERNAME = 'test-user';
process.env.PALLEX_PASSWORD = 'test-pass';
process.env.SUPABASE_URL = 'https://abc.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';

/** In-memory token store — avoids real Redis/Upstash calls in tests. */
function makeFakeStore(): TokenStore {
  const data = new Map<string, string>();
  return {
    async get(key: string) { return data.get(key) ?? null; },
    async set(key: string, value: string) { data.set(key, value); },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any;
let getConsignmentsBySearchTerm: (term: string) => Promise<import('../lib/nexus/client').NexusLookupResult>;

describe('MSW handlers + Nexus client integration', () => {
  beforeAll(async () => {
    const { server: s } = await import('./server');
    const { getConsignmentsBySearchTerm: fn, __resetSingletonsForTest } = await import('../lib/nexus/client');

    // Inject fake token store so tests don't hit real Upstash Redis
    __resetSingletonsForTest(makeFakeStore());

    server = s;
    getConsignmentsBySearchTerm = fn;
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('returns ok:true with a matching consignment for a known consignment number', async () => {
    const result = await getConsignmentsBySearchTerm('PA-12345');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.consignments).toHaveLength(1);
      expect(result.consignments[0].delAddressPostcode).toBe('DE1 1AA');
      expect(result.consignments[0].consignmentNumber).toBe('PA-12345');
    }
  });

  it('returns ok:false with error not_found for an unknown search term', async () => {
    const result = await getConsignmentsBySearchTerm('NOPE-999');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_found');
    }
  });

  it('retrieves the null-ETA fixture and its estimatedDelDate is null', async () => {
    // FOUND_NULL_ETA: consignmentNumber PA-99999, status Booked
    const result = await getConsignmentsBySearchTerm('PA-99999');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.consignments[0].estimatedDelDate).toBeNull();
      expect(result.consignments[0].startWindow).toBeNull();
      expect(result.consignments[0].endWindow).toBeNull();
    }
  });

  it('returns nexus_unavailable (not throws) after TRIGGER-503 trips the breaker', async () => {
    // Fire enough TRIGGER-503 calls to exceed volumeThreshold (5)
    // and confirm we NEVER get a thrown exception
    let lastResult: import('../lib/nexus/client').NexusLookupResult | undefined;

    for (let i = 0; i < 7; i++) {
      // Must not throw — breaker returns fallback value
      const result = await getConsignmentsBySearchTerm('TRIGGER-503');
      lastResult = result;
    }

    // After 5 failures (volumeThreshold), circuit opens → nexus_unavailable
    expect(lastResult!.ok).toBe(false);
    if (!lastResult!.ok) {
      expect(lastResult!.error).toBe('nexus_unavailable');
    }
  });
});
