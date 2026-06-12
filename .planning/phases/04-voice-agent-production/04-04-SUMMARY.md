---
phase: 04-voice-agent-production
plan: "04"
subsystem: voice-webhooks
tags: [voice, webhooks, hmac, elevenlabs, calls, persistence]
dependency_graph:
  requires:
    - 04-01  # calls-repo insertCall/updateCall, env voice vars
    - 04-02  # conversation-machine, compliance, types
    - 04-03  # (admin dashboard shapes — TranscriptView transcript format)
  provides:
    - src/lib/voice/webhook-auth.ts
    - src/app/api/voice/lookup_consignment/route.ts
    - src/app/api/voice/request_human/route.ts
    - src/app/api/voice/call_started/route.ts
    - src/app/api/voice/call_ended/route.ts
  affects:
    - 04-05  # contact_driver can reuse verifyProviderSignature
    - 04-06  # production runbook — webhook secrets + endpoint URLs
tech_stack:
  added: []
  patterns:
    - constant-time HMAC-SHA256 + timingSafeEqual length guard (replicates token.ts)
    - 401-first webhook guard pattern (all 4 handlers)
    - thin adapter (route → service/repo, no logic duplication)
    - vi.mock to prevent server-only import chain in tests
key_files:
  created:
    - src/lib/voice/webhook-auth.ts
    - src/lib/voice/webhook-auth.test.ts
    - src/app/api/voice/lookup_consignment/route.ts
    - src/app/api/voice/lookup_consignment/route.test.ts
    - src/app/api/voice/request_human/route.ts
    - src/app/api/voice/request_human/route.test.ts
    - src/app/api/voice/call_started/route.ts
    - src/app/api/voice/call_ended/route.ts
    - src/app/api/voice/call_lifecycle.test.ts
  modified:
    - src/test/setup-dom.ts  # added infra env stubs (PALLEX_BASE_URL, SUPABASE_URL, etc.)
decisions:
  - "vi.mock('@/lib/repositories/calls-repo') and vi.mock('@/lib/tracking/service') used in tests to prevent supabase's server-only import chain from firing in vitest node environment"
  - "MilestoneStage is a string union ('booked'|'in_transit'|...) not a number — test mocks corrected"
  - "All 4 handlers use verifyProviderSignature('default', ...) using x-voice-signature header; elevenlabs and twilio providers available for future use"
metrics:
  duration: "7 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 9
  files_modified: 1
  tests_added: 52
---

# Phase 04 Plan 04: Signed Voice Webhooks Summary

**One-liner:** Constant-time HMAC webhook verifier + 4 signed, thin route handlers (lookup_consignment VOICE-08 pass-through, request_human warm-handoff, call_started/call_ended persistence) — all rejecting forgeries with 401-first.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | webhook-auth.ts — constant-time per-provider HMAC verifier | `0059f60` | webhook-auth.ts, webhook-auth.test.ts |
| 2 | lookup_consignment + request_human route handlers | `8d51e9d` | lookup_consignment/route.ts+test, request_human/route.ts+test, setup-dom.ts |
| 3 | call_started + call_ended lifecycle handlers | `79f5506` | call_started/route.ts, call_ended/route.ts, call_lifecycle.test.ts |

## What Was Built

### webhook-auth.ts
- `verifyVoiceSignature(rawBody, signature, secret)`: HMAC-SHA256 + `timingSafeEqual` + length guard (replicates `token.ts` pattern). Never throws. Returns false on null/empty/short/wrong signature.
- `verifyProviderSignature(provider, rawBody, headers)`: dispatches to the correct header (`x-voice-signature`, `elevenlabs-signature`, `x-twilio-signature`) and the correct secret (provider-specific or `VOICE_WEBHOOK_SECRET`). Lazy env reads so tests can stub freely.

### lookup_consignment/route.ts
- 401-first HMAC guard via `verifyProviderSignature('default', ...)`
- zod input validation (trackingRef, postcode required; 400 on invalid)
- Thin pass-through to `lookupConsignment()` from `src/lib/tracking/service.ts`
- Response carries ONLY `TrackingResult` fields — null ETAs passed through, nothing fabricated (VOICE-08 structural guarantee)

### request_human/route.ts
- 401-first guard
- Returns `{ transferTo: env.CONTACT_PHONE, summary: string|null }` (VOICE-06 warm-handoff)

### call_started/route.ts
- 401-first guard
- `insertCall({ call_type:'customer', direction:'inbound', ... })` via calls-repo (D-07)

### call_ended/route.ts
- 401-first guard
- Outcome validated as `'resolved'|'escalated'|'no_data'|'failed'` zod enum (400 otherwise)
- `JSON.stringify(transcriptTurns)` — array of `{speaker, text, ts?}` matching TranscriptView.parseTranscript format
- `updateCall(platformCallId, { end_at, duration_ms, outcome, transcript, recording_url, disconnection_reason })` (T-04-16 auditable record, D-08 recording URL)

## Test Coverage

- **52 new tests** (16 webhook-auth + 16 lookup+request_human + 20 lifecycle)
- **248 total passing** (no regressions across all 28 test files)
- Every 401-first test asserts spy call count = 0 — proves no side effects before signature check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MilestoneStage is a string union not a number**
- **Found during:** Task 2 (tsc check)
- **Issue:** Test mocks used `currentStage: 3` (number) but `MilestoneStage` is `'booked'|'at_hub'|'in_transit'|'out_for_delivery'|'delivered'`
- **Fix:** Corrected mock values to `'in_transit'` and `'booked'`
- **Files modified:** src/app/api/voice/lookup_consignment/route.test.ts

**2. [Rule 3 - Blocking] server-only import chain prevented tests from running**
- **Found during:** Task 2 (tests failed with "This module cannot be imported from a Client Component module")
- **Issue:** `lookupConsignment` (default singleton) lazily imports `supabase.ts` which carries `import 'server-only'`. The vitest node environment rejects this.
- **Fix:** Used `vi.mock('@/lib/tracking/service')` and `vi.mock('@/lib/repositories/calls-repo')` to intercept before the server-only chain fires. Precedent: tracking service tests already use the factory pattern for the same reason.
- **Files modified:** route.test.ts files (both lookup and lifecycle)

**3. [Rule 3 - Blocking] Missing infra env stubs in setup-dom.ts**
- **Found during:** Task 2 (env parse failure — PALLEX_BASE_URL, SUPABASE_URL etc. required)
- **Issue:** Tests touching env.ts via the route handlers failed schema validation because setup-dom.ts only stubbed DASHBOARD_* and VOICE_WEBHOOK_SECRET, not the infrastructure vars.
- **Fix:** Added `||=` stubs for PALLEX_MOCK, PALLEX_BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN to setup-dom.ts (non-breaking — `||=` preserves any existing value set by individual test files).
- **Files modified:** src/test/setup-dom.ts

## Threat Model Coverage

All T-04-13 through T-04-17 mitigations verified:

| Threat | Mitigation | Verified by |
|--------|-----------|-------------|
| T-04-13 Spoofing | 401-first on all 4 handlers | spy call count = 0 on bad sig |
| T-04-14 Tampering | zod validation on every payload | 400 tests |
| T-04-15 Info disclosure | lookup returns only TrackingResult fields | null ETA round-trip test |
| T-04-16 Repudiation | transcript+outcome+disconnection_reason persisted | updateCall patch assertions |
| T-04-17 from_number PII | stored server-side; maskPhone at read boundary (existing) | pre-existing |

## Verification

```
npx vitest run src/lib/voice src/app/api/voice  → 9 test files, 117 tests, all green
npx vitest run                                   → 28 test files, 248 tests, all green
npx tsc --noEmit                                 → exit 0
grep -rL "verifyProviderSignature" src/app/api/voice/*/route.ts → no output (all handlers verified)
```

## Self-Check: PASSED

All 9 created files confirmed on disk. All 3 task commits (0059f60, 8d51e9d, 79f5506) confirmed in git log.
