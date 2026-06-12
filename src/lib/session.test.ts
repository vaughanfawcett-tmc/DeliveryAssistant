import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSessionOptions } from './session';

describe('getSessionOptions', () => {
  const ORIGINAL_SECRET = process.env.DASHBOARD_SESSION_SECRET;

  beforeEach(() => {
    // Reset to undefined before each test; each test sets what it needs
    delete process.env.DASHBOARD_SESSION_SECRET;
  });

  afterEach(() => {
    // Restore original value
    if (ORIGINAL_SECRET !== undefined) {
      process.env.DASHBOARD_SESSION_SECRET = ORIGINAL_SECRET;
    } else {
      delete process.env.DASHBOARD_SESSION_SECRET;
    }
  });

  it('returns correct session options when DASHBOARD_SESSION_SECRET is set', () => {
    const secret = 'test-secret-that-is-at-least-32-chars-long';
    process.env.DASHBOARD_SESSION_SECRET = secret;

    const opts = getSessionOptions();

    expect(opts.cookieName).toBe('da_session');
    expect(opts.password).toBe(secret);
    expect(opts.cookieOptions?.httpOnly).toBe(true);
    expect(opts.cookieOptions?.sameSite).toBe('lax');
    expect(opts.cookieOptions?.maxAge).toBe(28800); // 60 * 60 * 8
  });

  it('throws when DASHBOARD_SESSION_SECRET is absent', () => {
    // DASHBOARD_SESSION_SECRET already deleted in beforeEach
    expect(() => getSessionOptions()).toThrow(/DASHBOARD_SESSION_SECRET is required/);
  });
});
