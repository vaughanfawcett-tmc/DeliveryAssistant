---
status: partial
phase: 02-tracking-portal
source: [02-VERIFICATION.md]
started: 2026-06-12
updated: 2026-06-12
---

## Current Test

[awaiting human testing — run `npm run dev` and open http://localhost:3000]

## Tests

### 1. Above-the-fold layout at 375px
expected: On a 375px-wide viewport, after a successful lookup, the status heading, plain-language description, ETA line, and all 5 milestone stepper steps are visible without scrolling.
result: [pending]

### 2. Time window prominence
expected: For an out-for-delivery consignment, the "Arriving between HH:MM and HH:MM" banner reads as visually prominent (not buried in body text).
result: [pending]

### 3. End-to-end share link flow
expected: From a result page, "Copy link" copies a /track/<token> URL; opening it in a fresh/incognito window renders the status read-only (no lookup form, no ShareBar); a tampered or expired token returns a 404. No postcode appears anywhere in the URL.
result: [pending]

### 4. Print output
expected: Using the browser's print preview on a result page, interactive controls (the lookup form and ShareBar) are hidden; the status, timeline, and history print cleanly.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
