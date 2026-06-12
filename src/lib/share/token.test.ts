/**
 * token.test.ts — Tests for the signed share-token codec (PORT-08, D-12).
 *
 * Tests cover:
 * - Round-trip: createShareToken -> verifyShareToken returns the original consignment number
 * - Payload structure: only {c, exp} fields — no postcode, no sensitive data
 * - Forgery rejection: altered signature byte -> null
 * - Tamper rejection: altered payload (different consignment number) with original sig -> null
 * - Malformed input: garbage, empty string, too many parts -> null (never throws)
 * - Expiry: expired token -> null
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createShareToken, verifyShareToken } from './token';

const TEST_SECRET = 'test-secret-0123456789-abcdefghij-xyz';

describe('share token codec', () => {
  beforeEach(() => {
    // Set a known test secret so the env Proxy parses correctly in tests
    process.env.SHARE_TOKEN_SECRET = TEST_SECRET;
  });

  // ---- Round-trip ------------------------------------------------------------

  it('round-trip: verifyShareToken(createShareToken(c)) === c', () => {
    const token = createShareToken('PA-12345');
    expect(verifyShareToken(token)).toBe('PA-12345');
  });

  it('round-trip with different consignment numbers', () => {
    expect(verifyShareToken(createShareToken('PA-99999'))).toBe('PA-99999');
    expect(verifyShareToken(createShareToken('XY-00001'))).toBe('XY-00001');
  });

  // ---- Token structure -------------------------------------------------------

  it('token string is of the form <base64url-payload>.<base64url-sig> (exactly two parts)', () => {
    const token = createShareToken('PA-12345');
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('payload decodes to an object with exactly keys c and exp — no postcode field', () => {
    const token = createShareToken('PA-12345');
    const [payloadB64] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Exactly the right consignment number
    expect(decoded.c).toBe('PA-12345');

    // exp is a unix timestamp (future)
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // No postcode or sensitive fields
    const keys = Object.keys(decoded).sort();
    expect(keys).toEqual(['c', 'exp']);
  });

  // ---- Forgery rejection (T-02-04) -------------------------------------------

  it('forgery rejected: altering the signature byte returns null', () => {
    const token = createShareToken('PA-12345');
    const [payload, sig] = token.split('.');
    // Alter the first character of the signature
    const alteredSig = sig[0] === 'a' ? 'b' + sig.slice(1) : 'a' + sig.slice(1);
    const forgedToken = `${payload}.${alteredSig}`;

    expect(verifyShareToken(forgedToken)).toBeNull();
  });

  it('forgery rejected: completely different signature returns null', () => {
    const token = createShareToken('PA-12345');
    const [payload] = token.split('.');
    const forgedToken = `${payload}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;

    expect(verifyShareToken(forgedToken)).toBeNull();
  });

  // ---- Tamper rejection (T-02-05) --------------------------------------------

  it('tamper rejected: altered payload with original sig returns null', () => {
    const token = createShareToken('PA-12345');
    const [, sig] = token.split('.');

    // Build a payload with a different consignment number
    const tamperedPayload = Buffer.from(
      JSON.stringify({ c: 'PA-99999', exp: Math.floor(Date.now() / 1000) + 86400 }),
    ).toString('base64url');

    const tamperedToken = `${tamperedPayload}.${sig}`;
    expect(verifyShareToken(tamperedToken)).toBeNull();
  });

  // ---- Expiry rejection (T-02-08) --------------------------------------------

  it('expired: token with exp in the past returns null', () => {
    // Create a token with a negative TTL (exp already in the past)
    const token = createShareToken('PA-12345', -1);
    expect(verifyShareToken(token)).toBeNull();
  });

  it('expired: token with exp == 0 returns null', () => {
    const token = createShareToken('PA-12345', -(Math.floor(Date.now() / 1000)));
    expect(verifyShareToken(token)).toBeNull();
  });

  // ---- Malformed input (never throws) ----------------------------------------

  it('malformed: garbage string returns null without throwing', () => {
    expect(() => verifyShareToken('garbage')).not.toThrow();
    expect(verifyShareToken('garbage')).toBeNull();
  });

  it('malformed: empty string returns null without throwing', () => {
    expect(() => verifyShareToken('')).not.toThrow();
    expect(verifyShareToken('')).toBeNull();
  });

  it('malformed: three-part token (a.b.c) returns null without throwing', () => {
    expect(() => verifyShareToken('a.b.c')).not.toThrow();
    expect(verifyShareToken('a.b.c')).toBeNull();
  });

  it('malformed: valid-length base64 that is not JSON returns null without throwing', () => {
    const notJson = Buffer.from('this is not json at all').toString('base64url');
    const fakeToken = `${notJson}.somesig`;
    expect(() => verifyShareToken(fakeToken)).not.toThrow();
    expect(verifyShareToken(fakeToken)).toBeNull();
  });

  it('malformed: single part (no separator) returns null without throwing', () => {
    expect(() => verifyShareToken('onlypayloadnoseparator')).not.toThrow();
    expect(verifyShareToken('onlypayloadnoseparator')).toBeNull();
  });
});
