---
phase: 04-voice-agent-production
plan: 05
subsystem: voice/driver-escalation
tags: [voice, driver, escalation, HMAC, security, tdd]
dependency-graph:
  requires: [04-01, 04-02, 04-03]
  provides: [driver-escalation-machine, contact_driver-route]
  affects: [calls-table, drivers-table]
tech-stack:
  added: []
  patterns: [pure-machine-injected-deps, HMAC-timingSafeEqual, retry-loop-bounded, TDD-red-green]
key-files:
  created:
    - src/lib/voice/driver-escalation.ts
    - src/lib/voice/driver-escalation.test.ts
    - src/app/api/voice/contact_driver/route.ts
    - src/app/api/voice/contact_driver/route.test.ts
  modified: []
decisions:
  - HMAC verification implemented self-contained in route.ts (verifyVoiceSignature) rather than importing plan 04-04's webhook-auth.ts which is in a sibling wave worktree
  - getEta injectable dep on machine (returns null for default/route use, injectable in tests for controlled outcomes)
  - Escalation with no getEta defaults to null -> 'escalated' outcome after retries (safe default)
metrics:
  duration: 267s
  completed: 2026-06-12T16:25:52Z
  tasks-completed: 2
  files-created: 4
  tests-added: 22
---

# Phase 4 Plan 05: Driver Escalation State Machine + contact_driver Route Summary

**One-liner:** Consent-gated driver escalation with HMAC-auth using timingSafeEqual, bounded retry/duration machine, and parent-linked per-attempt audit logging — DRIV-01..04 proven offline with MockTelephonyAdapter.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | driver-escalation state machine with hard limits + per-attempt logging | e6cfa13 | driver-escalation.ts, driver-escalation.test.ts |
| 2 | contact_driver signed route handler | ade528a | contact_driver/route.ts, contact_driver/route.test.ts |

## What Was Built

### Task 1 — `src/lib/voice/driver-escalation.ts`

Pure `runDriverEscalation(input, deps)` state machine. All I/O via injected `deps` (adapter, getDriverById, insertCall, getEta, now) so the machine is fully testable without env or live services.

Key behaviours:
- Resolves driver from managed list via `getDriverById`; unknown id -> `'failed'`, no call placed (T-04-20)
- Retry loop bounded by `maxRetries` (default 2; max 3 total attempts) — T-04-21 toll-fraud guard
- Each attempt (success, failure, or duration overrun) writes a `calls` row: `call_type:'driver'`, `direction:'outbound'`, `parent_call_id` set — full audit trail (T-04-22)
- Duration overrun invokes `adapter.endCall()` before logging the attempt as `'failed'`
- Exports `MAX_RETRIES` and `MAX_DURATION_S` as named constants (grep compliance)

### Task 2 — `src/app/api/voice/contact_driver/route.ts`

Next.js App Router `POST` handler. Security properties (all test-enforced):
- **T-04-19:** `verifyVoiceSignature()` runs FIRST using `timingSafeEqual` HMAC-SHA256 against `VOICE_WEBHOOK_SECRET` — unsigned/bad-sig requests get 401 before any DB or telephony operation
- **T-04-23:** `consented:false` returns `{ contacted:false }` immediately, zero `placeOutboundCall` calls
- **T-04-20:** Body supplies only `driverId`; phone resolved server-side via `getDriverById` — caller cannot supply a destination
- Supports both ElevenLabs structured header format (`t=<ts>,v1=<hex>`) and simple `X-Voice-Signature` hex
- `PALLEX_MOCK=true` selects `MockTelephonyAdapter`; production lazy-imports `createElevenLabsTwilioAdapter()`

## Test Coverage

```
src/lib/voice/driver-escalation.test.ts   — 9 tests
src/app/api/voice/contact_driver/route.test.ts — 13 tests
Total: 22 tests (all pass)
```

Coverage: happy path, driver-not-found, unreachable-retry loop (failNextPlace + always-fail), duration exceeded, sig gate (absent/bad), consent gate, body validation, server-side dest resolution.

## Deviations from Plan

### Auto-resolved Issues

**1. [Rule 3 - Blocking] verifyVoiceSignature implemented self-contained (not imported from 04-04)**

- **Found during:** Task 2 pre-flight
- **Issue:** Plan 04-04's `webhook-auth.ts` is in a sibling wave-2 worktree and is not present in this worktree (wave-2 parallel execution). Parallel instructions explicitly anticipated this and said to implement inline.
- **Fix:** `verifyVoiceSignature()` implemented directly in `route.ts` using the same `createHmac + timingSafeEqual` pattern as `src/lib/share/token.ts`. Supports both ElevenLabs structured format and bare hex signature for flexibility.
- **Files modified:** `src/app/api/voice/contact_driver/route.ts`
- **Commit:** ade528a

**2. [Rule 1 - Bug] `vi.fn<[T], R>()` TypeScript overload rejected by strict compiler**

- **Found during:** Task 1 tsc check
- **Issue:** `vi.fn<[CallInsert], Promise<void>>()` syntax used in tests triggered TS2558 with the project's vitest version — `vi.fn` takes at most 1 type arg
- **Fix:** Replaced with typed `makeInsertSpy()` helper that creates `vi.fn((_row: CallInsert) => Promise.resolve())` — no type args needed; calls access via `.mock.calls` typed correctly
- **Files modified:** `src/lib/voice/driver-escalation.test.ts`
- **Commit:** e6cfa13

## Known Stubs

None — the machine is fully wired. In the route, `getEta` defaults to `async () => null` which means deployed without a real ETA extraction mechanism, escalation calls will always exhaust retries. This is intentional for the current phase — ETA extraction from call transcripts is a Phase 4 voice-agent feature to be wired by the inbound agent plan (04-04/VOICE integration). The machine is correct: no invented ETAs (VOICE-08 structural guarantee).

## Threat Surface Scan

No new network endpoints beyond what the plan specified. `/api/voice/contact_driver` is the only new public surface — fully covered by the threat model in the plan (T-04-19..T-04-23), all mitigations implemented and test-enforced.

## Self-Check: PASSED

- `src/lib/voice/driver-escalation.ts` — exists, 120+ lines, exports MAX_RETRIES, MAX_DURATION_S
- `src/app/api/voice/contact_driver/route.ts` — exists, exports POST, verifyVoiceSignature
- `src/lib/voice/driver-escalation.test.ts` — exists, 9 tests pass
- `src/app/api/voice/contact_driver/route.test.ts` — exists, 13 tests pass
- Commits e6cfa13, ade528a — present in git log
- `npx tsc --noEmit` — exits 0
- `npx vitest run` — 218 tests pass (26 test files, zero regressions)
