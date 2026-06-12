---
phase: 01-foundation
plan: 04
subsystem: api
tags: [tracking-service, postcode-gate, status-map, tdd, orchestration]

requires:
  - phase: 01-foundation-plan-02
    provides: "getConsignmentsBySearchTerm (authenticated, breaker-wrapped Nexus client)"
  - phase: 01-foundation-plan-03
    provides: "logLookup (portal_lookups repository)"
  - phase: 01-foundation-plan-01
    provides: "src/types/tracking.ts (MilestoneStage, TrackingResult, MappedConsignment)"

provides:
  - "lookupConsignment({ trackingRef, postcode }): Promise<TrackingResult> — the single shared service for Phase 2 portal and Phase 4 voice tool (ARCHITECTURE.md Pattern 1)"
  - "createTrackingService(deps) factory for dependency injection in tests"
  - "normalisePostcode + postcodesMatch — UK postcode normalisation and format-insensitive comparison"
  - "mapStatusName — Nexus status.name -> plain label + description + 5-stage milestone"

affects:
  - "Phase 2 (tracking portal): all web lookups call lookupConsignment"
  - "Phase 4 (voice agent): voice tool endpoint calls lookupConsignment"
  - "Phase 1 success criteria: satisfies API-02, API-03, API-04"

tech-stack:
  added: []
  patterns:
    - "Factory + DI: createTrackingService(deps) enables tests to inject spies for nexusLookup, logLookup, and mapStatusName independently — postcode gate verified by asserting mapStatusName spy NOT called on mismatch"
    - "Postcode gate before shaping: postcodesMatch called at line 93, mapStatusName at line 99 — guards T-01-13 (Information Disclosure)"
    - "Null-passthrough: estimatedDelDate, startWindow, endWindow taken directly from Nexus response; null stays null (PITFALLS.md Pitfall 3)"

key-files:
  created:
    - src/lib/tracking/postcode.ts
    - src/lib/tracking/postcode.test.ts
    - src/lib/tracking/status-map.ts
    - src/lib/tracking/status-map.test.ts
    - src/lib/tracking/service.ts
    - src/lib/tracking/service.test.ts
  modified: []

key-decisions:
  - "Factory with optional mapStatusName dep: allows the postcode-mismatch test to inject a spy and assert mapStatusName is NOT called — directly verifying T-01-13 (data withheld before shaping) without coupling to internal implementation details."
  - "Multiple-matches logged under not_found bucket: LookupOutcome in Plan 03 does not include 'multiple_matches'; logging under not_found with a code comment deferring disambiguation to Phase 2 is consistent with the plan spec and avoids schema changes in this phase."
  - "Lazy default service singleton: getDefaultService() defers import('../nexus/client') and import('../repositories/lookup-log') to first call — avoids env access at module load, consistent with the lazy-singleton pattern established in Plans 02 and 03."

requirements: [API-02, API-03, API-04]

duration: 3min
completed: "2026-06-12"
---

# Phase 01 Plan 04: Tracking Service Summary

**Postcode-gated delivery status lookup wiring Nexus client + lookup-log repo into one shared `lookupConsignment` service; all five outcomes handled and logged; null ETAs passed through; unknown statuses fall back safely — satisfies API-02, API-03, API-04 end-to-end.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-12T09:49:32Z
- **Completed:** 2026-06-12T09:52:37Z
- **Tasks:** 3 (each with RED + GREEN commits)
- **Files created:** 6

## Accomplishments

- `normalisePostcode` + `postcodesMatch` handle all UK postcode format variants (DE1 1AA / de11aa / SW1A1AA); empty strings never match (T-01-13)
- `mapStatusName` covers all 5 canonical stages (booked, at_hub, out_for_delivery, in_transit, delivered) with plain-language labels and descriptions; unknown values return a safe fallback with a console.warn — never throw, never fabricate (PITFALLS.md Pitfall 3)
- `createTrackingService` factory enables full test isolation via injected spies; postcode gate (line 93) runs strictly before mapStatusName (line 99) so no status data is shaped for non-matching postcodes (success criterion 2, T-01-13)
- All four logging branches covered: found / not_found / postcode_mismatch / api_error + multiple_matches logged under not_found bucket
- Null ETA passthrough verified by dedicated test: `estimatedDelDate === null`, `startWindow === null`, `endWindow === null`
- 18 new tests; 46 total passing across the full phase suite; `npx tsc --noEmit` exits 0

## Task Commits

| Task | Name | Commits |
|------|------|---------|
| 1 RED | Postcode normalisation failing tests | `b6eac4a` test(01-04) |
| 1 GREEN | Postcode normalisation implementation | `ff390d8` feat(01-04) |
| 2 RED | Status-map failing tests | `85cea5c` test(01-04) |
| 2 GREEN | Status-map implementation | `dac6bcb` feat(01-04) |
| 3 RED | Service orchestration failing tests | `1dae755` test(01-04) |
| 3 GREEN | Service orchestration implementation | `76371f2` feat(01-04) |

## Files Created

- `src/lib/tracking/postcode.ts` — `normalisePostcode` + `postcodesMatch` (uppercase, strip spaces, reject empties)
- `src/lib/tracking/postcode.test.ts` — 5 tests: normalise, strip leading/trailing, match, mismatch, empty-never-matches
- `src/lib/tracking/status-map.ts` — `mapStatusName`: lookup table for all 5 stages + safe fallback with console.warn
- `src/lib/tracking/status-map.test.ts` — 7 tests: all 5 known stages + At Depot alias + unknown-does-not-throw
- `src/lib/tracking/service.ts` — `lookupConsignment` + `createTrackingService` factory; postcode gate before shaping
- `src/lib/tracking/service.test.ts` — 6 tests: found, postcode-mismatch (mapStatusName NOT called), not_found, api_error, multiple_matches, null-ETA-passthrough

## Decisions Made

- **Optional mapStatusName dep in factory**: injects a spy in the mismatch test to assert it is NOT called — directly verifies T-01-13 without brittle internal hooks.
- **Multiple-matches logged as not_found**: consistent with Plan 03's LookupOutcome enum; a code comment marks the deferral to Phase 2 disambiguation.
- **Lazy singleton**: defers env access to first call, consistent with Plans 02 and 03 patterns.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components deliver real behavior with no placeholder data.

## Threat Flags

No new threat surface. Verified mitigations:
- T-01-13: `postcodesMatch` called at line 93, `mapStatusName` at line 99 — gate verified by mismatch test asserting spy NOT called
- T-01-14: `mapStatusName` unknown-status returns safe fallback (no throw, no fabricated ETA); `api_error` branch returns immediately before any status shaping
- T-01-15: `consignments.length > 1` => `multiple_matches` with no auto-pick
- T-01-16: all four log outcome branches confirmed reachable via tests and grep

## Self-Check

Files exist:
- src/lib/tracking/postcode.ts — FOUND
- src/lib/tracking/status-map.ts — FOUND
- src/lib/tracking/service.ts — FOUND
- src/lib/tracking/postcode.test.ts — FOUND
- src/lib/tracking/status-map.test.ts — FOUND
- src/lib/tracking/service.test.ts — FOUND

Commits exist: b6eac4a, ff390d8, 85cea5c, dac6bcb, 1dae755, 76371f2 — all FOUND

Test results: 46 tests passed, 8 test files — VERIFIED
TypeScript: npx tsc --noEmit exits 0 — VERIFIED

## Self-Check: PASSED

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|------------|--------------|
| 1 (postcode) | `b6eac4a` test(01-04): add failing tests for postcode normalisation + match (RED) | `ff390d8` feat(01-04): implement postcode normalisation and format-insensitive match (GREEN) |
| 2 (status-map) | `85cea5c` test(01-04): add failing tests for status mapping to plain language + milestone (RED) | `dac6bcb` feat(01-04): implement status mapping to plain language and 5-stage milestone (GREEN) |
| 3 (service) | `1dae755` test(01-04): add failing tests for tracking service orchestration (RED) | `76371f2` feat(01-04): implement tracking service orchestration with postcode gate and outcome logging (GREEN) |

All RED/GREEN gate commits present and ordered correctly.

---
*Phase: 01-foundation*
*Completed: 2026-06-12*
