import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTokenManager, type TokenStore, type TokenManagerConfig } from './token-manager';

// Fake token store backed by an in-memory map
function makeFakeStore(): TokenStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async set(key: string, value: string, _ttlSeconds: number) {
      data.set(key, value);
    },
  };
}

// Test config — no env required
const testConfig: TokenManagerConfig = {
  getLoginUrl: () => 'https://mock.nexus.test/Account/login',
  getCredentials: () => ({ username: 'test-user', password: 'test-pass' }),
};

describe('Token Manager', () => {
  let store: ReturnType<typeof makeFakeStore>;
  let loginSpy: ReturnType<typeof vi.fn>;
  let tokenManager: ReturnType<typeof createTokenManager>;

  beforeEach(() => {
    store = makeFakeStore();
    loginSpy = vi.fn().mockResolvedValue({
      bearerToken: 'test-bearer',
      refreshToken: 'test-refresh',
    });
    tokenManager = createTokenManager(store, loginSpy, testConfig);
  });

  it('triggers exactly ONE login call when 5 concurrent getToken() calls are made with empty cache', async () => {
    // Slow down the login to ensure concurrent callers overlap
    loginSpy.mockImplementation(
      () =>
        new Promise<{ bearerToken: string; refreshToken: string }>((resolve) =>
          Promise.resolve().then(() =>
            Promise.resolve().then(() =>
              resolve({ bearerToken: 'test-bearer', refreshToken: 'test-refresh' })
            )
          )
        )
    );

    const results = await Promise.all([
      tokenManager.getToken(),
      tokenManager.getToken(),
      tokenManager.getToken(),
      tokenManager.getToken(),
      tokenManager.getToken(),
    ]);

    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(5);
    results.forEach((token) => expect(token).toBe('test-bearer'));
  });

  it('returns the cached bearer token without calling login when token is unexpired', async () => {
    // Pre-populate cache with a bearer token
    await store.set('nexus:bearer', 'cached-bearer', 3300);

    const token = await tokenManager.getToken();

    expect(loginSpy).not.toHaveBeenCalled();
    expect(token).toBe('cached-bearer');
  });

  it('performs a new login when the bearer is absent, and caches the new tokens', async () => {
    // Store is empty — no bearer, no refresh
    const token = await tokenManager.getToken();

    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(token).toBe('test-bearer');
    // New bearer should now be cached
    expect(await store.get('nexus:bearer')).toBe('test-bearer');
  });

  it('caches bearer with 3300s TTL and refresh with 82800s TTL', async () => {
    const setSpy = vi.spyOn(store, 'set');

    await tokenManager.getToken();

    const bearerCall = setSpy.mock.calls.find(([key]) => key === 'nexus:bearer');
    const refreshCall = setSpy.mock.calls.find(([key]) => key === 'nexus:refresh');

    expect(bearerCall).toBeDefined();
    expect(bearerCall![2]).toBe(3300);  // 55 * 60 — 55 minutes

    expect(refreshCall).toBeDefined();
    expect(refreshCall![2]).toBe(82800); // 23 * 60 * 60 — 23 hours
  });
});
