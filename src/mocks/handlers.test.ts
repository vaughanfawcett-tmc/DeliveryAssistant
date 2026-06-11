import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';

// These imports will fail until files are created (RED phase)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getConsignmentsBySearchTerm: any;

describe('MSW handlers + Nexus client integration', () => {
  beforeAll(async () => {
    const { server: s } = await import('./server');
    const { getConsignmentsBySearchTerm: fn } = await import('../lib/nexus/client');
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
    // FOUND_NULL_ETA has status Booked; customerReference CUST-003
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
    // and confirm we never get a thrown exception
    let lastResult: Awaited<ReturnType<typeof getConsignmentsBySearchTerm>> | undefined;

    for (let i = 0; i < 7; i++) {
      const result = await getConsignmentsBySearchTerm('TRIGGER-503');
      lastResult = result;
    }

    // Eventually (after threshold), the breaker kicks in
    expect(lastResult!.ok).toBe(false);
    if (!lastResult!.ok) {
      expect(lastResult!.error).toBe('nexus_unavailable');
    }
  });
});
