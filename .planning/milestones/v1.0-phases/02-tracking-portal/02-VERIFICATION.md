---
phase: 02-tracking-portal
verified: 2026-06-12T12:16:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Submit a tracking number and postcode on a 375px viewport (Chrome DevTools mobile emulation). Confirm status, ETA, and the 5-step milestone stepper are all visible above the fold without scrolling."
    expected: "Status heading, plain-language description, estimated delivery date, and the full milestone stepper are all fully visible on a 375px screen before any scroll."
    why_human: "Above-the-fold layout cannot be verified by static grep or build output — it requires visual rendering at the target viewport width."
  - test: "Submit a tracking number that is 'out for delivery' (use a mock fixture where currentStage=out_for_delivery with startWindow and endWindow set). Confirm the time window banner renders prominently."
    expected: "An 'Arriving between HH:MM and HH:MM' banner appears in the accent colour, visually prominent, below the milestone stepper."
    why_human: "Conditional rendering and prominence of the time window at 375px requires visual inspection to confirm it reads as prominent and is not obscured."
  - test: "Use 'Copy share link' on a result page, then open the copied URL in a fresh browser tab (or incognito). Confirm the status page renders read-only with no share bar or form controls."
    expected: "The share page shows the tracking status, ETA, and history. No lookup form, no Share/Print bar. Attempting to modify the URL token (change one character) should return a 404."
    why_human: "End-to-end share link flow requires a running browser — clipboard API, URL navigation, and visual readOnly confirmation cannot be verified statically."
  - test: "Open the page and use the Print function (either via ShareBar 'Print' button or Cmd+P). Confirm the form controls and share bar are hidden in the printed output."
    expected: "Print preview shows only the tracking result (status, stepper, history). LookupForm inputs, the 'Track delivery' button, and the ShareBar buttons are absent from the print view."
    why_human: "Print stylesheet behaviour requires visual inspection of print preview."
---

# Phase 2: Tracking Portal — Verification Report

**Phase Goal:** A customer can look up their delivery status on a mobile phone using a tracking number and postcode, and see all relevant delivery information with clear handling of every error state.
**Verified:** 2026-06-12T12:16:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Customer on 375px can POST tracking number + postcode and see status, ETA, and milestone timeline above the fold — no sensitive data in URL | VERIFIED (automated) + HUMAN NEEDED (viewport) | `LookupForm` uses `useActionState` with `action={formAction}` — no `method="get"`, no GET URL. `TrackingResult` composes `StatusHeader` + `MilestoneStepper` first. Above-fold ordering confirmed by awk check. Visual confirmation at 375px requires human. |
| 2 | When out for delivery, portal shows the delivery time window (e.g. "between 09:00 and 11:00") | VERIFIED (automated) + HUMAN NEEDED (visual) | `TrackingResult` gates `<TimeWindow>` on `currentStage === 'out_for_delivery' && startWindow && endWindow`. `TimeWindow` renders "Arriving between {start} and {end}". Logic verified. Prominence at 375px requires human. |
| 3 | Portal shows full scan/event history in reverse-chronological order | VERIFIED | `EventHistory` uses `[...routeDetails].reverse()` (non-mutating), renders `<section aria-label="Scan history">`. Verified in source. |
| 4 | Each distinct error state shows a specific helpful message; not_found and api_error include a Call us link + Try again; multiple_matches shows a chooser | VERIFIED | `ErrorState` uses exhaustive `Record<LookupFailureReason,...> MESSAGES`. `showCallUs` gates `tel:` link to `not_found`/`api_error` only. `Try again` href="/" always renders. Multiple-match chooser renders `consignmentNumber + delAddressTown + plainStatus` with no postcode. 13 DOM tests pass. |
| 5 | Customer can share/print via signed link that does NOT expose postcode | VERIFIED (automated) + HUMAN NEEDED (end-to-end) | `createShareToken` encodes `{c, exp}` only — no postcode in token. `SharePage` calls `verifyShareToken` then `lookupForShare`, with no postcode variable anywhere in the route file. `metadata.robots = { index:false }` prevents search engine caching. `ShareBar` has `print:hidden`. Token-gate logic unit-tested (6 tests). End-to-end share flow requires human. |

**Score:** 5/5 truths — all automated checks pass. 4 human verification items remain for viewport/visual/end-to-end confirmation.

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/env.ts` | VERIFIED | `CONTACT_PHONE` + `SHARE_TOKEN_SECRET` (`.min(32)`) with mock-safe defaults |
| `src/app/globals.css` | VERIFIED | `--accent: #2563eb` in `:root`; `--color-accent: var(--accent)` in `@theme inline`. Only one occurrence of the hex. `IN-03` fixed: `font-family: var(--font-sans), ...` |
| `src/app/layout.tsx` | VERIFIED | `<link rel="stylesheet" href="/print.css" media="print" />` present. Title "Derby Aggs — Track your delivery". |
| `src/test/setup-dom.ts` | VERIFIED | Contains `import '@testing-library/jest-dom/vitest'` |
| `src/lib/share/token.ts` | VERIFIED | Exports `createShareToken` + `verifyShareToken`. HMAC-SHA256, `timingSafeEqual`, no postcode in payload, expiry enforced, never throws. |
| `src/lib/tracking/service.ts` | VERIFIED | CR-01 fixed: postcode gate (`postcodesMatch`) runs BEFORE any candidate data is shaped — applies to both single-match and multiple-match paths. `lookupForShare` skips gate (signed token is authorisation). WR-02 fixed: empty-consignments guard present in `lookupForShare`. |
| `src/types/tracking.ts` | VERIFIED | `MatchCandidate` interface with `consignmentNumber`, `delAddressTown`, `plainStatus`. `TrackingResult` union with `multiple_matches` arm carrying `candidates: MatchCandidate[]`. |
| `src/components/StatusHeader.tsx` | VERIFIED | Renders `plainStatus`, `description`, `estimatedDelDate ?? 'Date not yet confirmed'`. Uses `date-fns` with try/catch. No raw hex. |
| `src/components/MilestoneStepper.tsx` | VERIFIED | `MILESTONE_ORDER.indexOf(currentStage)`. `bg-accent`/`text-accent` (no raw hex). 5-step horizontal `<ol>` with `aria-label`. |
| `src/components/TimeWindow.tsx` | VERIFIED | Renders "Arriving between {start} and {end}" with `bg-accent/10 text-accent`. |
| `src/components/EventHistory.tsx` | VERIFIED | `[...routeDetails].reverse()`, `aria-label="Scan history"`, returns null when empty. |
| `src/components/VehicleDetails.tsx` | VERIFIED | Guards on `type === 'Delivery'`, renders `regNo` + `status` only, returns null when absent. |
| `src/components/ErrorState.tsx` | VERIFIED | `Record<LookupFailureReason,...>` exhaustive map. `contactPhone` as prop (no env import in client component). `showCallUs` gates tel: link. Chooser shows no postcode. |
| `src/components/TrackingResult.tsx` | VERIFIED | Composes StatusHeader → MilestoneStepper → TimeWindow (gated) → EventHistory → VehicleDetails. `{!readOnly && null}` dead code from IN-01 was cleaned up (not present in final code). |
| `src/app/actions/lookup.ts` | VERIFIED | `'use server'`. `lookup(prevState, formData)` useActionState-compatible. Input caps 30/20 chars. WR-01 fixed: `lookupByConsignment` and `makeShareUrl` both cap at 30 chars. |
| `src/components/LookupForm.tsx` | VERIFIED | `useActionState(lookup, null)`. `action={formAction}` — no `method="get"`. `maxLength={30}` / `maxLength={20}`. |
| `src/components/PortalView.tsx` | VERIFIED | Routes `result.ok` to `TrackingResult + ShareBar`; routes failure to `ErrorState` with candidates and `onSelect` handler calling `lookupByConsignment`. |
| `src/components/ShareBar.tsx` | VERIFIED (with warning) | `print:hidden`, `window.print()`, `makeShareUrl` called server-side. WR-03 not fixed: clipboard/action errors swallowed silently with no user feedback. |
| `src/app/page.tsx` | VERIFIED | Server Component. Reads `env.CONTACT_PHONE` server-side, passes to `LookupForm`. Wordmark slot present. |
| `src/app/track/[token]/page.tsx` | VERIFIED | `verifyShareToken` gate. `notFound()` on null token or failed lookup. `lookupForShare`. `readOnly`. No postcode reference in logic. `metadata.robots` noindex (WR-04 fixed). |
| `public/print.css` | VERIFIED | `@media print` rules. Referenced via `<link media="print">` in layout. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LookupForm.tsx` | `actions/lookup.ts` | `action={formAction}` from `useActionState(lookup, null)` | WIRED | Direct import and hook usage confirmed |
| `actions/lookup.ts` | `service.ts` → `lookupConsignment` | `import { lookupConsignment }` | WIRED | Confirmed in source |
| `actions/lookup.ts` | `share/token.ts` → `createShareToken` | `makeShareUrl` server action | WIRED | `createShareToken` imported and used in `makeShareUrl` |
| `track/[token]/page.tsx` | `share/token.ts` → `verifyShareToken` | Token gate before any Nexus call | WIRED | Confirmed in source |
| `track/[token]/page.tsx` | `service.ts` → `lookupForShare` | Re-fetch after token verification | WIRED | Confirmed in source |
| `ShareBar.tsx` | `actions/lookup.ts` → `makeShareUrl` | Server action call on copy | WIRED | `makeShareUrl` imported and called in `handleCopy` |
| `ErrorState.tsx` | `env.ts` → `CONTACT_PHONE` | `contactPhone` prop from server parent | WIRED | `env.CONTACT_PHONE` read in `page.tsx`, passed through `LookupForm` → `PortalView` → `ErrorState` |
| `MilestoneStepper.tsx` | `types/tracking.ts` → `MILESTONE_ORDER` | `MILESTONE_ORDER.indexOf(currentStage)` | WIRED | Confirmed in source |
| `service.ts` multiple-match path | `postcode.ts` → `postcodesMatch` | CR-01 fix: gate before candidate shaping | WIRED | `matching = consignments.filter(postcodesMatch(...))` runs at line 92 before line 104 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TrackingResult.tsx` | `consignment: MappedConsignment` | `lookupConsignment` (Phase 1 service) → MSW mock in dev | MSW returns structured mock fixtures; real Nexus in Phase 4 | FLOWING (mock mode by design) |
| `ErrorState.tsx` | `reason`, `candidates` | Same service result union | Flows from real service calls | FLOWING |
| `SharePage` | `result.consignment` | `lookupForShare` (service) | Same data path as above | FLOWING |

Mock mode is by design (MSW, no live Pall-Ex credentials until Phase 4). This is not a gap.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | 0 errors | PASS |
| Full test suite (93 tests, 12 files) | `npx vitest run` | 93 passed, 0 failed | PASS |
| Production build compiles both routes | `npm run build` | `/ (Static)` + `/track/[token] (Dynamic)` — no errors | PASS |
| Share token round-trip | 6-test suite in `page.test.ts` | valid→consignment, invalid/tampered/expired→null | PASS |
| Postcode gate on multiple-match (CR-01) | `service.test.ts` lines 113, 167 | verified-postcode path returns candidates; zero-match returns postcode_mismatch | PASS |
| No GET method on lookup form | `grep -i 'method="get"' LookupForm.tsx` | 0 matches | PASS |
| No raw accent hex in components | `grep -rl "2563eb" src/components` | no output | PASS |
| ErrorState no env import | `grep -c "from.*env" ErrorState.tsx` | 0 | PASS |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| PORT-01 | 02-04 | POST submission, no tracking data in URL | SATISFIED | `useActionState` form with `action={formAction}`, no `method="get"`, input caps enforced |
| PORT-02 | 02-03, 02-04 | Status, description, ETA, milestone timeline | SATISFIED | `StatusHeader` + `MilestoneStepper` in `TrackingResult`, above-fold ordering verified |
| PORT-03 | 02-03, 02-04 | Out-for-delivery time window | SATISFIED | `TimeWindow` gated on `currentStage === 'out_for_delivery' && startWindow && endWindow` |
| PORT-04 | 02-03 | Reverse-chronological event history | SATISFIED | `EventHistory` with `[...routeDetails].reverse()` |
| PORT-05 | 02-02, 02-03 | Distinct error states + multiple-match chooser | SATISFIED | Exhaustive `Record<LookupFailureReason,...>`, chooser with postcode gate (CR-01 fixed), 13 DOM tests |
| PORT-06 | 02-01, 02-03, 02-04 | Mobile-first responsive, 375px | SATISFIED (automated) / HUMAN NEEDED (viewport) | Flex layout, `max-w-md`, correct component ordering. Viewport requires visual verification. |
| PORT-07 | 02-03 | Vehicle/route details when available | SATISFIED | `VehicleDetails` guards on `type === 'Delivery'`, renders `regNo` + `status`, returns null when absent |
| PORT-08 | 02-02, 02-03, 02-04 | Share/print via signed link, no postcode exposed | SATISFIED (automated) / HUMAN NEEDED (end-to-end) | HMAC token with no postcode, `verifyShareToken` gate, `lookupForShare` bypass, `print:hidden`, noindex metadata |

All 8 PORT requirements are covered and satisfied by implementation evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/ShareBar.tsx` | 25-35 | `try/finally` swallows clipboard and server-action errors with no user feedback (WR-03 from review, not fixed) | Warning | If `makeShareUrl` throws or clipboard permission is denied, the button silently resets — user thinks link was copied but it was not. Does not block portal functionality; share link itself is correctly minted. |
| `src/components/EventHistory.tsx` | 18 | `key={i}` (array index) as React list key (IN-02 from review, not fixed) | Info | Minor React reconciliation concern if `routeDetails` updates; no current user-facing impact since the history is static per lookup. |

No blocker anti-patterns found. Both items are open review findings that were not included in any plan's acceptance criteria.

---

### Human Verification Required

#### 1. Above-the-fold layout at 375px viewport

**Test:** Open the portal on a 375px-width viewport (Chrome DevTools "iPhone SE" preset). Submit any tracking number and postcode (mock mode returns data). Without scrolling, confirm ALL of the following are visible: status heading, plain-language description, estimated delivery date line, and all 5 milestone stepper steps.
**Expected:** All four elements visible above the fold at 375px with no scrolling required.
**Why human:** Static analysis confirms correct component ordering and flex layout, but pixel-level above-fold confirmation requires visual rendering.

#### 2. Time window prominence at 375px

**Test:** In mock mode, trigger a result where `currentStage = 'out_for_delivery'` with `startWindow` and `endWindow` populated. Verify the "Arriving between X and Y" banner is visually prominent.
**Expected:** The accent-coloured arrival window banner is clearly visible and reads as the most attention-grabbing element after the status heading.
**Why human:** Visual prominence is a subjective/perceptual test that CSS inspection alone cannot confirm.

#### 3. End-to-end share link flow

**Test:** From a successful lookup result, click "Copy share link". Open the copied URL in an incognito/private window. Confirm the status renders read-only (no form, no ShareBar). Then modify one character of the token in the URL and confirm a 404 is returned.
**Expected:** Valid token → read-only status page. Invalid/tampered token → Next.js 404 page.
**Why human:** Requires a running browser with clipboard access and URL navigation; cannot be verified without a live server.

#### 4. Print output correctness

**Test:** From a tracking result page, use the "Print" button (or Cmd+P / browser print). Inspect the print preview.
**Expected:** Print preview shows only the tracking result content. The LookupForm (inputs + button), ShareBar ("Copy share link" + "Print" buttons), and any navigation are hidden. Content is black on white.
**Why human:** Print preview behaviour requires visual inspection of rendered print output.

---

## Gaps Summary

No blocking gaps. All 5 success criteria are met by automated evidence (test suite 93/93, build clean, tsc clean, key-link verification, anti-pattern scans).

**Two open review warnings not addressed:**

1. **WR-03 (ShareBar error swallowing):** `handleCopy` catches errors in `finally` but renders no user-facing feedback. The copy button silently resets on failure. Does not block the portal or any requirement — the share link mechanism is sound. Recommend fixing before production launch (add `error` state to ShareBar as the review suggests).

2. **IN-02 (EventHistory array index key):** `key={i}` used in the scan history list. Minor React reconciliation issue with no current user-facing impact. Recommend fixing per the review's composite-key suggestion.

Neither item prevents goal achievement. Four human verification items remain for visual/end-to-end confirmation of viewport layout and share link behaviour.

---

_Verified: 2026-06-12T12:16:00Z_
_Verifier: Claude (gsd-verifier)_
