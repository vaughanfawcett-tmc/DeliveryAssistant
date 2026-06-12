---
phase: 03-admin-dashboard
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/app/actions/auth.ts
  - src/app/actions/drivers.ts
  - src/app/dashboard/calls/page.tsx
  - src/app/dashboard/calls/[id]/page.tsx
  - src/app/dashboard/drivers/page.tsx
  - src/app/dashboard/layout.tsx
  - src/app/dashboard/page.tsx
  - src/app/login/page.tsx
  - src/components/admin/AdminShell.tsx
  - src/components/admin/CallDetail.tsx
  - src/components/admin/CallFilters.tsx
  - src/components/admin/CallHistoryTable.tsx
  - src/components/admin/DeleteConfirmDialog.tsx
  - src/components/admin/DriverCallSubLog.tsx
  - src/components/admin/DriverList.tsx
  - src/components/admin/DriverModal.tsx
  - src/components/admin/LoginForm.tsx
  - src/components/admin/MetricCard.tsx
  - src/components/admin/PeriodTabs.tsx
  - src/components/admin/RecordingPlayer.tsx
  - src/components/admin/Toast.tsx
  - src/components/admin/TranscriptView.tsx
  - src/lib/admin/mask.ts
  - src/lib/admin/types.ts
  - src/lib/admin/windows.ts
  - src/lib/env.ts
  - src/lib/repositories/calls-repo.ts
  - src/lib/repositories/drivers-repo.ts
  - src/lib/seed/seed-calls.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

The Phase 3 admin dashboard is well-structured overall. The auth model (iron-session shared password), middleware route protection, and `requireSession()` guard on every server action are all correctly implemented. The PII masking boundary is correctly enforced — `CallSummary` has no raw `from_number` field, and the type system prevents it leaking to client components. The `session.ts` edge-runtime constraint (no `server-only` import) is correctly handled.

Two critical issues were found: raw driver phone numbers are serialised into the React component tree on the Drivers page (bypassing the masking that protects customer numbers), and the `logoutAction` has a silent session-destruction race condition that can leave an active session alive. Four warnings cover input validation gaps, an unhandled delete error on the confirmation dialog, pagination state loss on navigation, and an in-memory pagination model that will load all rows before slicing. Three info items cover code duplication, a magic constant, and a seed-script credential fallback that could use an anon key against production.

---

## Critical Issues

### CR-01: Raw driver `phone_e164` exposed to client via `DriverRow` prop

**File:** `src/app/dashboard/drivers/page.tsx:5-13` and `src/components/admin/DriverList.tsx:121-124`

**Issue:** `DriversPage` fetches `DriverRow[]` from the repo and passes the full array directly to the `DriverList` client component. `DriverRow` contains the raw `phone_e164` column, which is then rendered verbatim in the table and mobile cards (`driver.phone_e164`). Driver mobile numbers are personal data under GDPR (explicitly noted in CLAUDE.md). Unlike customer `from_number`, which is masked at the repo boundary, driver phones are never masked before reaching the client bundle.

The threat model notes (CLAUDE.md): _"driver phone numbers are personal data"_ — they should receive the same masking treatment as customer `from_number`.

**Fix:** Either:

a) Mask at the server component boundary before passing to the client:
```tsx
// src/app/dashboard/drivers/page.tsx
import { maskPhone } from '@/lib/admin/mask';

const safeDrivers = drivers.map((d) => ({
  ...d,
  phone_e164: maskPhone(d.phone_e164),
}));
return <DriverList drivers={safeDrivers} />;
```

b) Or (preferred for admin use — admins legitimately need to see the number) define a separate `DriverSummary` type with `phone_masked` and pass that instead of the raw `DriverRow`. The key fix is that the raw E.164 string must not appear in the serialised React tree, where it is visible in the HTML source and hydration payload.

---

### CR-02: `logoutAction` does not `await session.destroy()`

**File:** `src/app/actions/auth.ts:39`

**Issue:** `session.destroy()` is called without `await`. `iron-session`'s `destroy()` is async — it must be awaited to guarantee the `Set-Cookie` header (with `Max-Age=0`) is written before the redirect fires. If `destroy()` is not awaited, the session cookie may not be cleared and the user remains authenticated in subsequent requests. This is a logic-level auth bypass: the user sees the `/login` page but the session is still valid, so middleware will immediately let them back into `/dashboard` if they navigate directly.

```ts
// Current — broken
session.destroy();
redirect('/login');

// Fixed — must await
await session.destroy();
redirect('/login');
```

**Fix:**
```ts
export async function logoutAction(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  await session.destroy(); // await is required
  redirect('/login');
}
```

---

## Warnings

### WR-01: `getCallById` returns the raw `CallRow` including `from_number` — no guard at the call site detail page

**File:** `src/app/dashboard/calls/[id]/page.tsx:23-65`

**Issue:** `getCallById` returns a full `CallRow`, which includes `from_number` (raw E.164). The server component correctly masks the customer caller with `maskPhone(call.from_number)` before passing `callerMasked` to `CallDetail`. However, the `driverCalls` returned by `getDriverCallsForParent` are also full `CallRow` objects, and on line 59–64 the raw `from_number` field of each driver call is passed directly into the `DriverCallSubLog` client component prop:

```tsx
calls={driverCalls.map((dc) => ({
  id: dc.id,
  duration_ms: dc.duration_ms,
  outcome: dc.outcome,
  from_number: dc.from_number,   // <-- raw phone number in serialised props
}))}
```

`DriverCallSubLog` does call `maskPhone(call.from_number)` at render time (line 81), so it is not displayed raw. But the raw value is still present in the React serialisation payload sent to the browser. If the masking call in the component is ever removed or skipped for any entry, the raw number is silently exposed.

**Fix:** Apply masking at the server boundary before passing props, so the raw value never leaves the server:
```tsx
calls={driverCalls.map((dc) => ({
  id: dc.id,
  duration_ms: dc.duration_ms,
  outcome: dc.outcome,
  from_number_masked: maskPhone(dc.from_number ?? null),
}))}
```
Update `DriverCallSubLog` to accept `from_number_masked: string` instead of `from_number: string | null`.

---

### WR-02: `DeleteConfirmDialog` swallows delete errors silently

**File:** `src/components/admin/DeleteConfirmDialog.tsx:25-28`

**Issue:** `handleConfirm` awaits `deleteDriver(driverId)` but ignores the returned `{ error?: string }` value. If the server action fails (Supabase error, network timeout), the dialog closes and the parent shows a "Driver deleted" toast — the user never knows the delete failed.

```ts
// Current
function handleConfirm() {
  startTransition(async () => {
    await deleteDriver(driverId);  // return value discarded
    onDone('deleted');
  });
}
```

**Fix:**
```ts
function handleConfirm() {
  startTransition(async () => {
    const result = await deleteDriver(driverId);
    if (result?.error) {
      // surface the error; do not close the dialog
      // requires adding an error state and a prop/callback to report it
      onDone('error');  // or pass error string back via onDone
      return;
    }
    onDone('deleted');
  });
}
```
The `onDone` callback and `DriverList.handleDeleteDone` need a matching update to show a toast on error.

---

### WR-03: Date filter inputs in `CallFilters` accept arbitrary strings — invalid dates passed to `new Date()`

**File:** `src/app/dashboard/calls/page.tsx:39-40`

**Issue:** The `from` and `to` query parameters from the URL are passed directly to `new Date(sp.from)` and `new Date(sp.to)` without validation. `new Date('arbitrary')` produces an `Invalid Date` object. When `toISOString()` is called on an invalid Date in the Supabase `.gte()`/`.lte()` filter chain, it throws a `RangeError: Invalid time value`, crashing the page render and resulting in a 500.

Reproduction: navigate to `/dashboard/calls?from=notadate`.

**Fix:** Validate the date strings before constructing `Date` objects:
```ts
function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

const opts: CallListOptions = {
  since: parseDate(sp.from),
  until: parseDate(sp.to),
  // ...
};
```

---

### WR-04: In-memory pagination fetches all rows before slicing — unbounded memory growth

**File:** `src/lib/repositories/calls-repo.ts:107-117`

**Issue:** `listCustomerCalls` issues a Supabase query with no `LIMIT`, fetches every matching row into memory (`allData`), counts them in JS, then manually slices for the requested page. As the `calls` table grows (30-day retention × call volume), this will eventually fetch tens of thousands of rows on every page load.

This is currently a correctness concern because the Supabase client has a default row limit of 1,000. If there are more than 1,000 calls matching the filter, the `total` count will be capped at 1,000 silently, and pages beyond row 1,000 will return incorrect results without any error.

**Fix:** Use Supabase's server-side `.range()` for pagination and a count query for the total. The `SelectBuilder` interface already defines a `.range()` method:
```ts
// Count query
const { count } = await client
  .from('calls')
  .select('*', { count: 'exact', head: true })
  .eq('call_type', 'customer')
  // ...filters...

// Paginated data query
const { data } = await client
  .from('calls')
  .select('*')
  .eq('call_type', 'customer')
  // ...filters...
  .order('start_at')
  .range(from, to - 1);
```
The injectable `SupabaseLike` interface will need updating to support the count pattern.

---

## Info

### IN-01: `formatDuration` function duplicated across three components

**File:** `src/components/admin/CallHistoryTable.tsx:21-28`, `src/components/admin/CallDetail.tsx:20-27`, `src/components/admin/DriverCallSubLog.tsx:29-36`

**Issue:** Identical `formatDuration(ms: number | null): string` implementations appear in all three components. Any fix to the formatting logic (e.g. adding hours, localisation) must be applied in three places.

**Fix:** Extract to `src/lib/admin/format.ts` and import where needed.

---

### IN-02: `SHARE_TOKEN_SECRET` ships with an insecure default in `env.ts`

**File:** `src/lib/env.ts:26`

**Issue:** The schema declares a hard-coded default for `SHARE_TOKEN_SECRET`:
```ts
SHARE_TOKEN_SECRET: z.string().min(32).default('dev-only-insecure-share-secret-change-me'),
```
If a deployment forgets to set this variable, the default silently passes the `min(32)` check and the app boots with a known, public secret. The value being labelled "insecure" does not prevent it from being used in production. The comment pattern (`# NO defaults: app must fail to boot if absent`) used for `DASHBOARD_PASSWORD` and `DASHBOARD_SESSION_SECRET` is not applied here consistently.

**Fix:** Remove the `.default(...)` so a missing `SHARE_TOKEN_SECRET` fails env validation at boot, matching the treatment of the other secrets:
```ts
SHARE_TOKEN_SECRET: z.string().min(32),
```

---

### IN-03: Seed script falls back to anon key for the Supabase client

**File:** `src/lib/seed/seed-calls.ts:34-36`

**Issue:**
```ts
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
```

The fallback to `NEXT_PUBLIC_SUPABASE_ANON_KEY` means the seed script will partially succeed using anon-level permissions in an environment where the service role key is not set. If RLS is not restrictive enough on the `calls` or `drivers` tables (which is common in local dev), this seeds data silently with insufficient auth. The script's own guard at lines 38–43 only checks that `supabaseServiceKey` is non-empty, which it would be if the anon key is present.

**Fix:** Require the service role key explicitly:
```ts
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
```

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
