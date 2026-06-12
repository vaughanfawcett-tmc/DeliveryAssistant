/**
 * Token-gate unit tests for the share route (PORT-08, D-12, T-02-14).
 *
 * These tests exercise the verifyShareToken / createShareToken contract in
 * isolation — no App Router rendering required. The tests prove the branch
 * condition that guards notFound():
 *   - valid token   → consignment number resolved (route would proceed)
 *   - invalid token → null (route would 404)
 *   - expired token → null (route would 404)
 *
 * The secret is set on process.env before the module is imported so the
 * lazy env proxy picks it up on first access (env module caches after first read).
 */

// Set the secret before any module that reads env is imported
process.env.SHARE_TOKEN_SECRET = 'test-secret-for-share-token-unit-tests-40c';
// Also satisfy other required env fields (env validates all on first access)
process.env.PALLEX_MOCK = 'true';
process.env.PALLEX_BASE_URL = 'http://localhost:3000';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-placeholder-32char';
process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-upstash-token';

import { describe, it, expect } from 'vitest';
import { createShareToken, verifyShareToken } from '@/lib/share/token';

describe('share-route token gate', () => {
  it('valid token → resolved consignment number (route proceeds)', () => {
    const consignmentNumber = 'PA-1234567';
    const token = createShareToken(consignmentNumber);
    const result = verifyShareToken(token);
    expect(result).toBe(consignmentNumber);
  });

  it('bad token → null (route 404s)', () => {
    expect(verifyShareToken('bad.token')).toBeNull();
  });

  it('tampered payload → null (route 404s)', () => {
    const token = createShareToken('PA-111');
    const [payload, sig] = token.split('.');
    // Flip a char in the payload to simulate tampering
    const tampered = payload.slice(0, -1) + (payload.slice(-1) === 'A' ? 'B' : 'A');
    expect(verifyShareToken(`${tampered}.${sig}`)).toBeNull();
  });

  it('expired token → null (route 404s)', () => {
    // Create a token with negative TTL so it is immediately expired
    const expired = createShareToken('PA-999', -1);
    expect(verifyShareToken(expired)).toBeNull();
  });

  it('empty string → null (route 404s)', () => {
    expect(verifyShareToken('')).toBeNull();
  });

  it('no separator → null (route 404s)', () => {
    expect(verifyShareToken('noseparatorhere')).toBeNull();
  });
});
