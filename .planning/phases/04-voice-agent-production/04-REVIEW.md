---
phase: 04-voice-agent-production
reviewed: 2026-06-12T09:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/app/api/voice/call_ended/route.ts
  - src/app/api/voice/call_started/route.ts
  - src/app/api/voice/contact_driver/route.ts
  - src/app/api/voice/lookup_consignment/route.ts
  - src/app/api/voice/request_human/route.ts
  - src/lib/voice/webhook-auth.ts
  - src/lib/voice/conversation-machine.ts
  - src/lib/voice/driver-escalation.ts
  - src/lib/voice/telephony/elevenlabs-twilio-adapter.ts
  - src/lib/repositories/calls-repo.ts
  - src/app/dashboard/calls/[id]/page.tsx
  - src/lib/env.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 4: Code Review Report (Re-review)

**Reviewed:** 2026-06-12T09:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This is the re-review following fixes for the four critical and six warning issues found in the initial pass. All ten previously reported issues are verified resolved. One new warning was introduced by the fixes (the `sendDtmf` TwiML injection — a latent bug in the adapter that the new code paths surface), and one info-level item remains.

No critical issues remain.

---

## Fix Verification

### CR-01 — Unified ElevenLabs verifier (structured `t=<ts>,v1=<hex>`): RESOLVED

`webhook-auth.ts` is the single canonical verifier. Every `/api/voice/*` route imports exclusively from `@/lib/voice/webhook-auth` and calls `verifyProviderSignature`. No duplicate verifier exists in `contact_driver/route.ts` — the route now calls `verifyProviderSignature('default', rawBody, req.headers)` at line 56.

Verified via grep: `verifyVoiceSignature` is no longer exported from any route file.

### CR-02 — 300 s replay-window staleness check: RESOLVED

`webhook-auth.ts` lines 119-121 implement the staleness guard correctly for the `elevenlabs` provider:
```
const signedAt = parseInt(tMatch[1], 10);
const nowSec = Math.floor(Date.now() / 1000);
if (Math.abs(nowSec - signedAt) > MAX_SIG_AGE_SECONDS) return false;
```
`MAX_SIG_AGE_SECONDS = 300` is declared at line 30. The check runs before HMAC verification, and both `tMatch` and `v1Match` are required (line 116). The `default` and `twilio` providers (used by all five routes) do not embed a timestamp in their header format; this is documented as a known limitation.

### CR-03 — Recording URL hostname allowlist: RESOLVED AND CORRECTLY IMPLEMENTED

`call_ended/route.ts` lines 68-82 implement the check. The implementation uses `new URL(parsed.recordingUrl).hostname` — which extracts only the hostname field, not the full URL string — and calls `.endsWith(suffix)` with a leading-dot suffix (`.elevenlabs.io`, `.twilio.com`).

This is a **proper hostname suffix check**, not a substring match. Verified with the Node REPL:
- `evil.com/.elevenlabs.io` → `hostname = evil.com` → BLOCKED
- `evil.comelevenlabs.io` → does not end with `.elevenlabs.io` (dot missing) → BLOCKED
- `evil.elevenlabs.io.evil.com` → does not end with `.elevenlabs.io` → BLOCKED
- `storage.elevenlabs.io` → ALLOWED
- `recordings.twilio.com` → ALLOWED

The apex domains `elevenlabs.io` and `twilio.com` (without subdomain) are blocked, which is slightly strict but conservative and correct.

### CR-04 — `updateCall` WHERE requires `call_type='customer'` AND `direction='inbound'`: RESOLVED

`calls-repo.ts` lines 220-229 chain `.eq('call_type', 'customer').eq('direction', 'inbound')` on the update query. A `platformCallId` matching a driver call row or a row with direction='outbound' will silently no-op (Supabase returns no error on zero rows matched) rather than overwriting unrelated data.

### WR-01 — Zod error details stripped from 400 responses: RESOLVED

All five route handlers return only `{ error: 'Invalid request body' }` with status 400, with no `issues` or `details` field. Confirmed in all files.

### WR-02 — Consent-denied returns `{ contacted: false, reason }`: RESOLVED

`contact_driver/route.ts` lines 87-92 return `{ contacted: false, reason: 'consent_not_given' }` with status 200. The structured payload allows the ElevenLabs agent to check the `contacted` boolean explicitly.

### WR-03 — Per-field attempt counter reset: RESOLVED

`conversation-machine.ts` line 221 resets `attempts: 0` when the tracking ref is confirmed and the machine transitions to `awaiting_postcode`. This gives the caller a fresh 3-attempt budget for postcode capture, matching the per-field intent of VOICE-05.

### WR-04 — `X-Transfer-Summary` PII header removed: RESOLVED

`elevenlabs-twilio-adapter.ts` lines 119-127 send the Twilio call-update request with only `Content-Type` and `Authorization` headers. The `summary` parameter is accepted by the method signature (for API compatibility) but not transmitted. The comment at lines 114-118 documents this explicitly.

### WR-05 — `VOICE_WEBHOOK_SECRET` required with no default: RESOLVED

`env.ts` line 40: `VOICE_WEBHOOK_SECRET: z.string().min(32)` — no `.default()`. The comment at lines 37-39 explicitly documents that this matches the `DASHBOARD_PASSWORD` pattern. The app will fail to boot if the variable is absent or under 32 characters.

Note: `webhook-auth.ts` line 106 still reads `process.env.VOICE_WEBHOOK_SECRET ?? ''` with an empty-string fallback. In isolation, this would allow HMAC bypass with an empty-secret signature. However, because `env.ts` enforces `min(32)` with no default, the app cannot start without the variable set, so the empty-string fallback is dead code in practice. It is not a bug, but it is technically redundant defensive code.

### WR-06 — UUID validation before `getCallById`: RESOLVED

`calls/[id]/page.tsx` lines 21-26 declare `UUID_RE` and call `notFound()` immediately if the `id` parameter does not match. The regex tests all four variant fields and is case-insensitive.

---

## Warnings

### WR-01: `sendDtmf` interpolates caller-supplied digits into TwiML without escaping

**File:** `src/lib/voice/telephony/elevenlabs-twilio-adapter.ts:136`
**Issue:** The `sendDtmf` method builds a TwiML string by direct interpolation:
```typescript
Twiml: `<Response><Play digits="${digits}"/></Response>`,
```
If `digits` contains a double-quote or `>` character, an attacker who controls the `digits` argument could inject arbitrary TwiML elements. For example:
```
digits = '1234"/><Dial>+15005550006</Dial><Play digits="'
```
produces:
```xml
<Response><Play digits="1234"/><Dial>+15005550006</Dial><Play digits=""/></Response>
```
This would place an outbound call to an attacker-specified number at Twilio's cost (toll fraud).

`sendDtmf` is not called from any current production code path (no caller in `driver-escalation.ts` or the route handlers), but it is part of the `VoiceTelephonyAdapter` interface and will be reachable once DTMF collection features are wired up. The same concern applies to `transferToHuman` line 112 (`Twiml: '<Response><Dial>${toNumber}</Dial></Response>'`) but `toNumber` is always sourced from `env.CONTACT_PHONE` or `driver.phone_e164` (managed DB), so that path has no untrusted-input exposure today.

**Fix:** Sanitise `digits` to the DTMF-legal character set before interpolation. DTMF digits are restricted to `0-9`, `*`, `#`, and `w` (wait):
```typescript
async sendDtmf(callId: string, digits: string): Promise<void> {
  // Restrict to legal DTMF characters before building TwiML (prevents injection)
  const safedigits = digits.replace(/[^0-9*#w]/g, '');
  if (!safedigits) return; // nothing valid to send

  const url = `${this.cfg.twilioBaseUrl}/.../${encodeURIComponent(callId)}.json`;
  const body = new URLSearchParams({
    Twiml: `<Response><Play digits="${safedigits}"/></Response>`,
  });
  // ...
}
```

---

## Info

### IN-01: `verifyVoiceSignature` exported from `webhook-auth.ts` but not used by any route

**File:** `src/lib/voice/webhook-auth.ts:53`
**Issue:** `verifyVoiceSignature` is a public export from `webhook-auth.ts` but no route calls it directly — all routes use `verifyProviderSignature`. It is used in `webhook-auth.test.ts` for unit testing the core primitive, which is a legitimate use. No action required.

**Fix:** No change needed. Consider adding a `@internal` JSDoc tag to signal that callers should prefer `verifyProviderSignature`:
```typescript
/** @internal Use verifyProviderSignature for all production call sites. */
export function verifyVoiceSignature(...) { ... }
```

---

_Reviewed: 2026-06-12T09:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
