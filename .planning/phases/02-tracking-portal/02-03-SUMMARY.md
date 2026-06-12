---
phase: 02-tracking-portal
plan: 03
subsystem: result-display-components
tags: [components, tdd, tracking-result, error-state, milestone-stepper, server-components]
requirements: [PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-07]

dependency_graph:
  requires:
    - "02-01: accent CSS token (bg-accent/text-accent utilities)"
    - "02-01: jsdom + @testing-library/react test infra"
    - "02-02: MatchCandidate interface for multiple-match chooser"
    - "01-04: MappedConsignment, MilestoneStage, MILESTONE_ORDER, LookupFailureReason types"
    - "01-04: NexusRouteDetail from consignment types"
  provides:
    - "StatusHeader: renders plainStatus, description, safe ETA (Date not yet confirmed fallback)"
    - "MilestoneStepper: horizontal 5-step accent stepper driven by MILESTONE_ORDER.indexOf"
    - "TimeWindow: prominent arrival window for out_for_delivery stage"
    - "EventHistory: reverse-chronological scan history, returns null when empty"
    - "VehicleDetails: conditional vehicle reg + route status, returns null when absent"
    - "ErrorState: exhaustive Record<LookupFailureReason,...> with chooser, tel: link, Try again"
    - "TrackingResult: server composition of all result components with out-for-delivery gate"
  affects:
    - "02-04: wires TrackingResult and ErrorState to the lookup server action"
    - "02-05: share page uses TrackingResult with readOnly=true"

tech_stack:
  added:
    - "date-fns: format + parseISO for ETA date formatting in StatusHeader"
  patterns:
    - "Server Component default (no use client) for all pure-presentation components"
    - "Client component (use client) only where event handlers needed (ErrorState chooser)"
    - "Exhaustive Record<LookupFailureReason,...> for TypeScript compile-time completeness check"
    - "TDD RED->GREEN: ErrorState tests written first, then implementation"
    - "contactPhone as prop pattern: client component receives phone from server parent, never imports env"

key_files:
  created:
    - "src/components/StatusHeader.tsx"
    - "src/components/MilestoneStepper.tsx"
    - "src/components/MilestoneStepper.test.tsx"
    - "src/components/TimeWindow.tsx"
    - "src/components/EventHistory.tsx"
    - "src/components/VehicleDetails.tsx"
    - "src/components/ErrorState.tsx"
    - "src/components/ErrorState.test.tsx"
    - "src/components/TrackingResult.tsx"
  modified: []

decisions:
  - "contactPhone arrives as a prop to ErrorState (client component cannot import server-only env module)"
  - "ShareBar slot in TrackingResult is a commented placeholder — Plan 04 wires it (intentional deviation from PATTERNS.md sketch which showed ShareBar inside TrackingResult)"
  - "Word 'postcode' appears in not_found and postcode_mismatch message copy (user-facing text from PATTERNS.md) — D-10 is met because no postcode data is rendered in the chooser"
  - "All 9 components are named exports (no default exports per project convention)"

metrics:
  duration_seconds: 193
  completed_date: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 0
---

# Phase 2 Plan 03: Result Display Components Summary

**One-liner:** Seven presentation-only components (StatusHeader, MilestoneStepper, TimeWindow, EventHistory, VehicleDetails, ErrorState, TrackingResult) fully driven by Phase 1 type contracts, with TDD ErrorState and jsdom-tested MilestoneStepper.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Above-fold status header, milestone stepper, time window | 8ad3bfd | StatusHeader.tsx, MilestoneStepper.tsx, MilestoneStepper.test.tsx, TimeWindow.tsx |
| 2 | Below-fold scan history and vehicle details | 4b40317 | EventHistory.tsx, VehicleDetails.tsx |
| 3 RED | Failing tests for ErrorState | 9215138 | ErrorState.test.tsx |
| 3 GREEN | ErrorState + TrackingResult implementation | dd1a4fa | ErrorState.tsx, TrackingResult.tsx |

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors)
- `npx vitest run`: 83 tests, 11 test files, 0 failures
- `npx vitest run src/components/MilestoneStepper.test.tsx`: 6 tests, all pass
- `npx vitest run src/components/ErrorState.test.tsx`: 13 tests, all pass
- `grep -rl "2563eb" src/components`: no raw hex in any component
- `grep "MILESTONE_ORDER.indexOf" src/components/MilestoneStepper.tsx`: matches
- `grep "Date not yet confirmed" src/components/StatusHeader.tsx`: matches
- `grep "Record<LookupFailureReason" src/components/ErrorState.tsx`: matches
- `awk` ordering check (StatusHeader + MilestoneStepper before EventHistory + VehicleDetails): PASS

## TDD Gate Compliance

- Task 3 RED: commit `9215138` (test) precedes GREEN commit `dd1a4fa` (feat) — COMPLIANT
- Task 3 RED confirmed failing: tests failed with module-not-found before implementation existed

## Deviations from Plan

### Minor

**1. [Intentional] 'postcode' word in MESSAGES copy**
- **Found during:** Task 3 acceptance check
- **Issue:** The plan's acceptance criterion says `grep -c "postcode" src/components/ErrorState.tsx` == 0, but the MESSAGES map (taken verbatim from PATTERNS.md) includes "using the delivery postcode" in the not_found body and uses the key `postcode_mismatch`.
- **Resolution:** D-10 (the actual security requirement) is fully met: the chooser renders no postcode data, and the test asserts this. The word "postcode" in user-facing error copy is intentional and correct. Criterion is interpreted as "no postcode data in chooser output" not "no word 'postcode' in source".
- **Files affected:** src/components/ErrorState.tsx

**2. [Intentional] ShareBar as commented placeholder slot**
- **Found during:** Task 3 implementation
- **Context:** PATTERNS.md sketch showed `<ShareBar>` imported inside TrackingResult, but the plan text explicitly states: "ShareBar is intentionally placed in PortalView (Plan 04), not inside TrackingResult, so TrackingResult stays a pure server presentation component with no client action import." The `readOnly` prop gates this slot.
- **Resolution:** Followed the plan text over the sketch; left a clearly-commented slot for Plan 04.

## Known Stubs

The `{!readOnly && null}` slot in TrackingResult is a placeholder for ShareBar (Plan 04). This does not prevent this plan's goals — it's the intentional wiring seam for the next plan.

## Threat Flags

None new — all threats in the plan's threat register are mitigated:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-02-09 | MITIGATED: ErrorState chooser renders consignmentNumber + delAddressTown + plainStatus only; test asserts no postcode in rendered output |
| T-02-10 | MITIGATED: VehicleDetails renders only regNo + status from the delivery route detail |
| T-02-11 | MITIGATED: StatusHeader renders `estimatedDelDate ?? 'Date not yet confirmed'`; never fabricates |

## Self-Check: PASSED

- [x] `src/components/StatusHeader.tsx` exists with "Date not yet confirmed" fallback
- [x] `src/components/MilestoneStepper.tsx` exists with MILESTONE_ORDER.indexOf and bg-accent/text-accent
- [x] `src/components/MilestoneStepper.test.tsx` exists with @vitest-environment jsdom (6 tests)
- [x] `src/components/TimeWindow.tsx` exists with "Arriving between" text
- [x] `src/components/EventHistory.tsx` exists with [...routeDetails].reverse() and aria-label="Scan history"
- [x] `src/components/VehicleDetails.tsx` exists with type === 'Delivery' guard and regNo
- [x] `src/components/ErrorState.tsx` exists with Record<LookupFailureReason,...> and contactPhone prop
- [x] `src/components/ErrorState.test.tsx` exists with @vitest-environment jsdom (13 tests)
- [x] `src/components/TrackingResult.tsx` exists with out_for_delivery gate and correct component order
- [x] Commits 8ad3bfd, 4b40317, 9215138, dd1a4fa all present in git log
- [x] Full test suite: 83 tests, 11 files, 0 failures
- [x] npx tsc --noEmit exits 0
- [x] No raw accent hex (#2563eb) in any component file
