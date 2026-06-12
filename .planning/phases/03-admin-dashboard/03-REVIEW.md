---
phase: 03-admin-dashboard
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/app/actions/auth.ts
  - src/app/actions/drivers.ts
  - src/app/dashboard/calls/page.tsx
  - src/app/dashboard/calls/[id]/page.tsx
  - src/app/dashboard/drivers/page.tsx
  - src/app/dashboard/page.tsx
  - src/components/admin/CallHistoryTable.tsx
  - src/components/admin/DeleteConfirmDialog.tsx
  - src/components/admin/DriverCallSubLog.tsx
  - src/components/admin/DriverList.tsx
  - src/components/admin/DriverModal.tsx
  - src/lib/admin/mask.ts
  - src/lib/admin/types.ts
  - src/lib/repositories/calls-repo.ts
  - src/lib/repositories/drivers-repo.ts
  - src/lib/session.ts
  - src/middleware.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 03: Code Review Report (final re-review)

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Re-review confirming resolution of WR-05, WR-06, and WR-07 from the previous iteration. All three fixes are genuine and correct. Driver CRUD (add/edit/delete/deactivate) and call-history pagination are now functionally sound. Driver PII masking in list views is correct and the edit modal legitimately receives the raw phone value. One new warning was found in the pagination page-number parser (`Math.max(1, NaN)` returns `NaN` in JavaScript, not 1), which causes a malformed Supabase range query on any non-numeric `?page=` value. One informational note on the admin password comparison style is included. No critical issues remain.

### Previous fixes confirmed resolved

**WR-05 (edit modal raw phone retained, masked display field)** — `DriversPage` builds `safeDrivers` spreading the full raw `DriverRow` (retaining `phone_e164`) plus a new `phone_e164_display` field from `maskPhone`. `DriverList` renders `driver.phone_e164_display` in the table cell (line 130) and the mobile card (line 187). `DriverModal` uses `driver?.phone_e164 ?? ''` as the input `defaultValue` (line 151), which is the raw E.164 value and passes both client-side regex and server-side Zod validation. Resolved.

**WR-06 (pagination preserves filters)** — `CallHistoryPage` constructs a `baseParams` `URLSearchParams` from the four active filter fields and passes it serialised to `CallHistoryTable`. The table builds prev/next hrefs by seeding a new `URLSearchParams` from `baseParams ?? ''` then setting only the `page` key on top (lines 80-83 of `CallHistoryTable.tsx`). Filters are preserved on every page navigation. Resolved.

**WR-07 (driver insert/update return void, no false-throw)** — `insertDriver` and `updateDriver` in `drivers-repo.ts` both return `Promise<void>` and check only the Supabase `error` field, throwing only on error. The server actions wrap every repo call in `try/catch` and map thrown errors to `{ error: string }` (lines 65-73 and 94-98 of `drivers.ts`). Add/save operations complete and close the modal correctly. Resolved.

---

## Warnings

### WR-01: `Math.max(1, NaN)` returns `NaN` — non-numeric `?page=` corrupts Supabase range query

**File:** `src/app/dashboard/calls/page.tsx:39`

**Issue:** The page parameter is parsed with:

```ts
const page = Math.max(1, Number(sp.page ?? '1'));
```

`Number('abc')` returns `NaN`, and in JavaScript `Math.max(1, NaN)` returns `NaN` — not `1`. A non-numeric `?page=abc` URL (browser autofill edge case, manual URL edit, or probe) passes `NaN` into `listCustomerCalls` as the `page` option. Inside `calls-repo.ts` the destructuring default `page = 1` does not apply because the `page` key is present; `from = (NaN - 1) * 25` and `to = NaN * 25 - 1` are both `NaN`. Supabase `.range(NaN, NaN)` sends a malformed range to the API, producing either an error response (which `listCustomerCalls` maps to `{ rows: [], total }`) or an unexpected empty result — with no user-visible explanation.

**Fix:** Add a `Number.isFinite` guard before applying the floor:

```ts
const rawPage = Number(sp.page ?? '1');
const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
```

---

## Info

### IN-01: Admin password comparison is not timing-safe

**File:** `src/app/actions/auth.ts:24`

**Issue:** The login check uses a plain `!==` string comparison:

```ts
if (!password || !expected || password !== expected) {
```

V8 string comparison short-circuits on the first mismatched character, creating a timing side-channel. For this threat model (single shared-secret admin dashboard, HTTPS only, no public account enumeration surface) this is typically acceptable. It is noted here for awareness.

**Fix (optional):** Replace with a timing-safe comparison:

```ts
import { timingSafeEqual } from 'crypto';

function safeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

if (!password || !expected || !safeStringEqual(password, expected)) {
  return { error: 'Incorrect password. Please try again.' };
}
```

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
