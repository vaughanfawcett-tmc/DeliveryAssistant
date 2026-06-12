---
phase: 01-foundation
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/lib/env.ts
  - src/lib/nexus/token-manager.ts
  - src/lib/nexus/circuit-breaker.ts
  - src/lib/nexus/client.ts
  - src/lib/redis.ts
  - src/lib/supabase.ts
  - src/lib/repositories/lookup-log.ts
  - src/lib/tracking/postcode.ts
  - src/lib/tracking/status-map.ts
  - src/lib/tracking/service.ts
  - src/mocks/fixtures.ts
  - src/mocks/handlers.ts
  - src/mocks/server.ts
  - src/types/consignment.ts
  - src/types/database.ts
  - src/types/tracking.ts
  - src/types/index.ts
  - src/app/layout.tsx
  - src/app/page.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The Phase 1 foundation layer is well-structured overall. The security-sensitive
paths — service-role client isolation, credential logging guards, postcode gate
ordering — are implemented correctly and consistently. The single-flight token
refresh, circuit breaker state machine, and Zod response validation are sound.

One critical security finding: the `supabase.ts` module accesses `env.SUPABASE_SERVICE_ROLE_KEY`
at module load time via the top-level `createClient` call. Because Next.js App
Router may statically import this file during the client bundle build step, this
creates a real risk of the service-role key being included in the browser bundle.
The module comment says "SERVER ONLY" but there is no runtime or build-time
enforcement of that boundary.

Four warnings cover: a login failure that silently loses its error to callers, a
half-open concurrency hole in the circuit breaker, a `success` field inconsistency
in `lookup-log.ts`, and a missing `UNIQUE` constraint on the drivers phone column.
Three informational items cover the scaffold page, a redundant `.trim()` call, and
the unknown-status fallback stage choice.

---

## Critical Issues

### CR-01: `supabase.ts` — service-role client instantiated at module evaluation time, no `'server-only'` guard

**File:** `src/lib/supabase.ts:12-20`

**Issue:** `createClient(...)` is called at the top level of the module, which means
the Supabase URL and `SUPABASE_SERVICE_ROLE_KEY` are accessed the moment any module
imports `supabase.ts`. In Next.js App Router, any Server Component, Route Handler,
or utility that is also accidentally imported by a Client Component will cause the
bundler to include this module — and with it, the service-role key — in the browser
bundle. There is no `'server-only'` import to make the bundler throw a build-time
error, and no runtime `typeof window` guard. The service-role key bypasses RLS, so
a leak would expose all tables unrestricted.

The `lookup-log.ts` repository already works around this correctly (dynamic
`import('../supabase')` inside `getDefaultRepo()`, lazy). `supabase.ts` itself
must be hardened at the source.

**Fix:**
```typescript
// src/lib/supabase.ts
import 'server-only'; // Next.js will throw a build-time error if this is imported client-side

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { env } from './env';

let _supabase: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseClient() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
  }
  return _supabase;
}

// Convenience re-export for existing consumers (lazy — safe from build-time inclusion)
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_t, prop) {
    return (getSupabaseClient() as Record<string | symbol, unknown>)[prop];
  },
});
```

Adding `import 'server-only'` is the minimum required fix. The lazy singleton is
an improvement but not strictly required once the build-time guard is in place.
The `server-only` package ships with Next.js — no extra dependency needed.

---

## Warnings

### WR-01: `token-manager.ts` — login failure silently drops the error; callers receive a rejected promise with no context propagated to the circuit breaker

**File:** `src/lib/nexus/token-manager.ts:102-104`

**Issue:** `getToken()` starts the single-flight promise with:

```typescript
refreshPromise = login().finally(() => {
  refreshPromise = null;
});
```

`login()` can throw (e.g. network error, non-2xx from `createDefaultHttpPost`).
When it does, the rejected promise is stored in `refreshPromise` and then cleared
in `.finally()`. Any caller that already joined `refreshPromise` before the
rejection will receive the rejection correctly. However a subsequent caller that
arrives *after* the `.finally()` completes will find `refreshPromise === null` and
trigger a second `login()` attempt — which is the intended retry behaviour. That
part is fine.

The actual problem is in `createDefaultHttpPost` at line 131:
```typescript
throw new Error(`Nexus login failed: ${res.status}`);
```
This throws a bare `Error` with only the HTTP status. The `nexusLookupFn` in
`client.ts` calls `getToken()` without try/catch. If `getToken()` rejects, the
rejection propagates up through `callWithTimeout` and is caught by the circuit
breaker's catch block (line 144 of `circuit-breaker.ts`), which correctly calls
`recordFailure()` and returns the fallback. So the *observable behaviour* is safe.

The warning is that `createDefaultHttpPost` discards the response body entirely
on error. For 401 (expired credentials) vs 503 (Nexus down), the error message is
identical in shape. When debugging production login failures there is no body
detail. This is a robustness and operability issue.

**Fix:**
```typescript
// token-manager.ts — createDefaultHttpPost
if (!res.ok) {
  let detail = '';
  try {
    const text = await res.text();
    // Truncate to avoid accidentally logging sensitive data in a future log handler
    detail = text.slice(0, 120);
  } catch {
    // ignore — best-effort
  }
  throw new Error(`Nexus login failed: ${res.status}${detail ? ` — ${detail}` : ''}`);
}
```

Do NOT log the error message itself at this layer; let the circuit breaker / caller
decide whether to log (and at what level), consistent with T-01-04.

---

### WR-02: `circuit-breaker.ts` — half-open state allows unlimited concurrent probes

**File:** `src/lib/nexus/circuit-breaker.ts:128-149`

**Issue:** When `state === 'open'` and the reset timeout has elapsed, `maybeEnterHalfOpen()`
transitions to `'half-open'` and returns `true`. The outer `wrappedFn` then falls
through to the normal call path. This is correct for a single caller. However,
because the state is set to `'half-open'` synchronously *before* the probe's
`await`, any concurrent callers that arrive during the probe's execution will also
pass the `state === 'open'` check (it is now `'half-open'`), skip the fast-return
fallback, and also proceed to the real `callWithTimeout`. The intended behaviour is
that exactly one probe is let through while the rest are fallback'd.

```typescript
// Illustration of the race:
// t=0  caller A: state goes open→half-open, starts probe
// t=1  caller B: state is already half-open, NOT open — falls to callWithTimeout
// t=2  caller C: same — also reaches callWithTimeout
```

The breaker never short-circuits callers B and C in half-open state; they all
become live probes simultaneously.

**Fix:** Add a half-open guard that short-circuits all callers except the first:

```typescript
// Add at top of state variables
let halfOpenProbeLaunched = false;

// In wrappedFn, before the try block:
if (state === 'half-open') {
  if (halfOpenProbeLaunched) {
    return fallback(...args);
  }
  halfOpenProbeLaunched = true;
}

// In recordSuccess (on half-open → closed):
halfOpenProbeLaunched = false;

// In recordFailure / openCircuit:
halfOpenProbeLaunched = false;
```

In a single-process Node.js server the window is small (milliseconds between
concurrent requests hitting the same in-process singleton), so this will not cause
data loss or incorrect status display, but it will defeat the purpose of half-open
probing under high traffic during recovery.

---

### WR-03: `lookup-log.ts` — `logLookup` overrides caller-supplied `success` field silently

**File:** `src/lib/repositories/lookup-log.ts:59`

**Issue:** `LogLookupInput` includes a `success: boolean` field, but `logLookup`
ignores it and recomputes:

```typescript
const success = input.outcome === 'found';
```

The `TrackingService` passes `success: true` for the `found` outcome and
`success: false` for all others, which happens to match, so there is no observable
bug today. The problem is that the `LogLookupInput` type contracts a `success`
field, callers must populate it, and then it is silently ignored. This creates a
type contract that misleads callers and will silently diverge if the outcome logic
is ever extended (e.g. a partial-success state).

**Fix (option A — remove the field, derive it internally):**
```typescript
// Remove `success` from LogLookupInput
export interface LogLookupInput {
  trackingRef: string;
  postcode: string;
  outcome: LookupOutcome;
}
// In logLookup — keep the existing derivation (line 59 is correct)
```

**Fix (option B — honour the caller-supplied value):**
```typescript
const success = input.success;  // trust the caller
```

Option A is cleaner — the `success` column is fully derivable from `outcome` and
having two sources of truth for the same fact in the same insert is an anti-pattern.

---

### WR-04: `supabase/migrations/0001_init_foundation.sql` — `drivers.phone_e164` has no `UNIQUE` constraint

**File:** `supabase/migrations/0001_init_foundation.sql:41`

**Issue:** Driver phone numbers are personal data and also the key used to look up
a driver before initiating an outbound call (Phase 4). The schema allows inserting
the same `phone_e164` value multiple times with no constraint. A duplicate row
would cause either an incorrect double-call or non-deterministic driver selection,
depending on how the Phase 4 query is written. This is the correct phase to fix it
(schema migrations are cheaper now than after Phase 4 data exists).

**Fix:**
```sql
-- Replace line 41:
phone_e164  text not null unique,
```

Or as a separate statement if the `CREATE TABLE` is kept verbatim:
```sql
alter table drivers add constraint drivers_phone_e164_key unique (phone_e164);
```

---

## Info

### IN-01: `src/app/layout.tsx` and `src/app/page.tsx` — scaffold copy not yet replaced

**File:** `src/app/layout.tsx:16-18`, `src/app/page.tsx:1-65`

**Issue:** `layout.tsx` still has the `create-next-app` default metadata title/description.
`page.tsx` is the full create-next-app scaffold with Next.js/Vercel marketing links.
These are not bugs, but should be replaced before Phase 2 work starts to avoid
placeholder content reaching a staging URL.

**Fix:** Update `metadata` in `layout.tsx` to the product name. Replace `page.tsx`
content with a Phase 2 placeholder or stub once the portal component exists.

---

### IN-02: `src/lib/tracking/postcode.ts:17` — redundant `.trim()` after `.replace(/\s+/g, '')`

**File:** `src/lib/tracking/postcode.ts:17`

**Issue:** `normalisePostcode` calls `.replace(/\s+/g, '')` which removes all
whitespace including leading/trailing, then calls `.trim()` on the result.
`.trim()` is a no-op at this point — `\s+` already covers it.

**Fix:**
```typescript
export function normalisePostcode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}
```

No behaviour change; purely removes dead code.

---

### IN-03: `src/lib/tracking/status-map.ts:63` — unknown status fallback maps to `in_transit`

**File:** `src/lib/tracking/status-map.ts:62-66`

**Issue:** The `UNKNOWN_STATUS_FALLBACK` assigns `stage: 'in_transit'`. For statuses
that genuinely represent pre-collection states (e.g. a new Nexus status such as
`'pending'` or `'awaiting collection'`), mapping to `in_transit` will move the
milestone indicator forward past `booked` and `at_hub`, showing a misleading
progress bar position to the customer. `'booked'` would be a safer conservative
default since it is the earliest stage and will never overstate progress.

This is a design/UX trade-off rather than a hard bug (the postcode gate has already
passed by the time `mapStatusName` is called, so no PII is leaked), but worth
revisiting before Phase 2 renders the milestone timeline.

**Fix:**
```typescript
const UNKNOWN_STATUS_FALLBACK: StatusMapping = {
  stage: 'booked',   // conservative — never overstates delivery progress
  plainStatus: 'Status update',
  description: 'Your delivery is being processed. Please check back shortly.',
};
```

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
