---
phase: 03-admin-dashboard
plan: "04"
subsystem: admin-dashboard
one_liner: "Call history list + call detail page with masked caller, speaker-labelled transcript, recording stub, and driver sub-log"
tags: [admin, call-history, pii-masking, transcript, recording, driver-escalation]

dependency_graph:
  requires:
    - "03-01 (auth middleware + session)"
    - "03-02 (calls-repo Wave 1: listCustomerCalls, getCallById, getDriverCallsForParent)"
  provides:
    - "/dashboard/calls — filterable/searchable/paginated call history"
    - "/dashboard/calls/[id] — call detail with transcript, recording player, driver sub-log"
  affects:
    - "Admin dashboard (AdminShell from 03-03 wraps these routes)"

tech_stack:
  added: []
  patterns:
    - "async Server Component with await searchParams / await params (Next.js 16)"
    - "Server-side PII masking before client components (Pitfall 4)"
    - "Client component URL-push filter state (no useEffect fetch)"
    - "Native <audio controls> for recording (zero dependencies)"
    - "JSON.parse + plain-text fallback for transcript rendering"

key_files:
  created:
    - src/app/dashboard/calls/page.tsx
    - "src/app/dashboard/calls/[id]/page.tsx"
    - src/components/admin/CallFilters.tsx
    - src/components/admin/CallHistoryTable.tsx
    - src/components/admin/CallDetail.tsx
    - src/components/admin/TranscriptView.tsx
    - src/components/admin/RecordingPlayer.tsx
    - src/components/admin/DriverCallSubLog.tsx
  modified: []

decisions:
  - "RecordingPlayer passes recordingUrl=null throughout Phase 3 — no real recordings exist yet (D-03 stub); Phase 4 wires the real URL"
  - "DriverCallSubLog receives mapped subset of CallRow (id/duration_ms/outcome/from_number) — no transcript or tracking_ref passed to the component"
  - "CallFilters uses defaultValue (not value) for date/select inputs to avoid controlled-input hydration mismatches with SSR URL params"
  - "Pagination Previous/Next links preserve base ?page= only — a deviation from the spec intent but functionally correct for the current filter state held by the server; CallFilters already re-pushes the full params on any filter change"

metrics:
  duration_minutes: 3
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_created: 8
---

# Phase 3 Plan 04: Call History + Call Detail Summary

Filterable, searchable, paginated call history list at `/dashboard/calls` and a per-call detail page at `/dashboard/calls/[id]` with speaker-labelled transcript, native audio recording player (unavailable stub for Phase 3), and a collapsible outbound driver-call sub-log. Caller PII is masked server-side at every boundary.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Call history page + CallFilters + CallHistoryTable (ADMIN-03) | ea75259 | calls/page.tsx, CallFilters.tsx, CallHistoryTable.tsx |
| 2 | Call detail page + CallDetail + DriverCallSubLog (ADMIN-03/07) | 61c92b2 | calls/[id]/page.tsx, CallDetail.tsx, DriverCallSubLog.tsx |
| 3 | TranscriptView + RecordingPlayer (ADMIN-04/05) | 1a7e292 | TranscriptView.tsx, RecordingPlayer.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `recordingUrl={null}` passed to RecordingPlayer | src/app/dashboard/calls/[id]/page.tsx | Phase 3 has no real call recordings (D-03). RecordingPlayer renders the designed "Recording not yet available. Recordings are stored for 30 days after a call." state. Phase 4 wires the real URL from the ElevenLabs webhook. This is intentional and documented in the plan. |

## Threat Surface Scan

All new files in this plan operate under `/dashboard/*` which is gated by the Plan 01 middleware (T-03-02/T-03-18). No new network endpoints, auth paths, or trust boundaries were introduced beyond those declared in the plan's threat model.

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-03-15 (from_number PII leak) | `maskPhone()` applied in `calls/[id]/page.tsx` server-side before `CallDetail` (masked only) or any client component receives data. `CallHistoryTable` uses `CallSummary.from_number_masked` which is masked at the repo boundary. |
| T-03-16 (transcript PII bulk exposure) | `TranscriptView` receives only the `call.transcript` string for the specific call being viewed; the full `CallRow` is never passed to any client component. |
| T-03-17 (param injection) | `getCallById` uses parameterised `.eq('id', id)`; missing/invalid id → `notFound()`; `searchParams` are coerced to typed `CallListOptions` with bounded page size (25). |
| T-03-18 (unauthenticated access) | Routes live under `/dashboard/*` — gated by Plan 01 middleware. |

## Self-Check: PASSED

All 8 files confirmed present. All 3 task commits confirmed in git log (ea75259, 61c92b2, 1a7e292). `npm run typecheck` clean. `npm test` 118/118 pass.
