import type { TokenStore } from '../redis';

export type { TokenStore };

// Cache key constants
const BEARER_KEY = 'nexus:bearer';
const REFRESH_KEY = 'nexus:refresh';

// TTLs — 5-minute safety buffer per STACK.md
const BEARER_TTL_SECONDS = 55 * 60;       // 3300s — 55 minutes
const REFRESH_TTL_SECONDS = 23 * 60 * 60; // 82800s — 23 hours

export type LoginResponse = {
  bearerToken: string;
  refreshToken: string;
};

/**
 * Injectable login function — called with (loginUrl, credentials body).
 * In production: a thin fetch wrapper.
 * In tests: a vi.fn() spy — no env or network needed.
 */
export type HttpPost = (url: string, body: object) => Promise<LoginResponse>;

/**
 * Injectable configuration — allows tests to bypass env parsing.
 */
export interface TokenManagerConfig {
  getLoginUrl: () => string;
  getCredentials: () => { username: string | undefined; password: string | undefined };
}

/**
 * Factory that creates an isolated token manager bound to a specific store,
 * HTTP client, and config — enabling full unit-test injection.
 */
export function createTokenManager(
  store: TokenStore,
  httpPost: HttpPost,
  config?: TokenManagerConfig,
) {
  // Single-flight promise — cleared after resolution (PITFALLS.md Pitfall 2 / T-01-05)
  let refreshPromise: Promise<string> | null = null;

  /**
   * Resolve the login URL and credentials.
   * Falls back to env when no config is injected (production path).
   * NEVER logs URL, body (credentials), or response (token values) — T-01-04.
   */
  function resolveConfig(): { loginUrl: string; username?: string; password?: string } {
    if (config) {
      const url = config.getLoginUrl();
      const { username, password } = config.getCredentials();
      return { loginUrl: url, username, password };
    }
    // Lazy env access — only reached in production (not during unit tests)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('../env') as typeof import('../env');
    return {
      loginUrl: `${env.PALLEX_BASE_URL}/Account/login`,
      username: env.PALLEX_USERNAME,
      password: env.PALLEX_PASSWORD,
    };
  }

  /**
   * Perform a full re-login against Nexus (no dedicated refresh endpoint).
   * Caches bearer (55 min) and refresh (23 h) tokens in the store.
   */
  async function login(): Promise<string> {
    const { loginUrl, username, password } = resolveConfig();
    const body = { username, password };

    const { bearerToken, refreshToken } = await httpPost(loginUrl, body);

    // Cache both tokens
    await store.set(BEARER_KEY, bearerToken, BEARER_TTL_SECONDS);
    await store.set(REFRESH_KEY, refreshToken, REFRESH_TTL_SECONDS);

    return bearerToken;
  }

  /**
   * Returns a valid bearer token for Nexus API calls.
   *
   * Single-flight guarantee:
   *   - If a valid cached bearer exists → return immediately.
   *   - If a login is already in-flight → join that promise (no second login).
   *   - Otherwise → start a new login; all late callers join the same promise.
   */
  async function getToken(): Promise<string> {
    // Fast path — cached bearer
    const cached = await store.get(BEARER_KEY);
    if (cached) return cached;

    // Join an in-flight refresh if one is running
    if (refreshPromise) {
      return refreshPromise;
    }

    // Start the single in-flight login; all concurrent callers share this promise
    refreshPromise = login().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  /**
   * Resets the in-flight promise — required for test isolation.
   */
  function __resetForTest(): void {
    refreshPromise = null;
  }

  return { getToken, __resetForTest };
}

/**
 * Production HTTP POST — wraps fetch for the Nexus /Account/login call.
 * NEVER logs URL, body (credentials), or response (token values) — T-01-04.
 */
export function createDefaultHttpPost(): HttpPost {
  return async function defaultHttpPost(url: string, body: object): Promise<LoginResponse> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Nexus login failed: ${res.status}`);
    }
    return res.json() as Promise<LoginResponse>;
  };
}

// -----------------------------------------------------------------------
// Default singleton bound to the real store and fetch — for production use.
// Lazily constructed to avoid env/Redis access at module load time.
// -----------------------------------------------------------------------
let _defaultManager: ReturnType<typeof createTokenManager> | undefined;

function getDefaultManager(): ReturnType<typeof createTokenManager> {
  if (!_defaultManager) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { redisTokenStore } = require('../redis') as typeof import('../redis');
    _defaultManager = createTokenManager(redisTokenStore, createDefaultHttpPost());
  }
  return _defaultManager;
}

export function getToken(): Promise<string> {
  return getDefaultManager().getToken();
}

export function __resetForTest(): void {
  getDefaultManager().__resetForTest();
}
