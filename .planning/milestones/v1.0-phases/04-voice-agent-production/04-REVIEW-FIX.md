---
phase: 04-voice-agent-production
fixed_at: 2026-06-12T17:48:30Z
review_path: .planning/phases/04-voice-agent-production/04-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-06-12T17:48:30Z
**Source review:** .planning/phases/04-voice-agent-production/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: Duplicate HMAC verifiers accept different header formats

**Files modified:** `src/lib/voice/webhook-auth.ts`, `src/app/api/voice/contact_driver/route.ts`, `src/lib/voice/webhook-auth.test.ts`, `src/app/api/voice/contact_driver/route.test.ts`
**Commit:** 4940c3b
**Applied fix:** Deleted the local `verifyVoiceSignature` function from `contact_driver/route.ts` (including the crypto imports). Route now imports and uses `verifyProviderSignature('default', ...)` from the canonical `webhook-auth.ts`. The `webhook-auth.ts` ElevenLabs case was updated to use the structured `elevenlabs-signature: t=<ts>,v1=<hex>` header format (matching real ElevenLabs docs), replacing the old bare-hex format. Tests updated accordingly — the exported `verifyVoiceSignature` tests were removed from the route test file (they now live exclusively in `webhook-auth.test.ts`).

---

### CR-02: No replay protection (timestamp staleness) on any webhook route

**Files modified:** `src/lib/voice/webhook-auth.ts`, `src/lib/voice/webhook-auth.test.ts`
**Commit:** 4940c3b (combined with CR-01)
**Applied fix:** Added `MAX_SIG_AGE_SECONDS = 300` constant and timestamp staleness check to the ElevenLabs case in `verifyProviderSignature`. The `t=` field is now required and parsed; if `Math.abs(nowSec - signedAt) > 300` the function returns false regardless of HMAC validity. Both `t=` and `v1=` fields are mandatory — missing either returns false. Tests added: stale timestamp → false, missing `t=` field → false, bare hex (no structured format) → false.

---

### CR-03: Provider recording URL stored and served verbatim — may contain embedded credentials

**Files modified:** `src/app/api/voice/call_ended/route.ts`, `src/app/api/voice/call_lifecycle.test.ts`
**Commit:** 23062ce
**Applied fix:** Added `ALLOWED_RECORDING_HOSTS` allowlist check after Zod parse and before `updateCall`. URLs whose hostname does not end with `.elevenlabs.io` or `.twilio.com` receive a 400 response; malformed URLs (that fail `new URL()`) also return 400. Test fixture updated from `recordings.example.com` to `recordings.elevenlabs.io`; two new tests added: rejection of `evil.example.com` host (confirms `updateCall` not called) and acceptance of `api.twilio.com`.

---

### CR-04: `updateCall` keyed on caller-supplied `platform_call_id` with no ownership check

**Files modified:** `src/lib/repositories/calls-repo.ts`, `src/lib/repositories/calls-repo.test.ts`, `src/lib/repositories/calls-repo.write.test.ts`
**Commit:** b230769
**Applied fix:** Added `.eq('call_type', 'customer').eq('direction', 'inbound')` to the `updateCall` WHERE clause, limiting blast radius to inbound customer calls only. The `UpdateBuilder` interface was updated to return a chainable `UpdateBuilder` from `.eq()` with a `then()` method for awaiting. Two tests added in `calls-repo.test.ts` verifying all three filters are applied. The pre-existing `calls-repo.write.test.ts` fake client was updated to support the three-chained `.eq()` calls (was: single `.eq()` resolving to Promise).

---

### WR-01: Zod validation errors leaked in 400 responses across all five routes

**Files modified:** `src/app/api/voice/call_ended/route.ts`, `src/app/api/voice/call_started/route.ts`, `src/app/api/voice/lookup_consignment/route.ts`, `src/app/api/voice/request_human/route.ts`, `src/app/api/voice/contact_driver/route.ts`
**Commit:** 9d8b98a
**Applied fix:** Removed `issues: result.error.issues` and `details: result.error.flatten()` from all five 400 responses. All routes now return the generic `{ error: 'Invalid request body' }` with no schema detail.

---

### WR-02: `contact_driver` returns HTTP 200 on consent denial

**Files modified:** `src/app/api/voice/contact_driver/route.ts`, `src/app/api/voice/contact_driver/route.test.ts`
**Commit:** 9886acb
**Applied fix:** Consent-denied response now returns `{ contacted: false, reason: 'consent_not_given' }` so the ElevenLabs agent can check the `contacted` boolean and `reason` before reporting to the customer. Status remains 200 (ElevenLabs tool calls require 2xx). Test updated to assert on `reason`.

---

### WR-03: Attempt counter is shared across tracking_ref and postcode capture

**Files modified:** `src/lib/voice/conversation-machine.ts`, `src/lib/voice/conversation-machine.test.ts`
**Commit:** 3086443
**Applied fix:** Added `attempts: 0` reset to the state when transitioning from `tracking_ref` confirmation to `awaiting_postcode`. VOICE-05 is now interpreted as per-field: a caller gets 3 confirmation attempts per field independently. A comment documents the policy. Test added that verifies 2 tracking_ref failures followed by a confirmation resets the counter to 0, and a subsequent postcode rejection counts from 1.

---

### WR-04: `X-Transfer-Summary` header sends call transcript excerpt to Twilio

**Files modified:** `src/lib/voice/telephony/elevenlabs-twilio-adapter.ts`, `src/lib/voice/telephony/elevenlabs-twilio-adapter.test.ts`
**Commit:** 555c980
**Applied fix:** Removed the `'X-Transfer-Summary': summary` header from the `transferToHuman` Twilio API call. Added a detailed comment explaining why: Twilio logs all request headers including custom ones, and the summary may contain PII (postcodes, transcript excerpts) outside GDPR scope for Twilio's data retention. Warm-handoff context remains available via the calls-repo audit trail. Test added asserting the header is null on the captured request.

---

### WR-05: `VOICE_WEBHOOK_SECRET` has a hardcoded insecure default

**Files modified:** `src/lib/env.ts`, `src/lib/env.test.ts`, `src/lib/repositories/calls-repo.write.test.ts`
**Commit:** 9a0581f
**Applied fix:** Removed `.default('dev-only-insecure-voice-webhook-secret-change-me')` from the `VOICE_WEBHOOK_SECRET` Zod field. The schema now requires the variable unconditionally, matching the `DASHBOARD_PASSWORD` fail-loud pattern. `setup-dom.ts` already provides `VOICE_WEBHOOK_SECRET ||= 'test-voice-webhook-secret-32chars-minimum-xx'` so all tests remain green. `VALID_ENV` test fixture updated to include the secret. Two tests added: absent secret throws with field name, short secret throws.

---

### WR-06: `getCallById` called with raw URL param — no UUID format validation

**Files modified:** `src/app/dashboard/calls/[id]/page.tsx`
**Commit:** af37b31
**Applied fix:** Added `UUID_RE` regex constant and a `if (!UUID_RE.test(id)) notFound()` guard before the `getCallById` call. Malformed id params short-circuit to 404 without touching the database, preventing unnecessary Supabase query errors and potential schema information disclosure.

---

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-06-12T17:48:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
