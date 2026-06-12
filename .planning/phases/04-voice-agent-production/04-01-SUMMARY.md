---
phase: 04-voice-agent-production
plan: 01
subsystem: foundation/persistence
tags: [env, migration, repository, tdd, voice, telephony]
dependency_graph:
  requires: []
  provides:
    - voice/telephony env schema (ELEVENLABS_*, TWILIO_*, VOICE_WEBHOOK_SECRET, DRIVER_CALL_MAX_*)
    - supabase/migrations/0002_voice_recording_url.sql
    - CallRow.recording_url type
    - calls-repo insertCall/updateCall
    - drivers-repo getDriverById
  affects:
    - src/lib/env.ts
    - src/types/database.ts
    - src/lib/repositories/calls-repo.ts
    - src/lib/repositories/drivers-repo.ts
tech_stack:
  added: []
  patterns:
    - optionalCredential + mock-aware refine for telephony credentials
    - second independent .refine() for distinct voice credential failure domain
    - TDD RED/GREEN with injected fake SupabaseLike clients
    - throw-on-error mutations / return-null reads pattern (existing repo pattern extended)
key_files:
  created:
    - supabase/migrations/0002_voice_recording_url.sql
    - src/lib/repositories/calls-repo.write.test.ts
    - src/lib/repositories/drivers-repo.getbyid.test.ts
  modified:
    - src/lib/env.ts
    - src/types/database.ts
    - src/lib/repositories/calls-repo.ts
    - src/lib/repositories/drivers-repo.ts
    - src/test/setup-dom.ts
    - src/lib/env.test.ts
decisions:
  - VOICE_WEBHOOK_SECRET uses .min(32) with dev default, mirrors SHARE_TOKEN_SECRET — HMAC verification never silently disabled (T-04-01)
  - Second independent .refine() for voice credential validation so voice and Pall-Ex credential failures report at distinct paths
  - getDriverById returns null on error (non-throwing) — consistent with reads-warn pattern; voice agent lookup is a non-critical read
  - insertCall/updateCall throw on error — consistent with mutations-throw pattern (D-07)
metrics:
  duration_minutes: 10
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_changed: 8
---

# Phase 4 Plan 01: Voice Persistence Foundation Summary

**One-liner:** Voice/telephony env vars (ElevenLabs + Twilio + HMAC secret) validated mock-aware; `recording_url` migration + type added; `insertCall`/`updateCall` and `getDriverById` implemented TDD with fake-client injection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Voice env vars + recording_url migration + database type | 0e152a2 | src/lib/env.ts, supabase/migrations/0002_voice_recording_url.sql, src/types/database.ts, src/test/setup-dom.ts, src/lib/repositories/calls-repo.test.ts |
| 2 (RED) | Failing tests for insertCall/updateCall/getDriverById | d8dc046 | src/lib/repositories/calls-repo.write.test.ts, src/lib/repositories/drivers-repo.getbyid.test.ts |
| 2 (GREEN) | Implement insertCall, updateCall, getDriverById | c8acb75 | src/lib/repositories/calls-repo.ts, src/lib/repositories/drivers-repo.ts, src/lib/env.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed calls-repo.test.ts mock CallRow missing recording_url**
- **Found during:** Task 1
- **Issue:** Adding `recording_url: string | null` to CallRow caused tsc error in pre-existing test helper that constructed mock CallRows without the new field
- **Fix:** Added `recording_url: null` to the `makeCustomerCall` helper in calls-repo.test.ts
- **Files modified:** src/lib/repositories/calls-repo.test.ts
- **Commit:** 0e152a2

**2. [Rule 1 - Bug] Fixed env.test.ts PALLEX_MOCK=false tests broken by new voice refine**
- **Found during:** Task 2 (GREEN — full test run)
- **Issue:** Existing env.test.ts tests that tested PALLEX_MOCK=false scenarios (defaults test, PALLEX_USERNAME/PASSWORD missing tests) did not include the new voice credentials — the second refine now also requires them when mock=false
- **Fix:** Added LIVE_ENV constant (extends VALID_ENV with PALLEX_MOCK=false + all voice credentials); updated the affected tests to use LIVE_ENV instead of manually constructing PALLEX_MOCK=false variants
- **Files modified:** src/lib/env.test.ts
- **Commit:** c8acb75

## TDD Gate Compliance

- RED gate commit: d8dc046 (`test(04-01): add failing tests...`) — 7 tests failing
- GREEN gate commit: c8acb75 (`feat(04-01): implement...`) — all 7 tests pass
- No REFACTOR gate needed (code was clean on first implementation)

## Known Stubs

None — all new methods are fully implemented against the Supabase types. recording_url column is nullable by design (null in mock mode, D-08).

## Threat Flags

None — no new network endpoints or auth paths introduced. recording_url column is on the existing service-role-only, RLS-enabled calls table (T-04-02 accepted in plan threat model).

## Self-Check: PASSED

Files verified:
- supabase/migrations/0002_voice_recording_url.sql: EXISTS
- src/lib/repositories/calls-repo.write.test.ts: EXISTS
- src/lib/repositories/drivers-repo.getbyid.test.ts: EXISTS

Commits verified:
- 0e152a2: feat(04-01) env vars + migration + type
- d8dc046: test(04-01) RED gate
- c8acb75: feat(04-01) GREEN gate

Test results: 125/125 passed; tsc: clean
