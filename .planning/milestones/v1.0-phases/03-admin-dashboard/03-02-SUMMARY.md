---
phase: 03-admin-dashboard
plan: "02"
subsystem: data-layer
tags: [repository, tdd, pii-masking, seed-data, calls, drivers]
dependency_graph:
  requires: []
  provides:
    - createCallsRepo factory (getMetrics, listCustomerCalls, getCallById, getDriverCallsForParent)
    - createDriversRepo factory (listDrivers, insertDriver, updateDriver, deleteDriver)
    - maskPhone PII utility
    - getWindowStart / Period date-window helper
    - CallMetrics / CallSummary / CallListOptions shared types
    - seed-calls.ts dev seed script (25 customer calls, 4 driver calls, 5 drivers)
  affects:
    - src/lib/admin/types.ts
    - src/lib/admin/mask.ts
    - src/lib/admin/windows.ts
    - src/lib/repositories/calls-repo.ts
    - src/lib/repositories/drivers-repo.ts
    - src/lib/seed/seed-calls.ts
tech_stack:
  added: []
  patterns:
    - createLookupLogRepo injectable factory shape (extended for full query chain)
    - JS-level aggregation (no Supabase RPC)
    - PII masking at repository boundary (from_number_masked on CallSummary)
    - Lazy dynamic supabase import for test-safe module loading
key_files:
  created:
    - src/lib/admin/types.ts
    - src/lib/admin/mask.ts
    - src/lib/admin/windows.ts
    - src/lib/admin/mask.test.ts
    - src/lib/repositories/calls-repo.ts
    - src/lib/repositories/calls-repo.test.ts
    - src/lib/repositories/drivers-repo.ts
    - src/lib/repositories/drivers-repo.test.ts
    - src/lib/seed/seed-calls.ts
  modified: []
decisions:
  - maskPhone strips non-digits then guards on length; null→'—', <4 digits→'•••', else '••• ••• LAST4'
  - listCustomerCalls fetches all filtered rows then slices in JS for pagination (avoids two DB roundtrips with fake client; acceptable for Phase 3 volumes)
  - seed-calls uses top-level await (ESM-compatible with tsx runner)
  - driver calls linked to 2 escalated parent calls (el-seed-003, el-seed-008) to exercise driver sub-log UI
metrics:
  duration: 358s
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_created: 9
  tests_added: 23
---

# Phase 3 Plan 02: Admin Data Layer — Repository + Masking + Seed Summary

**One-liner:** Injectable calls/drivers repositories with JS-level aggregation, PII masking enforced at the repo boundary in both code and types, and a PALLEX_MOCK-guarded idempotent seed script producing 25 realistic calls and 5 drivers.

## What Was Built

### Task 1: Admin types, PII masking, date windows (c031cca)

- `src/lib/admin/mask.ts` — `maskPhone(raw)` masks caller phone to last-4 digits only: null→`'—'`, <4 digits→`'•••'`, else `'••• ••• XXXX'`
- `src/lib/admin/windows.ts` — `getWindowStart(period)` + `type Period` using `date-fns` `startOfDay`/`subDays`
- `src/lib/admin/types.ts` — `CallMetrics`, `CallSummary` (with `from_number_masked`, NO raw `from_number`), `CallListOptions`
- `src/lib/admin/mask.test.ts` — 4 unit tests (null, short, full UK number, no leaked digits)

### Task 2: calls-repo factory (6cc43b1)

- `src/lib/repositories/calls-repo.ts` — `createCallsRepo(client)` factory with:
  - `getMetrics(since)` — JS aggregation: received/answered/missed/successRate
  - `listCustomerCalls(opts)` — filters, pagination, `CallSummary[]` with `maskPhone` applied
  - `getCallById(id)` — `.single()` pattern, returns null on not-found
  - `getDriverCallsForParent(parentCallId)` — driver sub-log by parent_call_id
  - Extended `SupabaseLike` covering eq/gte/lte/ilike/order/range/single
  - Lazy default-repo with dynamic `import('../supabase')`
- `src/lib/repositories/calls-repo.test.ts` — 10 unit tests with in-memory fake client

### Task 3: drivers-repo CRUD + seed script (3ed1448)

- `src/lib/repositories/drivers-repo.ts` — `createDriversRepo(client)` factory with:
  - `listDrivers(activeOnly?)` — warns+returns [] on error (non-throwing)
  - `insertDriver`, `updateDriver`, `deleteDriver` — all throw on error (T-03-09)
  - Lazy default-repo with dynamic import
- `src/lib/repositories/drivers-repo.test.ts` — 9 unit tests including mutation error throws
- `src/lib/seed/seed-calls.ts` — standalone Node script:
  - Aborts unless `PALLEX_MOCK=true` (T-03-08)
  - Idempotent: exits if SEED- rows exist
  - 25 inbound customer calls (~8 in 24h, ~15 in 7d, 25 in 30d), all 4 outcomes
  - 5 calls with structured transcript JSON (`[{speaker,text,ts}]` — Phase 4 compatible)
  - 4 linked outbound driver calls (2 per escalated parent) for driver sub-log
  - 5 driver rows (1 inactive for deactivate toggle testing)

## Verification

```
npm test -- src/lib/admin/mask.test.ts src/lib/repositories/calls-repo.test.ts src/lib/repositories/drivers-repo.test.ts
✓ 23/23 tests pass
npm run typecheck → clean
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation | Location |
|-----------|-----------|----------|
| T-03-07 | maskPhone in listCustomerCalls; CallSummary type has no from_number field | calls-repo.ts, types.ts |
| T-03-08 | PALLEX_MOCK guard + process.exit(1) before any DB access | seed-calls.ts |
| T-03-09 | insert/update/delete all throw on error | drivers-repo.ts |
| T-03-10 | Repos access supabase only via lazy dynamic import | calls-repo.ts, drivers-repo.ts |

## Known Stubs

None — no hardcoded empty values, no placeholder data flowing to rendering layer.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced beyond those in the plan threat model.

## TDD Gate Compliance

| Phase | Commit | Status |
|-------|--------|--------|
| RED (mask.test.ts) | (pre-c031cca, test-only file staged) | PASS — module not found |
| GREEN (mask.ts + types + windows) | c031cca | PASS — 4/4 |
| RED (calls-repo.test.ts) | (pre-6cc43b1) | PASS — module not found |
| GREEN (calls-repo.ts) | 6cc43b1 | PASS — 10/10 |
| RED (drivers-repo.test.ts) | (pre-3ed1448) | PASS — module not found |
| GREEN (drivers-repo.ts + seed) | 3ed1448 | PASS — 9/9 |

All RED → GREEN gate sequences confirmed.

## Self-Check: PASSED

All created files verified to exist:
- src/lib/admin/mask.ts ✓
- src/lib/admin/mask.test.ts ✓
- src/lib/admin/types.ts ✓
- src/lib/admin/windows.ts ✓
- src/lib/repositories/calls-repo.ts ✓
- src/lib/repositories/calls-repo.test.ts ✓
- src/lib/repositories/drivers-repo.ts ✓
- src/lib/repositories/drivers-repo.test.ts ✓
- src/lib/seed/seed-calls.ts ✓

Commits verified:
- c031cca (Task 1) ✓
- 6cc43b1 (Task 2) ✓
- 3ed1448 (Task 3) ✓
