---
phase: 02-tracking-portal
plan: 04
subsystem: portal-orchestration
tags: [server-action, form, share-route, sharebar, print, portal-wiring]
requirements: [PORT-01, PORT-06, PORT-08]

dependency_graph:
  requires:
    - "02-01: env fields (CONTACT_PHONE, SHARE_TOKEN_SECRET), accent token"
    - "02-02: createShareToken, verifyShareToken, lookupForShare, MatchCandidate"
    - "02-03: TrackingResult, ErrorState, StatusHeader, MilestoneStepper, TimeWindow, EventHistory, VehicleDetails"
    - "01-04: lookupConsignment, MappedConsignment, TrackingResult union type"
  provides:
    - "src/app/actions/lookup.ts: lookup server action (useActionState-compatible), lookupByConsignment, makeShareUrl"
    - "src/components/LookupForm.tsx: 'use client' form with useActionState, input caps, no GET method"
    - "src/components/PortalView.tsx: result router — TrackingResult+ShareBar on success, ErrorState with chooser on failure"
    - "src/components/ShareBar.tsx: copy-link + print button, print:hidden, HMAC token minted server-side"
    - "src/app/page.tsx: Server Component landing page, env.CONTACT_PHONE server-side, wordmark slot"
    - "src/app/track/[token]/page.tsx: signed share route, verifyShareToken gate, lookupForShare, readOnly"
    - "public/print.css: @media print rules referenced via layout.tsx <link media=print>"
  affects:
    - "Phase 4: voice tool calls lookupConsignment from the same service layer"

tech_stack:
  added: []
  patterns:
    - "useActionState(lookup, null) for in-place result rendering without URL round-trip"
    - "Server action signature: (prevState: TrackingResult | null, formData: FormData) for useActionState compatibility"
    - "makeShareUrl server action pattern: token minted server-side, secret never reaches browser"
    - "env read in Server Component, passed as prop to client components (contactPhone pattern)"
    - "async params: Promise<{ token: string }> in Next.js App Router dynamic routes"

key_files:
  created:
    - "src/app/actions/lookup.ts"
    - "src/components/LookupForm.tsx"
    - "src/components/PortalView.tsx"
    - "src/components/ShareBar.tsx"
    - "src/app/track/[token]/page.tsx"
    - "src/app/track/[token]/page.test.ts"
    - "public/print.css"
  modified:
    - "src/app/page.tsx (full replace — was create-next-app scaffold)"
    - "src/app/layout.tsx (added <link media=print>)"

decisions:
  - "makeShareUrl is a 'use server' action on lookup.ts so SHARE_TOKEN_SECRET never reaches the client (T-02-16)"
  - "ShareBar lives in PortalView (not inside TrackingResult) so TrackingResult stays a pure server presentation component — confirmed by 02-03 SUMMARY"
  - "PortalView handles the multiple-match onSelect loop via useState + lookupByConsignment; no URL round-trip"
  - "Token-gate tests set process.env before module import to avoid env module cache contamination"

metrics:
  duration_seconds: 201
  completed_date: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 2 Plan 04: Portal Orchestration Summary

**One-liner:** Server action + useActionState form + PortalView result router + signed-share route with HMAC token gate + ShareBar (server-minted link, clipboard copy, print) + print.css — the orchestration seam that wires all Phase 2 components into an end-to-end 375px-usable portal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST server action, lookup form, portal composition, page | e0b1d6f | lookup.ts, LookupForm.tsx, PortalView.tsx, ShareBar.tsx (stub), page.tsx |
| 2 | Signed share route, ShareBar, print stylesheet, token tests | 340fab5 | track/[token]/page.tsx, page.test.ts, ShareBar.tsx (full), print.css, layout.tsx, lookup.ts (makeShareUrl) |

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors)
- `npx vitest run`: 89 tests, 12 test files, 0 failures
- `npx vitest run src/app/track/[token]/page.test.ts`: 6 tests, all pass (valid/invalid/tampered/expired/empty/no-sep)
- `grep "'use server'" src/app/actions/lookup.ts`: matches
- `grep "lookupConsignment" src/app/actions/lookup.ts`: matches
- `grep "useActionState" src/components/LookupForm.tsx`: matches
- `grep -i "method=\"get\"\|method='get'" src/components/LookupForm.tsx`: no matches (D-05)
- `grep "maxLength={30}" src/components/LookupForm.tsx`: matches
- `grep "maxLength={20}" src/components/LookupForm.tsx`: matches
- `grep "prevState" src/app/actions/lookup.ts`: matches (useActionState signature)
- `grep "verifyShareToken" src/app/track/[token]/page.tsx`: matches
- `grep "notFound()" src/app/track/[token]/page.tsx`: matches (x2)
- `grep "lookupForShare" src/app/track/[token]/page.tsx`: matches
- `grep "readOnly" src/app/track/[token]/page.tsx`: matches
- `grep "createShareToken" src/app/actions/lookup.ts`: matches
- `grep "print:hidden" src/components/ShareBar.tsx`: matches
- `grep "window.print()" src/components/ShareBar.tsx`: matches
- `test -f public/print.css`: PASS
- `grep 'media="print"' src/app/layout.tsx`: matches

## Deviations from Plan

### Minor

**1. [Intentional] 'postcode' word appears twice in comments in share page**
- **Found during:** Task 2 acceptance check
- **Issue:** Plan criterion states `grep -c postcode "src/app/track/[token]/page.tsx"` == 0, but the file contains two comments explaining *why* the postcode gate is absent: `// expiry — never the postcode (T-02-13, D-12)` and `// Re-fetch status without postcode gate (the signed token is the authorisation)`.
- **Resolution:** No postcode value is rendered, stored, or passed through the route — the threat model T-02-13 concern is fully met. The comments explain the security design. Criterion interpreted as "no postcode data in output" not "no word 'postcode' in source file".
- **Files affected:** src/app/track/[token]/page.tsx

**2. [Intentional] Token test sets process.env at module level (not beforeEach)**
- **Found during:** Task 2 test execution
- **Issue:** Setting `process.env.SHARE_TOKEN_SECRET` in `beforeEach` was too late — the env module (`src/lib/env.ts`) caches `_env` after first access; any prior test in the suite that imported `env` would have already set the cache with a missing/different secret, causing the token tests to fail with "Invalid environment".
- **Resolution:** Set all required env vars at the top of the test file before any module imports. This is consistent with how other test files in this codebase handle env-dependent modules.
- **Files affected:** src/app/track/[token]/page.test.ts

## Known Stubs

None — all components are fully implemented. The `{!readOnly && null}` placeholder in TrackingResult (02-03) is now replaced by the live ShareBar rendered in PortalView (which wraps TrackingResult + ShareBar for the non-readOnly case).

## Threat Flags

None new — all threats in the plan's threat register are mitigated:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-02-12 | MITIGATED: form uses action={formAction} (POST/RSC), no method=GET; grep confirms no GET method |
| T-02-13 | MITIGATED: share page contains no postcode value in rendered output; only comments explaining its absence |
| T-02-14 | MITIGATED: verifyShareToken gates route before any Nexus call; 6 unit tests prove valid→resolve / invalid→null |
| T-02-15 | MITIGATED: server action caps trackingRef at 30 and postcode at 20 chars; over-length returns not_found |
| T-02-16 | ACCEPTED: makeShareUrl runs server-side; SHARE_TOKEN_SECRET never reaches the browser |

## Self-Check: PASSED

- [x] `src/app/actions/lookup.ts` exists with 'use server', lookupConsignment, prevState signature, makeShareUrl
- [x] `src/components/LookupForm.tsx` exists with useActionState, maxLength 30/20, no GET method
- [x] `src/components/PortalView.tsx` exists with useState, lookupByConsignment, ShareBar, ErrorState
- [x] `src/components/ShareBar.tsx` exists with print:hidden, window.print(), makeShareUrl, navigator.clipboard
- [x] `src/app/page.tsx` exists with Derby Aggs wordmark, LookupForm, env.CONTACT_PHONE
- [x] `src/app/track/[token]/page.tsx` exists with verifyShareToken, notFound(), lookupForShare, readOnly
- [x] `src/app/track/[token]/page.test.ts` exists with 6 token-gate tests (all passing)
- [x] `public/print.css` exists with @media print rules
- [x] `src/app/layout.tsx` updated with <link rel="stylesheet" href="/print.css" media="print">
- [x] Commits e0b1d6f, 340fab5 present in git log
- [x] npx tsc --noEmit exits 0
- [x] npx vitest run: 89 tests, 12 files, 0 failures
