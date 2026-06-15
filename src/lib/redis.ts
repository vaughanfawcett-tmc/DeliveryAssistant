import { Redis } from '@upstash/redis';

/**
 * Injectable token store interface — keeps the token manager
 * testable without a real Redis connection.
 */
export interface TokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/**
 * Lazy singleton factory — defers Redis construction to first use.
 * This avoids eager env access at module load time, which would break
 * tests that don't set all env vars (same pattern as env.ts Proxy).
 */
let _redis: Redis | undefined;

function getRedis(): Redis {
  if (!_redis) {
    // Import env lazily so this module doesn't trigger env parse at load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require('./env') as typeof import('./env');
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

/**
 * Thin TokenStore adapter wrapping the Upstash redis singleton.
 * Lazily constructed on first use so tests that inject a fake store
 * are never affected by missing env vars.
 */
export const redisTokenStore: TokenStore = {
  async get(key: string): Promise<string | null> {
    const value = await getRedis().get<string>(key);
    return value ?? null;
  },
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await getRedis().set(key, value, { ex: ttlSeconds });
  },
};

/**
 * In-memory TokenStore — used in mock mode (PALLEX_MOCK=true) so the app is
 * fully demonstrable without standing up a local Upstash Redis instance.
 * Mirrors the Redis store's get/set + TTL semantics with a process-local Map.
 * Never used when PALLEX_MOCK is false (production always uses redisTokenStore).
 */
const _memStore = new Map<string, { value: string; expiresAt: number }>();

export const inMemoryTokenStore: TokenStore = {
  async get(key: string): Promise<string | null> {
    const entry = _memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      _memStore.delete(key);
      return null;
    }
    return entry.value;
  },
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    _memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
};

/**
 * Direct Redis client export — only use this where you need Redis beyond
 * the TokenStore interface (e.g. for consignment caching in a future plan).
 */
export function getRedisClient(): Redis {
  return getRedis();
}
