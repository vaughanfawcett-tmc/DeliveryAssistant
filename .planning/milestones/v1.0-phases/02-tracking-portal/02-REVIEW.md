---
phase: 02-tracking-portal
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/app/page.tsx
  - src/app/actions/lookup.ts
  - src/app/track/[token]/page.tsx
  - src/app/layout.tsx
  - src/app/globals.css
  - public/print.css
  - src/components/LookupForm.tsx
  - src/components/PortalView.tsx
  - src/components/TrackingResult.tsx
  - src/components/StatusHeader.tsx
  - src/components/MilestoneStepper.tsx
  - src/components/TimeWindow.tsx
  - src/components/EventHistory.tsx
  - src/components/VehicleDetails.tsx
  - src/components/ErrorState.tsx
  - src/components/ShareBar.tsx
  - src/lib/share/token.ts
  - src/lib/tracking/service.ts
  - src/lib/env.ts
  - src/types/tracking.ts
  - src/test/setup-dom.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The Phase 2 tracking portal is well-structured overall. The share-token codec is sound: HMAC-SHA256, timing-safe comparison, no PII in payload, expiry enforced, separator parsing robust. The `env` boundary is respected — server-only modules stay out of client components. The `'use server'` directive at file scope in `lookup.ts` correctly covers all three exports. The `useActionState` two-argument call signature is correct. The async `params` pattern on the dynamic share route is correct for Next.js 15+.

One critical finding: the postcode gate is entirely absent from the `multiple_matches` branch, contradicting the D-10 design note that states "Postcode is already verified by the backend gate." It is not — a customer can reach the chooser with any postcode (including a wrong or fabricated one) and receive the town and plain-status of every consignment matching that tracking ref. The other findings are warnings and quality notes.

---

## Critical Issues

### CR-01: Postcode gate bypassed for the multiple-match path

**File:** `src/lib/tracking/service.ts:83-91`

**Issue:** When `nexusResult.consignments.length > 1`, the service immediately maps all candidates (including their town and plain-language status) and returns `multiple_matches` — before any postcode comparison is performed. The D-10 design comment states "Postcode is already verified by the backend gate", but the gate (`postcodesMatch`) only runs on the single-match path at line 97. A caller who supplies a valid tracking ref that has multiple associated consignments (e.g. a haulier who reuses a ref) can discover the delivery towns and statuses of all of them by entering any postcode, including a wrong one.

The `MatchCandidate` type intentionally omits the full postcode and address, which limits exposure, but town + status is still information a non-recipient should not receive. The security review criteria state the postcode gate "must reject before any data/status reveal."

**Fix:** Filter candidates to those whose `delAddressPostcode` matches the supplied postcode before building the chooser list. If zero candidates survive the filter, return `not_found` (or `postcode_mismatch`). If exactly one survives, promote it to the normal single-match flow (skipping the chooser). Only surface the chooser when two or more candidates share the matching postcode — a scenario that would require genuinely identical postcodes across different consignments.

```typescript
// service.ts — replace lines 83-91
if (nexusResult.consignments.length > 1) {
  // Filter to only the consignments whose postcode matches the caller's input.
  // This preserves the postcode gate invariant for every branch (T-01-13).
  const matching = nexusResult.consignments.filter((c) =>
    postcodesMatch(postcode, c.delAddressPostcode)
  );

  if (matching.length === 0) {
    await logLookup({ trackingRef, postcode: normalisedPostcode, success: false, outcome: 'postcode_mismatch' });
    return { ok: false, reason: 'postcode_mismatch' };
  }

  if (matching.length === 1) {
    // Fall through to the single-match gate-passed path below.
    // Re-assign nexusResult-local reference so the subsequent code sees one consignment.
    // Easiest approach: reassign the outer `consignment` var and continue.
    // (Refactor the block into a helper if it grows complex.)
    const consignment = matching[0];
    const { stage, plainStatus, description } = mapStatusName(consignment.status.name);
    const mapped: MappedConsignment = { /* ...same as lines 105-115 */ };
    await logLookup({ trackingRef, postcode: normalisedPostcode, success: true, outcome: 'found' });
    return { ok: true, consignment: mapped };
  }

  // Two or more consignments share this postcode — present the chooser.
  const candidates: MatchCandidate[] = matching.map((c) => ({
    consignmentNumber: c.consignmentNumber,
    delAddressTown: c.delAddressTown,
    plainStatus: mapStatusName(c.status.name).plainStatus,
  }));
  await logLookup({ trackingRef, postcode: normalisedPostcode, success: false, outcome: 'not_found' });
  return { ok: false, reason: 'multiple_matches', candidates };
}
```

---

## Warnings

### WR-01: `lookupByConsignment` action accepts an unbounded string with no input cap

**File:** `src/app/actions/lookup.ts:38-39`

**Issue:** The `lookup` server action applies length caps (30/20 chars) at line 25 to satisfy T-02-15. The sibling `lookupByConsignment` action does not validate its `consignmentNumber` argument at all before passing it to `lookupForShare` and on to `nexusLookup`. A client-side attacker (or a malformed request) can invoke this server action with an arbitrarily long string, causing the Nexus HTTP client to emit an oversized query parameter.

This is a well-intentioned action — the comment correctly notes the consignment number was "already validated by the prior postcode-gated lookup in this same session" — but server actions are publicly addressable POST endpoints; session state is not verified here.

**Fix:**
```typescript
export async function lookupByConsignment(consignmentNumber: string): Promise<TrackingResult> {
  if (!consignmentNumber || consignmentNumber.length > 30) {
    return { ok: false, reason: 'not_found' };
  }
  return lookupForShare(consignmentNumber);
}
```

Apply the same cap to `makeShareUrl` for the same reason:
```typescript
export async function makeShareUrl(consignmentNumber: string): Promise<string | null> {
  'use server';
  if (!consignmentNumber || consignmentNumber.length > 30) return null;
  return `/track/${createShareToken(consignmentNumber)}`;
}
```

---

### WR-02: `lookupForShare` does not guard against an empty `consignments` array

**File:** `src/lib/tracking/service.ts:144`

**Issue:** After a successful `nexusLookup` call (`nexusResult.ok === true`), the current Nexus client guarantees at least one element (it returns `not_found` for an empty array, per `client.ts:108-110`). However, `lookupForShare` accesses `nexusResult.consignments[0]` without a length check. If the client contract ever relaxes, or a future test injects a spy that returns `{ ok: true, consignments: [] }`, this will throw a runtime error and surface an unhandled 500, rather than a clean `not_found`.

**Fix:**
```typescript
async function lookupForShare(consignmentNumber: string): Promise<TrackingResult> {
  const nexusResult = await nexusLookup(consignmentNumber);
  if (!nexusResult.ok) {
    return nexusResult.error === 'nexus_unavailable'
      ? { ok: false, reason: 'api_error' }
      : { ok: false, reason: 'not_found' };
  }
  if (nexusResult.consignments.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  const consignment = nexusResult.consignments[0];
  // ...
```

---

### WR-03: `ShareBar.handleCopy` silently swallows clipboard and server-action errors

**File:** `src/components/ShareBar.tsx:25-35`

**Issue:** The `try/finally` block in `handleCopy` catches errors from both `makeShareUrl` (the server action) and `navigator.clipboard.writeText`. If either fails — network error, clipboard permission denied, browser without Clipboard API — the `loading` state is reset but no error is surfaced to the user. The button returns to its idle label, giving no indication that the copy failed.

This is a correctness issue: the user thinks the link is copied, attempts to share it, and discovers it is not.

**Fix:** Add an `error` state and render a brief failure message:
```typescript
const [error, setError] = useState<string | null>(null);

async function handleCopy() {
  setLoading(true);
  setError(null);
  try {
    const path = await makeShareUrl(consignmentNumber);
    if (!path) throw new Error('Could not generate share link');
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  } catch {
    setError('Could not copy link — try again');
  } finally {
    setLoading(false);
  }
}
```

---

### WR-04: Share page lacks a `noindex` robots directive — tokens could appear in search engine caches

**File:** `src/app/track/[token]/page.tsx`

**Issue:** The share page at `/track/[token]` has no `generateMetadata` export and no `X-Robots-Tag: noindex` header. While the token itself encodes no PII, a search engine that indexes `/track/<token>` will preserve a working share link in its cache for up to the token's 24-hour TTL. Because the page is server-rendered with the consignment status at crawl time, the cached snapshot may also preserve the status text (e.g. "Out for delivery") visible to anyone who finds the cached URL.

**Fix:** Add a metadata export to prevent indexing:
```typescript
export const metadata = {
  robots: { index: false, follow: false },
};
```

---

## Info

### IN-01: `TrackingResult` contains dead code — the `readOnly` prop controls a `null` render slot

**File:** `src/components/TrackingResult.tsx:32`

**Issue:** The line `{!readOnly && null}` is a permanent no-op. It evaluates to `false | null`, neither of which renders anything. The comment "ShareBar wired in Plan 04" indicates this was left as a future wiring point, but the actual share bar is already rendered by `PortalView` (not `TrackingResult`), so this placeholder can never become functional without restructuring the component tree.

**Fix:** Remove line 32. If the intent was to render `<ShareBar>` conditionally inside `TrackingResult`, the `ShareBar` import and call should replace this line. As the code stands, `PortalView` correctly handles the `ShareBar` outside of `TrackingResult`, so the placeholder serves no purpose.

---

### IN-02: `EventHistory` uses array index as React list key

**File:** `src/components/EventHistory.tsx:18`

**Issue:** `key={i}` (the array index) is used for the event list items. If the `routeDetails` array is updated (e.g. on a page refresh or re-render after multiple-match selection), React will use positional identity to reconcile, potentially applying stale state to the wrong item. The `NexusRouteDetail` type carries a `type` + `routeDate` + `round` combination that together form a natural composite key.

**Fix:**
```tsx
<li key={`${event.type}-${event.routeDate}-${event.round}`} className="flex gap-3 text-sm">
```

---

### IN-03: `globals.css` body `font-family` overrides the Geist CSS variable set in `layout.tsx`

**File:** `src/app/globals.css:27`

**Issue:** `layout.tsx` injects the `--font-geist-sans` CSS variable and the Tailwind `@theme` block maps it to `--font-sans`. However, the explicit `font-family: Arial, Helvetica, sans-serif` rule on `body` in `globals.css` overrides Tailwind's `font-sans` utility and the CSS variable, meaning Geist is never used despite being loaded. This is a leftover from the Next.js scaffold.

**Fix:** Replace the hardcoded rule so the variable chain works:
```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}
```

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
