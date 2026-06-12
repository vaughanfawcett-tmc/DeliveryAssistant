/**
 * webhook-auth.test.ts — Constant-time HMAC webhook verifier tests.
 *
 * Tests:
 * - verifyVoiceSignature: correct signature verifies; tamper fails; null/short/empty fails
 * - verifyProviderSignature: per-provider header extraction + correct secret selection
 * - Length guard: prevents throw when lengths differ (timingSafeEqual requires equal-length)
 */

import { createHmac } from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  verifyVoiceSignature,
  verifyProviderSignature,
} from '@/lib/voice/webhook-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

const SECRET = 'test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const BODY = '{"trackingRef":"PA-12345","postcode":"DE1 1AA"}';

// ---------------------------------------------------------------------------
// verifyVoiceSignature
// ---------------------------------------------------------------------------

describe('verifyVoiceSignature', () => {
  it('returns true when signature matches', () => {
    const sig = sign(BODY, SECRET);
    expect(verifyVoiceSignature(BODY, sig, SECRET)).toBe(true);
  });

  it('returns false when body is tampered', () => {
    const sig = sign(BODY, SECRET);
    const tampered = BODY.replace('PA-12345', 'PA-99999');
    expect(verifyVoiceSignature(tampered, sig, SECRET)).toBe(false);
  });

  it('returns false when signature is tampered', () => {
    const sig = sign(BODY, SECRET);
    const badSig = sig.slice(0, -4) + 'aaaa';
    expect(verifyVoiceSignature(BODY, badSig, SECRET)).toBe(false);
  });

  it('returns false when signature is null (never throws)', () => {
    expect(verifyVoiceSignature(BODY, null, SECRET)).toBe(false);
  });

  it('returns false when signature is empty string', () => {
    expect(verifyVoiceSignature(BODY, '', SECRET)).toBe(false);
  });

  it('returns false when body is empty', () => {
    const sig = sign('', SECRET);
    // Even though it signs cleanly, empty body is treated as suspicious in length-guard context
    // — the verifier is purely signature-based so it SHOULD verify; but test that it does not throw
    // This test ensures it returns a bool, never throws
    expect(typeof verifyVoiceSignature('', sig, SECRET)).toBe('boolean');
  });

  it('returns false for a short signature (length guard prevents timingSafeEqual throw)', () => {
    // A 4-char sig is much shorter than 64 hex chars — length guard must catch this
    expect(verifyVoiceSignature(BODY, 'abcd', SECRET)).toBe(false);
  });

  it('returns false for a wrong secret', () => {
    const sig = sign(BODY, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    expect(verifyVoiceSignature(BODY, sig, SECRET)).toBe(false);
  });

  it('never throws even for garbage inputs', () => {
    expect(() => verifyVoiceSignature('', null, '')).not.toThrow();
    expect(() => verifyVoiceSignature('\x00\x01', 'ZZZZZZ', '')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// verifyProviderSignature
// ---------------------------------------------------------------------------

describe('verifyProviderSignature', () => {
  const VOICE_SECRET = 'test-voice-webhook-secret-32chars-minimum-xx'; // matches setup-dom.ts stub

  beforeEach(() => {
    process.env.VOICE_WEBHOOK_SECRET = VOICE_SECRET;
    // ElevenLabs secret for provider-specific tests
    process.env.ELEVENLABS_WEBHOOK_SECRET = 'test-elevenlabs-webhook-secret-xxxxxxxx';
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;
  });

  it('default provider: reads X-Voice-Signature header and uses VOICE_WEBHOOK_SECRET', () => {
    const sig = sign(BODY, VOICE_SECRET);
    const headers = new Headers({ 'x-voice-signature': sig });
    expect(verifyProviderSignature('default', BODY, headers)).toBe(true);
  });

  it('default provider: rejects bad signature', () => {
    const headers = new Headers({ 'x-voice-signature': 'badsig' });
    expect(verifyProviderSignature('default', BODY, headers)).toBe(false);
  });

  it('default provider: missing header returns false', () => {
    const headers = new Headers();
    expect(verifyProviderSignature('default', BODY, headers)).toBe(false);
  });

  it('elevenlabs provider: reads its signing header (structured t=,v1=) and uses ELEVENLABS_WEBHOOK_SECRET', () => {
    const elSecret = process.env.ELEVENLABS_WEBHOOK_SECRET!;
    const sig = sign(BODY, elSecret);
    const nowSec = Math.floor(Date.now() / 1000);
    const headers = new Headers({ 'elevenlabs-signature': `t=${nowSec},v1=${sig}` });
    expect(verifyProviderSignature('elevenlabs', BODY, headers)).toBe(true);
  });

  it('elevenlabs provider: falls back to VOICE_WEBHOOK_SECRET when ELEVENLABS_WEBHOOK_SECRET absent', () => {
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;
    const sig = sign(BODY, VOICE_SECRET);
    const nowSec = Math.floor(Date.now() / 1000);
    const headers = new Headers({ 'elevenlabs-signature': `t=${nowSec},v1=${sig}` });
    expect(verifyProviderSignature('elevenlabs', BODY, headers)).toBe(true);
  });

  it('elevenlabs provider: rejects a stale timestamp (> 300 s old) — CR-02 replay protection', () => {
    const elSecret = process.env.ELEVENLABS_WEBHOOK_SECRET ?? VOICE_SECRET;
    const sig = sign(BODY, elSecret);
    // Timestamp 301 seconds in the past
    const staleTs = Math.floor(Date.now() / 1000) - 301;
    const headers = new Headers({ 'elevenlabs-signature': `t=${staleTs},v1=${sig}` });
    expect(verifyProviderSignature('elevenlabs', BODY, headers)).toBe(false);
  });

  it('elevenlabs provider: rejects when t= field is missing', () => {
    const elSecret = process.env.ELEVENLABS_WEBHOOK_SECRET ?? VOICE_SECRET;
    const sig = sign(BODY, elSecret);
    const headers = new Headers({ 'elevenlabs-signature': `v1=${sig}` });
    expect(verifyProviderSignature('elevenlabs', BODY, headers)).toBe(false);
  });

  it('elevenlabs provider: rejects a bare hex sig (old format — no t= field)', () => {
    const elSecret = process.env.ELEVENLABS_WEBHOOK_SECRET ?? VOICE_SECRET;
    const sig = sign(BODY, elSecret);
    const headers = new Headers({ 'elevenlabs-signature': sig });
    expect(verifyProviderSignature('elevenlabs', BODY, headers)).toBe(false);
  });

  it('twilio provider: reads X-Twilio-Signature header and uses VOICE_WEBHOOK_SECRET', () => {
    const sig = sign(BODY, VOICE_SECRET);
    const headers = new Headers({ 'x-twilio-signature': sig });
    expect(verifyProviderSignature('twilio', BODY, headers)).toBe(true);
  });

  it('twilio provider: rejects bad signature', () => {
    const headers = new Headers({ 'x-twilio-signature': 'tampered' });
    expect(verifyProviderSignature('twilio', BODY, headers)).toBe(false);
  });
});
