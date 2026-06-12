---
phase: 02-tracking-portal
plan: 02
subsystem: share-token-codec
tags: [tdd, share-token, hmac, service, types]
requirements: [PORT-05, PORT-08]

dependency_graph:
  requires:
    - "02-01: SHARE_TOKEN_SECRET env field (plan 01 adds it)"
    - "01-04: tracking service factory pattern (createTrackingService)"
    - "01-04: MappedConsignment, TrackingResult, LookupFailureReason types"
  provides:
    - "createShareToken + verifyShareToken (HMAC-SHA256, base64url, embedded expiry)"
    - "MatchCandidate interface: safe per-candidate detail for the multiple-match chooser"
    - "TrackingResult multiple_matches arm now carries candidates: MatchCandidate[]"
    - "lookupForShare(consignmentNumber): postcode-gate-free status re-fetch"
  affects:
    - "02-03: share/print page consumes verifyShareToken + lookupForShare"
    - "02-04: ErrorState component consumes MatchCandidate[] for the chooser UI"
    - "All consumers of TrackingResult that switch on reason (union change is additive)"

tech_stack:
  added: []
  patterns:
    - "HMAC-SHA256 codec: base64url(JSON({c,exp})).<base64url-sig> — no postcode in token"
    - "crypto.timingSafeEqual for constant-time signature comparison (T-02-04)"
    - "Negative ttlSeconds to createShareToken for expired-token tests (no Date.now mock needed)"
    - "TrackingResult union split: multiple_matches arm is a distinct shape; other failures share the generic arm"
    - "lookupForShare shares the status-shaping code path from lookupConsignment but skips postcodesMatch"

key_files:
  created:
    - "src/lib/share/token.ts"
    - "src/lib/share/token.test.ts"
  modified:
    - "src/types/tracking.ts"
    - "src/lib/tracking/service.ts"
    - "src/lib/tracking/service.test.ts"

decisions:
  - "Share token encodes {c, exp} only — postcode never in token (T-02-06, D-12)"
  - "timingSafeEqual guards against timing oracles; length mismatch returns null before the comparison (T-02-04)"
  - "lookupForShare does not call logLookup — a share re-fetch is not a new customer lookup event"
  - "MatchCandidate carries town + plainStatus only — no postcode, no address lines (D-10 safe detail)"
  - "TrackingResult union now has two failure shapes: multiple_matches with candidates, others generic"

metrics:
  duration_seconds: 237
  completed_date: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 2 Plan 02: Share Token Codec and Service Extensions Summary

**One-liner:** HMAC-SHA256 share-token codec (create + verify with forgery/tamper/expiry/malformed rejection) plus postcode-gate-free `lookupForShare` and safe `MatchCandidate` surfacing for the multiple-match chooser, implemented test-first (RED then GREEN).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for share token codec | d5298b1 | src/lib/share/token.test.ts |
| 1 GREEN | Implement signed share token codec | d241165 | src/lib/share/token.ts, token.test.ts (env fix) |
| 2 RED | Failing tests for share-lookup and match candidates | e35dc4d | src/lib/tracking/service.test.ts |
| 2 GREEN | Surface match candidates and add postcode-gate-free share lookup | f88a0ab | src/types/tracking.ts, service.ts, service.test.ts |

## Verification Results

- `npx vitest run src/lib/share src/lib/tracking`: 36 tests, 4 test files, 0 failures
- `npx vitest run` (full suite): 64 tests, 9 test files, 0 failures
- `npx tsc --noEmit`: PASS (0 errors)
- `grep -c "export function createShareToken" src/lib/share/token.ts`: 1
- `grep -c "export function verifyShareToken" src/lib/share/token.ts`: 1
- `grep "timingSafeEqual" src/lib/share/token.ts`: matches (3 lines — import, guard comment, call)
- `grep -n "postcode" src/lib/share/token.ts`: 2 lines, both doc-comment only — no postcode in logic
- `grep -c "lookupForShare" src/lib/tracking/service.ts`: 4 (factory function, factory return, singleton JSDoc, singleton export)
- `MatchCandidate` has `consignmentNumber`, `delAddressTown`, `plainStatus` — no postcode field
- RED commits (`d5298b1`, `e35dc4d`) precede GREEN commits (`d241165`, `f88a0ab`) in git log

## TDD Gate Compliance

- Task 1: RED commit `d5298b1` (test) precedes GREEN commit `d241165` (feat) — COMPLIANT
- Task 2: RED commit `e35dc4d` (test) precedes GREEN commit `f88a0ab` (feat) — COMPLIANT

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Env Proxy cache prevents beforeEach secret injection**

- **Found during:** Task 1 GREEN verification
- **Issue:** The `env` Proxy in `env.ts` caches parsed env on first property access. Setting `process.env.SHARE_TOKEN_SECRET` in a `beforeEach` was too late — the Proxy had already cached (and failed validation) before tests ran. The original test used `beforeEach` for env setup but this is incompatible with the lazy-cache pattern.
- **Fix:** Moved all required env var assignments to module scope in `token.test.ts`, executed before the module import. This ensures the Proxy's first parse sees all required fields including `SHARE_TOKEN_SECRET`, `PALLEX_BASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Files modified:** `src/lib/share/token.test.ts`
- **Commit:** d241165 (folded into GREEN commit)

## Known Stubs

None — this plan adds pure logic (codec + service methods) with no data-rendering components.

## Threat Flags

None new beyond the plan's own threat register (T-02-04 through T-02-08), all mitigated as designed:
- Token encodes `{c, exp}` only — no postcode (T-02-06)
- Signature checked with `timingSafeEqual` (T-02-04)
- Tamper: altered payload invalidates sig (T-02-05)
- Expiry: `exp <= now` rejects (T-02-08)
- Postcode-gate bypass on share path is accepted by design (T-02-07)

## Self-Check: PASSED

- [x] `src/lib/share/token.ts` exists and exports `createShareToken` and `verifyShareToken`
- [x] `src/lib/share/token.test.ts` exists with forgery, tamper, expiry, malformed test cases
- [x] `src/types/tracking.ts` exports `MatchCandidate` and `multiple_matches` arm has `candidates`
- [x] `src/lib/tracking/service.ts` exports `lookupForShare` (factory + singleton)
- [x] Commits d5298b1, d241165, e35dc4d, f88a0ab all present in git log
- [x] Full test suite passes (64 tests, 0 failures)
- [x] `npx tsc --noEmit` exits 0
