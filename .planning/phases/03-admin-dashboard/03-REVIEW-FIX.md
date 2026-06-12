---
phase: 03-admin-dashboard
fixed_at: 2026-06-12T14:49:06Z
review_path: .planning/phases/03-admin-dashboard/03-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-12T14:49:06Z
**Source review:** .planning/phases/03-admin-dashboard/03-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (WR-05, WR-06, WR-07)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-07: `insertDriver` and `updateDriver` always throw on success in Supabase JS v2

**Files modified:** `src/lib/repositories/drivers-repo.ts`, `src/lib/repositories/drivers-repo.test.ts`
**Commit:** 9267d2e
**Applied fix:** Option A from review. Changed `insertDriver` and `updateDriver` to return `Promise<void>`. Removed the `!data || data.length === 0` guards that fired on every successful write (Supabase JS v2 `.insert()/.update()` without `.select()` returns `{ data: null, error: null }` on success). Only the `error` flag is now checked. Updated the `FromBuilder` and `UpdateBuilder` internal interfaces to use `data: unknown`. Updated public export signatures to `Promise<void>`. Updated two unit tests in `drivers-repo.test.ts`: the insert test now asserts `resolves.toBeUndefined()` and verifies `_inserted` side effects; the update test similarly asserts void and checks `_updated`. The server actions in `drivers.ts` only `await` these functions and never consume the return value, so no action-layer changes were needed. `npm test` (118 tests) and `npx tsc --noEmit` both pass.

---

### WR-05: Edit-driver modal pre-populates with masked phone, blocking save

**Files modified:** `src/app/dashboard/drivers/page.tsx`, `src/components/admin/DriverList.tsx`
**Commit:** 793ced9
**Applied fix:** Kept `phone_e164` (raw E.164) on each driver row and added a new `phone_e164_display` field carrying the masked value. In `drivers/page.tsx` the spread now includes both fields. In `DriverList.tsx` the Props type is updated to `DriverListRow = DriverRow & { phone_e164_display: string }`, and both the desktop table cell and the mobile card paragraph render `driver.phone_e164_display` (masked). The `DriverModal` receives `modal.driver` which retains the raw `phone_e164`, so `defaultValue={driver?.phone_e164 ?? ''}` pre-populates with the valid E.164 value and both client-side regex validation and server-side Zod accept it. CR-01 intent is maintained: bulk list rendering always shows the masked value; only the authenticated admin edit modal accesses the raw number. `npx tsc --noEmit` passes cleanly.

---

### WR-06: Pagination "Previous" / "Next" links drop all active filter params

**Files modified:** `src/app/dashboard/calls/page.tsx`, `src/components/admin/CallHistoryTable.tsx`
**Commit:** ed693f8
**Applied fix:** In `calls/page.tsx`, after resolving `searchParams`, a `URLSearchParams` instance (`baseParams`) is constructed from the four active filter params (`outcome`, `q`, `from`, `to`) — only params with truthy values are set. `baseParams.toString()` is passed as a new optional `baseParams` prop to `CallHistoryTable`. In `CallHistoryTable.tsx`, `prevParams` and `nextParams` are constructed from `new URLSearchParams(baseParams ?? '')` and each has `page` set to the target page number. The pagination `href` attributes use `?${prevParams.toString()}` and `?${nextParams.toString()}` respectively, preserving all active filters across page navigation. `npx tsc --noEmit` and `npm test` (118 tests) both pass.

---

_Fixed: 2026-06-12T14:49:06Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
