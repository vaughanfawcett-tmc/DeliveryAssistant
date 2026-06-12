---
status: partial
phase: 03-admin-dashboard
source: [03-VERIFICATION.md]
started: 2026-06-12T16:05:00Z
updated: 2026-06-12T16:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Login + auth gate
expected: Correct password → /dashboard with da_session httpOnly cookie; unauthenticated visit to /dashboard → redirect to /login
result: [pending]

### 2. Metrics period tabs
expected: Switching Today / 7 days / 30 days updates the four MetricCards (Received/Answered/Missed/Success-rate); empty-state copy shown when no data. Seed DB first with `npm run seed`.
result: [pending]

### 3. Call history filters + pagination
expected: Date-range, outcome, and tracking-ref search narrow results; active filters survive pagination to page 2 (preserved in URL).
result: [pending]

### 4. Driver CRUD flow
expected: Add/edit persists; deactivate shows "Driver deactivated" toast + Inactive badge; delete requires confirm dialog and removes the row.
result: [pending]

### 5. Transcript rendering
expected: Seeded call with transcript renders Agent/Customer speaker-labelled turns with timestamps; call with no transcript shows "Transcript not available for this call."
result: [pending]

### 6. Mobile responsive layout (375px)
expected: AdminShell hamburger opens nav drawer; DriverList and CallHistoryTable render as stacked cards (not tables).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
