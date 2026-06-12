import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

const VALID_ENV = {
  PALLEX_MOCK: 'true',
  PALLEX_BASE_URL: 'https://nexus.pallex.com/api',
  PALLEX_USERNAME: 'testuser',
  PALLEX_PASSWORD: 'testpass',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token',
};

describe('parseEnv', () => {
  it('parses PALLEX_MOCK="true" as boolean true', () => {
    const env = parseEnv({ ...VALID_ENV, PALLEX_MOCK: 'true' });
    expect(env.PALLEX_MOCK).toBe(true);
  });

  it('parses PALLEX_MOCK="false" as boolean false', () => {
    const env = parseEnv({ ...VALID_ENV, PALLEX_MOCK: 'false' });
    expect(env.PALLEX_MOCK).toBe(false);
  });

  it('defaults PALLEX_MOCK to false when unset', () => {
    const { PALLEX_MOCK: _, ...rest } = VALID_ENV;
    const env = parseEnv(rest);
    expect(env.PALLEX_MOCK).toBe(false);
  });

  it('throws a descriptive error naming PALLEX_BASE_URL when missing', () => {
    const { PALLEX_BASE_URL: _, ...rest } = VALID_ENV;
    expect(() => parseEnv(rest)).toThrow(/PALLEX_BASE_URL/);
  });

  it('throws when PALLEX_USERNAME is missing and PALLEX_MOCK is false', () => {
    const { PALLEX_USERNAME: _, ...rest } = VALID_ENV;
    expect(() => parseEnv({ ...rest, PALLEX_MOCK: 'false' })).toThrow();
  });

  it('throws when PALLEX_PASSWORD is missing and PALLEX_MOCK is false', () => {
    const { PALLEX_PASSWORD: _, ...rest } = VALID_ENV;
    expect(() => parseEnv({ ...rest, PALLEX_MOCK: 'false' })).toThrow();
  });

  it('allows PALLEX_USERNAME and PALLEX_PASSWORD to be absent when PALLEX_MOCK is true', () => {
    const { PALLEX_USERNAME: _u, PALLEX_PASSWORD: _p, ...rest } = VALID_ENV;
    expect(() => parseEnv({ ...rest, PALLEX_MOCK: 'true' })).not.toThrow();
  });

  it('treats empty-string PALLEX_USERNAME/PASSWORD as absent in mock mode (blank .env placeholders)', () => {
    const env = parseEnv({
      ...VALID_ENV,
      PALLEX_MOCK: 'true',
      PALLEX_USERNAME: '',
      PALLEX_PASSWORD: '',
    });
    expect(env.PALLEX_USERNAME).toBeUndefined();
    expect(env.PALLEX_PASSWORD).toBeUndefined();
  });

  it('still rejects empty-string PALLEX_USERNAME/PASSWORD when PALLEX_MOCK is false', () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        PALLEX_MOCK: 'false',
        PALLEX_USERNAME: '',
        PALLEX_PASSWORD: '',
      })
    ).toThrow();
  });

  it('exposes all required env vars on the result object', () => {
    const env = parseEnv(VALID_ENV);
    expect(env.PALLEX_BASE_URL).toBe('https://nexus.pallex.com/api');
    expect(env.PALLEX_USERNAME).toBe('testuser');
    expect(env.PALLEX_PASSWORD).toBe('testpass');
    expect(env.SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('service-role-key');
    expect(env.UPSTASH_REDIS_REST_URL).toBe('https://redis.upstash.io');
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe('redis-token');
  });
});
