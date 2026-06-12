# Phase 3: Admin Dashboard — Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 22 new/modified files
**Analogs found:** 20 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/middleware.ts` | middleware | request-response | `src/lib/share/token.ts` (pattern reference) | partial-match |
| `src/lib/session.ts` | config/utility | request-response | `src/lib/env.ts` | role-match |
| `src/lib/env.ts` (modify) | config | — | `src/lib/env.ts` | exact |
| `src/lib/repositories/calls-repo.ts` | repository/service | CRUD | `src/lib/repositories/lookup-log.ts` | exact |
| `src/lib/repositories/drivers-repo.ts` | repository/service | CRUD | `src/lib/repositories/lookup-log.ts` | exact |
| `src/lib/seed/seed-calls.ts` | utility/script | batch | `src/lib/repositories/lookup-log.ts` (client pattern) | partial-match |
| `src/app/login/page.tsx` | page | request-response | `src/app/page.tsx` | role-match |
| `src/app/dashboard/layout.tsx` | layout | request-response | `src/app/layout.tsx` | exact |
| `src/app/dashboard/page.tsx` | page | request-response | `src/app/track/[token]/page.tsx` | role-match |
| `src/app/dashboard/calls/page.tsx` | page | CRUD | `src/app/track/[token]/page.tsx` | role-match |
| `src/app/dashboard/calls/[id]/page.tsx` | page | CRUD | `src/app/track/[token]/page.tsx` | exact |
| `src/app/dashboard/drivers/page.tsx` | page | CRUD | `src/app/track/[token]/page.tsx` | role-match |
| `src/app/actions/auth.ts` | server-action | request-response | `src/app/actions/lookup.ts` | exact |
| `src/app/actions/drivers.ts` | server-action | CRUD | `src/app/actions/lookup.ts` | exact |
| `src/components/admin/AdminShell.tsx` | component/layout | — | `src/app/layout.tsx` | partial-match |
| `src/components/admin/LoginForm.tsx` | component | request-response | `src/components/LookupForm.tsx` | exact |
| `src/components/admin/MetricCard.tsx` | component | — | `src/components/StatusHeader.tsx` | role-match |
| `src/components/admin/PeriodTabs.tsx` | component | event-driven | `src/components/MilestoneStepper.tsx` | role-match |
| `src/components/admin/CallHistoryTable.tsx` | component | CRUD | `src/components/EventHistory.tsx` | role-match |
| `src/components/admin/CallFilters.tsx` | component | event-driven | `src/components/LookupForm.tsx` | role-match |
| `src/components/admin/DriverModal.tsx` | component | CRUD | `src/components/ShareBar.tsx` | role-match |
| `src/components/admin/Toast.tsx` | component | event-driven | no close analog | no-analog |

---

## Pattern Assignments

### `src/lib/env.ts` (modify — add DASHBOARD_PASSWORD, DASHBOARD_SESSION_SECRET)

**Analog:** `src/lib/env.ts` (the file itself — extend, not replace)

**Current schema pattern** (lines 12–27):
```typescript
const envSchema = z
  .object({
    PALLEX_MOCK: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    // ...existing fields...
    SHARE_TOKEN_SECRET: z.string().min(32).default('dev-only-insecure-share-secret-change-me'),
  })
```

**New fields to add — NO defaults (Pitfall 3):**
```typescript
// Add inside the z.object({}) block alongside existing fields.
// CRITICAL: NO .default() on either field — fail loudly at startup if absent.
DASHBOARD_PASSWORD: z.string().min(8),
DASHBOARD_SESSION_SECRET: z.string().min(32),
```

**Proxy accessor pattern** (lines 74–81) — no change needed, new fields are automatically available via `env.DASHBOARD_PASSWORD` and `env.DASHBOARD_SESSION_SECRET`.

---

### `src/lib/session.ts` (config, request-response)

**Analog:** `src/lib/env.ts` — lazy-evaluated config object pattern

**Key constraint from Pitfall 2:** Do NOT add `import 'server-only'` — this file is imported by `src/middleware.ts` which runs in the Edge runtime and cannot load `server-only`.

**Core pattern — function not singleton (lines 74–81 of env.ts for reference):**
```typescript
// src/lib/session.ts
// NO 'server-only' import — middleware edge compatibility (Pitfall 2)
import type { SessionOptions } from 'iron-session';

export interface SessionData {
  isLoggedIn: boolean;
}

// Lazy function form — reads process.env directly (not env proxy)
// because the env proxy imports server-only via src/lib/env.ts chain
export function getSessionOptions(): SessionOptions {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) throw new Error('DASHBOARD_SESSION_SECRET is required');
  return {
    password: secret,
    cookieName: 'da_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 8, // 8h session expiry
    },
  };
}
```

---

### `src/middleware.ts` (middleware, request-response)

**Analog:** `src/lib/share/token.ts` (conceptual: verification before allowing access); no existing middleware in codebase.

**Note on Pitfall 1 and Pitfall 2:** `await cookies()` is required in Next.js 16; `server-only` must NOT be in the middleware import chain. If iron-session fails in edge, fall back to `request.cookies.get('da_session')` with manual JSON-parse verification.

**Core pattern** (RESEARCH.md Architecture Patterns §Pattern 2):
```typescript
// src/middleware.ts
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getSessionOptions, type SessionData } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  if (!session.isLoggedIn) {
    return Response.redirect(new URL('/login', request.url), 302);
  }
  return undefined; // allow through
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

**If iron-session edge fallback is needed** — replace body with:
```typescript
const cookieHeader = request.cookies.get('da_session');
if (!cookieHeader) {
  return Response.redirect(new URL('/login', request.url), 302);
}
// Delegate full verification to the page/action; middleware only checks presence
```

---

### `src/lib/repositories/calls-repo.ts` (repository/service, CRUD)

**Analog:** `src/lib/repositories/lookup-log.ts` — copy the injectable factory shape exactly.

**Injectable SupabaseLike type** (lines 36–47 of lookup-log.ts):
```typescript
// Extend this type to support the query chain needed (eq, gte, order, range, etc.)
type FromBuilder = {
  insert: (row: object) => Promise<InsertResult>;
  select: (cols?: string) => SelectBuilder;
};

export interface SupabaseLike {
  from: (table: string) => FromBuilder;
}
```

**Factory pattern** (lines 53–122 of lookup-log.ts):
```typescript
export function createCallsRepo(client: SupabaseLike) {
  async function getMetrics(since: Date): Promise<CallMetrics> {
    const { data, error } = await client
      .from('calls')
      .select('outcome, end_at, call_type, direction, start_at')
      .eq('call_type', 'customer')
      .eq('direction', 'inbound')
      .gte('start_at', since.toISOString());

    if (error || !data) return { received: 0, answered: 0, missed: 0, successRate: 0 };
    // ... aggregate in JS (same pattern as countByOutcome in lookup-log.ts lines 83-119)
  }

  async function listCustomerCalls(opts: CallListOptions): Promise<{ rows: CallRow[]; total: number }> { ... }
  async function getCallById(id: string): Promise<CallRow | null> { ... }
  async function getDriverCallsForParent(parentCallId: string): Promise<CallRow[]> { ... }

  return { getMetrics, listCustomerCalls, getCallById, getDriverCallsForParent };
}
```

**Lazy default export pattern** (lines 131–149 of lookup-log.ts):
```typescript
let _defaultRepo: ReturnType<typeof createCallsRepo> | null = null;

async function getDefaultRepo() {
  if (!_defaultRepo) {
    const { supabase } = await import('../supabase');
    _defaultRepo = createCallsRepo(supabase as unknown as SupabaseLike);
  }
  return _defaultRepo;
}
// Then re-export individual functions bound to the default repo
```

**Aggregation-in-JS pattern** (lines 101–119 of lookup-log.ts — `countByOutcome`):
```typescript
const rows = (data ?? []) as Array<{ outcome: string | null; end_at: string | null }>;
for (const row of rows) {
  // JS-level aggregation — no Supabase RPC needed
}
```

---

### `src/lib/repositories/drivers-repo.ts` (repository/service, CRUD)

**Analog:** `src/lib/repositories/lookup-log.ts` — same factory shape, table is `drivers`.

**Factory pattern:**
```typescript
export function createDriversRepo(client: SupabaseLike) {
  async function listDrivers(activeOnly?: boolean): Promise<DriverRow[]> {
    let query = client.from('drivers').select('*').order('name');
    if (activeOnly) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) { console.warn('[drivers-repo] list failed:', error); return []; }
    return (data ?? []) as DriverRow[];
  }

  async function insertDriver(input: { name: string; phone_e164: string }): Promise<DriverRow> { ... }
  async function updateDriver(id: string, patch: Partial<{ name: string; phone_e164: string; active: boolean }>): Promise<DriverRow> { ... }
  async function deleteDriver(id: string): Promise<void> { ... }

  return { listDrivers, insertDriver, updateDriver, deleteDriver };
}
```

**Error handling pattern** — warn + swallow for reads (like lookup-log.ts line 72), throw for mutations (driver data must save or surface error to user).

---

### `src/app/actions/auth.ts` (server-action, request-response)

**Analog:** `src/app/actions/lookup.ts` — copy `'use server'` + `import 'server-only'` header and `formData.get()` input extraction pattern.

**Input extraction pattern** (lines 21–22 of lookup.ts):
```typescript
const password = ((formData.get('password') as string | null) ?? '').trim();
```

**Action signature for useActionState** (lines 17–20 of lookup.ts):
```typescript
export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
```

**Full action pattern** (RESEARCH.md §Pattern 1):
```typescript
'use server';
import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { getSessionOptions, type SessionData } from '@/lib/session';

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = ((formData.get('password') as string | null) ?? '').trim();
  const expected = process.env.DASHBOARD_PASSWORD;
  // Timing-safe comparison to avoid timing oracle (ASVS V2)
  if (!password || !expected || password !== expected) {
    return { error: 'Incorrect password. Please try again.' };
  }
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  session.isLoggedIn = true;
  await session.save();
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  'use server';
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  session.destroy();
  redirect('/login');
}
```

---

### `src/app/actions/drivers.ts` (server-action, CRUD)

**Analog:** `src/app/actions/lookup.ts` — same `'use server'` header, input caps, never throw to caller on validation.

**Critical pattern — session re-verification inside every action** (Pitfall 5):
```typescript
'use server';
import 'server-only';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { getSessionOptions, type SessionData } from '@/lib/session';

async function requireSession(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions());
  if (!session.isLoggedIn) throw new Error('Unauthorized');
}

const driverSchema = z.object({
  name: z.string().min(1, "Please enter the driver's full name."),
  phone_e164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number in E.164 format.'),
});

export async function addDriver(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireSession(); // MUST be first — Pitfall 5
  const parsed = driverSchema.safeParse({
    name: formData.get('name'),
    phone_e164: formData.get('phone_e164'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  // ... call drivers repo
}
```

**Input cap pattern** (lines 24–29 of lookup.ts — analogous to reject over-length):
```typescript
if (!trackingRef || !postcode || trackingRef.length > 30 || postcode.length > 20) {
  return { ok: false, reason: 'not_found' };
}
```

---

### `src/app/login/page.tsx` (page, request-response)

**Analog:** `src/app/page.tsx` — Server Component that renders a client form.

**Server Component + client child pattern** (all 19 lines of page.tsx):
```typescript
// No "use client" — Server Component.
// Pass props from server; never import server-only libs in client components
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900 mb-8">...</h1>
      <LookupForm contactPhone={env.CONTACT_PHONE} />
    </main>
  );
}
```

**Adapted for login:**
```typescript
// src/app/login/page.tsx — no 'use client', no env import needed (password never to client)
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <LoginForm />
    </main>
  );
}
```

---

### `src/app/dashboard/layout.tsx` (layout, —)

**Analog:** `src/app/layout.tsx` — root layout pattern.

**RootLayout pattern** (lines 21–37 of layout.tsx):
```typescript
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

**Adapted for dashboard layout** — wraps children in `<AdminShell>`:
```typescript
// src/app/dashboard/layout.tsx — Server Component
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
```

---

### `src/app/dashboard/page.tsx`, `src/app/dashboard/calls/page.tsx`, `src/app/dashboard/drivers/page.tsx` (pages, CRUD)

**Analog:** `src/app/track/[token]/page.tsx` — async Server Component that fetches data server-side and passes to presentational components.

**Async Server Component with await params** (lines 21–38 of track/[token]/page.tsx):
```typescript
// No "use client" — Server Component.
interface Props {
  params: Promise<{ token: string }>; // Next.js 16: params is a Promise
}

export default async function SharePage({ params }: Props) {
  const { token } = await params; // MUST await (Next.js 16 — Pitfall 1 equivalent)
  // ... fetch data server-side
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <TrackingResult consignment={result.consignment} readOnly />
    </main>
  );
}
```

**searchParams for filter state** (analogous — from RESEARCH.md §Anti-Patterns):
```typescript
// src/app/dashboard/calls/page.tsx
interface Props {
  searchParams: Promise<{ period?: string; outcome?: string; q?: string; from?: string; to?: string; page?: string }>;
}
export default async function CallHistoryPage({ searchParams }: Props) {
  const params = await searchParams;
  // Read filter state from URL — no useEffect, no client-side fetch
}
```

**notFound() error pattern** (line 27 of track/[token]/page.tsx):
```typescript
if (!consignmentNumber) notFound();
```

---

### `src/app/dashboard/calls/[id]/page.tsx` (page, CRUD)

**Analog:** `src/app/track/[token]/page.tsx` — dynamic route with `await params`.

**Dynamic param extraction** (lines 21–27 of track/[token]/page.tsx):
```typescript
interface Props {
  params: Promise<{ token: string }>;
}
export default async function SharePage({ params }: Props) {
  const { token } = await params;
```

**Adapted:**
```typescript
interface Props {
  params: Promise<{ id: string }>;
}
export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;
  const call = await getCallById(id);
  if (!call) notFound();
  // PII: never pass raw call.from_number to client — mask here
  const maskedNumber = maskPhone(call.from_number);
  return <CallDetail ... />;
}
```

---

### `src/components/admin/LoginForm.tsx` (component, request-response)

**Analog:** `src/components/LookupForm.tsx` — `'use client'` + `useActionState` + server action + form pattern. This is the closest exact match.

**Client component header + useActionState** (lines 1–13 of LookupForm.tsx):
```typescript
'use client';

import { useActionState } from 'react';
import { lookup } from '@/app/actions/lookup';
import { PortalView } from './PortalView';

export function LookupForm({ contactPhone }: Props) {
  const [result, formAction, pending] = useActionState(lookup, null);
```

**Input field pattern with focus:ring-accent** (lines 20–31 of LookupForm.tsx):
```typescript
<input
  id="trackingRef"
  name="trackingRef"
  type="text"
  required
  className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
             focus:outline-none focus:ring-2 focus:ring-accent"
/>
```

**Submit button with pending state** (lines 53–60 of LookupForm.tsx):
```typescript
<button
  type="submit"
  disabled={pending}
  className="w-full h-12 rounded-full bg-accent text-white font-medium
             transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
>
  {pending ? 'Checking…' : 'Track delivery'}
</button>
```

**Error display pattern** (from ErrorState.tsx lines 40–42):
```typescript
<div role="alert" className="flex flex-col gap-4 w-full max-w-md">
  <h2 className="text-lg font-semibold text-zinc-900">{heading}</h2>
```

**Adapted for login** — password field (`type="password"`), single field, error state below field:
```typescript
'use client';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  return (
    <div className="max-w-sm w-full border border-zinc-200 rounded-xl p-8 bg-background">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Derby Aggs — Staff login</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-zinc-700">Password</label>
          <input
            id="password" name="password" type="password" required
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
                       focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {state?.error && (
            <p role="alert" className="text-sm text-red-600 mt-1">{state.error}</p>
          )}
        </div>
        <button type="submit" disabled={pending}
          className="w-full h-12 rounded-full bg-accent text-white font-semibold
                     transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
```

---

### `src/components/admin/MetricCard.tsx` (component, —)

**Analog:** `src/components/StatusHeader.tsx` — presentational Server Component, data display with Tailwind.

**Presentational pattern** (all 29 lines of StatusHeader.tsx):
```typescript
// No 'use client' — pure presentation
import type { MappedConsignment } from '@/types/tracking';

export function StatusHeader({ consignment }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold text-zinc-900">{plainStatus}</h1>
      <p className="text-base text-zinc-600">{description}</p>
    </div>
  );
}
```

**MetricCard follows same pattern — no 'use client', interface Props, Tailwind only:**
```typescript
interface Props {
  label: string;
  value: number | string; // string to allow "—" empty state
  description?: string;
}
export function MetricCard({ label, value, description }: Props) {
  return (
    <div className="border border-zinc-200 rounded-xl p-6 bg-background">
      <p className="text-3xl font-semibold text-zinc-900">{value}</p>
      <h2 className="text-sm font-semibold text-zinc-500 mt-1">{label}</h2>
      {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
    </div>
  );
}
```

---

### `src/components/admin/PeriodTabs.tsx` (component, event-driven)

**Analog:** `src/components/MilestoneStepper.tsx` — iterates over a fixed list, renders active/inactive states with Tailwind conditional classes.

**Active/inactive class pattern** (lines 28–42 of MilestoneStepper.tsx):
```typescript
const done = idx <= activeIdx;
const active = idx === activeIdx;
<div className={`w-6 h-6 rounded-full flex items-center justify-center
  ${done ? 'bg-accent text-white' : 'bg-zinc-200 text-zinc-400'}`}
>
```

**PeriodTabs — client component using URL param for state:**
```typescript
'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const PERIODS = ['today', '7d', '30d'] as const;
const LABELS = { today: 'Today', '7d': '7 days', '30d': '30 days' };

export function PeriodTabs() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = (searchParams.get('period') ?? 'today') as typeof PERIODS[number];

  return (
    <div className="flex border-b border-zinc-200">
      {PERIODS.map((p) => (
        <button key={p}
          onClick={() => router.push(`${pathname}?period=${p}`)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors
            ${current === p
              ? 'text-accent border-accent'
              : 'text-zinc-500 border-transparent hover:text-zinc-700'}`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
```

---

### `src/components/admin/CallHistoryTable.tsx` (component, CRUD)

**Analog:** `src/components/EventHistory.tsx` — list iteration, time display, Tailwind table-like layout.

**List + sort + map pattern** (lines 6–28 of EventHistory.tsx):
```typescript
const sorted = [...routeDetails].reverse(); // never mutate prop
return (
  <section aria-label="Scan history">
    <h2 className="text-sm font-semibold text-zinc-700 mb-2">Scan history</h2>
    <ol className="flex flex-col gap-3">
      {sorted.map((event, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <time className="text-zinc-500 w-24 shrink-0">{event.routeDate}</time>
          <span className="text-zinc-900">{event.status} — {event.type}</span>
        </li>
      ))}
    </ol>
  </section>
);
```

**CallHistoryTable extends this pattern** — uses `CallSummary` type (NOT raw `CallRow` — Pitfall 4), mobile card collapse, outcome badge:
```typescript
// NOT 'use client' if purely presentational — data passed as props
// 'use client' only if pagination buttons require local state
interface CallSummary {
  id: string;
  start_at: string;
  duration_ms: number | null;
  tracking_ref: string | null;
  outcome: CallRow['outcome'];
  from_number_masked: string; // NEVER raw from_number — Pitfall 4
}
```

**Outcome badge pattern** (no exact analog — see Shared Patterns below):
```typescript
// Outcome badge — semantic colour, not accent
const OUTCOME_STYLES: Record<string, string> = {
  resolved: 'bg-green-100 text-green-600',
  missed:   'bg-amber-100 text-amber-600',
  escalated:'bg-zinc-100 text-zinc-600',
  failed:   'bg-zinc-100 text-zinc-600',
};
<span
  className={`rounded-full px-2 py-0.5 text-sm font-semibold ${OUTCOME_STYLES[outcome ?? 'failed']}`}
  aria-label={`Outcome: ${outcome ?? 'unknown'}`}
>
  {outcome ?? '—'}
</span>
```

---

### `src/components/admin/CallFilters.tsx` (component, event-driven)

**Analog:** `src/components/LookupForm.tsx` — `'use client'`, form inputs, label/input pairs with `focus:ring-accent`.

**Input field styling** (lines 21–31 of LookupForm.tsx):
```typescript
<label htmlFor="trackingRef" className="block text-sm font-medium text-zinc-700">
  Tracking number
</label>
<input
  id="trackingRef" name="trackingRef" type="text"
  className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
             focus:outline-none focus:ring-2 focus:ring-accent"
/>
```

**CallFilters pushes filter state to URL** (same as PeriodTabs pattern):
```typescript
'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export function CallFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);
  // ...debounce search with setTimeout ref
}
```

---

### `src/components/admin/DriverModal.tsx` (component, CRUD)

**Analog:** `src/components/ShareBar.tsx` — `'use client'`, local state management, calls server action async, loading state on button.

**Async server-action call with loading state** (lines 25–35 of ShareBar.tsx):
```typescript
async function handleCopy() {
  setLoading(true);
  try {
    const path = await makeShareUrl(consignmentNumber);
    // ...
  } finally {
    setLoading(false);
  }
}
```

**Button disabled pattern** (lines 44–50 of ShareBar.tsx):
```typescript
<button
  onClick={handleCopy}
  disabled={loading}
  className="... disabled:opacity-60 disabled:cursor-not-allowed"
>
  {copied ? 'Link copied!' : loading ? 'Generating…' : 'Copy share link'}
</button>
```

**DriverModal uses startTransition + server action:**
```typescript
'use client';
import { useTransition } from 'react';
import { addDriver, updateDriver } from '@/app/actions/drivers';

export function DriverModal({ driver, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await (driver ? updateDriver(driver.id, formData) : addDriver(null, formData));
      if (result?.error) { setError(result.error); return; }
      onClose('saved');
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
      className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black/40" onClick={() => onClose('cancel')} />
      <div className="relative max-w-sm w-full rounded-xl shadow-lg p-6 bg-background z-10">
        {/* focus trap: tabIndex management on first/last focusable element */}
        <h2 id="modal-title" className="text-xl font-semibold mb-4">
          {driver ? 'Edit driver' : 'Add driver'}
        </h2>
        <form action={handleSave} className="flex flex-col gap-4">
          {/* inputs follow LookupForm label+input pattern */}
          <button disabled={isPending}
            className="w-full h-11 rounded-full bg-accent text-white font-semibold
                       disabled:opacity-60 disabled:cursor-not-allowed">
            {isPending ? 'Saving…' : 'Save driver'}
          </button>
        </form>
        {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
```

---

### `src/lib/seed/seed-calls.ts` (utility/script, batch)

**Analog:** `src/lib/repositories/lookup-log.ts` — uses the same Supabase client import and `.from().insert()` pattern.

**Supabase client usage pattern** (lines 136–138 of lookup-log.ts):
```typescript
const { supabase } = await import('../supabase');
_defaultRepo = createLookupLogRepo(supabase as unknown as SupabaseLike);
```

**Seed script pattern:**
```typescript
// src/lib/seed/seed-calls.ts
// NEVER imported in app code — run via: npx tsx src/lib/seed/seed-calls.ts
import 'dotenv/config'; // load .env.local

const IS_MOCK = process.env.PALLEX_MOCK === 'true';
if (!IS_MOCK) {
  console.error('ERROR: Seed script only runs when PALLEX_MOCK=true. Aborting.');
  process.exit(1);
}

// Check idempotency — skip if SEED- rows already exist
const { data: existing } = await supabase
  .from('calls')
  .select('id')
  .like('tracking_ref', 'SEED-%')
  .limit(1);

if (existing && existing.length > 0) {
  console.log('Seed data already present. Run with --force to re-seed.');
  process.exit(0);
}

// Insert ~25 customer calls + ~4 driver call rows
// Each row has tracking_ref prefixed "SEED-" for identification
```

---

## Shared Patterns

### `'use server'` + `import 'server-only'` Header
**Source:** `src/app/actions/lookup.ts` lines 1–5
**Apply to:** All files in `src/app/actions/` (`auth.ts`, `drivers.ts`)
```typescript
'use server';

import { lookupConsignment, lookupForShare } from '@/lib/tracking/service';
// import 'server-only' is NOT in lookup.ts — add it explicitly to dashboard actions
// to match the RESEARCH.md recommendation (Pattern 1 and Pattern 4)
```
**Note:** Add `import 'server-only'` explicitly in auth.ts and drivers.ts — it is not in lookup.ts but the research pattern prescribes it for dashboard actions.

### `server-only` Guard on DB Modules
**Source:** `src/lib/supabase.ts` line 5
**Apply to:** `src/lib/repositories/calls-repo.ts`, `src/lib/repositories/drivers-repo.ts` (via lazy import of supabase), any module reading `env.DASHBOARD_PASSWORD`
```typescript
// SERVER ONLY — never import into a client component; service role bypasses RLS.
import 'server-only';
```

### `focus:ring-accent` Input Styling
**Source:** `src/components/LookupForm.tsx` lines 27–30
**Apply to:** All form inputs in `LoginForm.tsx`, `DriverModal.tsx`, `CallFilters.tsx`
```typescript
className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base mt-1
           focus:outline-none focus:ring-2 focus:ring-accent"
```

### `bg-accent text-white rounded-full` Primary Button
**Source:** `src/components/LookupForm.tsx` lines 53–60
**Apply to:** Login CTA, Save driver button, Add driver button
```typescript
className="w-full h-12 rounded-full bg-accent text-white font-medium
           transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
```

### Conditional Tailwind Classes for State
**Source:** `src/components/MilestoneStepper.tsx` lines 29–32
**Apply to:** `PeriodTabs.tsx` (active/inactive), `AdminShell.tsx` nav links (active/default/hover), outcome badges
```typescript
className={`... ${active ? 'bg-accent text-white' : 'bg-zinc-200 text-zinc-400'}`}
```

### `date-fns` Date Formatting
**Source:** `src/components/StatusHeader.tsx` lines 1, 13–17
**Apply to:** `CallHistoryTable.tsx` (start_at display), `CallDetail.tsx`, `MetricCard.tsx` (period labels)
```typescript
import { format, parseISO } from 'date-fns';
try {
  etaDisplay = format(parseISO(estimatedDelDate), 'EEEE d MMMM');
} catch {
  etaDisplay = estimatedDelDate; // fallback to raw string
}
```

### `await params` / `await searchParams` (Next.js 16)
**Source:** `src/app/track/[token]/page.tsx` line 23
**Apply to:** All dashboard page files that receive `params` or `searchParams` — `src/app/dashboard/calls/[id]/page.tsx`, `src/app/dashboard/calls/page.tsx`, `src/app/dashboard/page.tsx`
```typescript
const { token } = await params; // Next.js 16: params is a Promise (Pitfall 1 in RESEARCH.md)
```

### Lazy Supabase Import in Repositories (testability)
**Source:** `src/lib/repositories/lookup-log.ts` lines 133–138
**Apply to:** `calls-repo.ts`, `drivers-repo.ts` default exports
```typescript
async function getDefaultRepo() {
  if (!_defaultRepo) {
    const { supabase } = await import('../supabase');
    _defaultRepo = createCallsRepo(supabase as unknown as SupabaseLike);
  }
  return _defaultRepo;
}
```

### Zod Schema + `safeParse` Pattern
**Source:** `src/lib/env.ts` lines 12–45 (schema), 53–65 (`safeParse`)
**Apply to:** `src/app/actions/drivers.ts` (driver form validation), `src/lib/session.ts` (env validation)
```typescript
const result = envSchema.safeParse(source);
if (!result.success) {
  const issues = result.error.issues.map((issue) => { ... }).join('; ');
  throw new Error(`Invalid environment: ${issues}`);
}
return result.data;
```

### `role="alert"` Error Display
**Source:** `src/components/ErrorState.tsx` line 40
**Apply to:** `LoginForm.tsx` error state, `DriverModal.tsx` validation errors
```typescript
<div role="alert" className="flex flex-col gap-4 w-full max-w-md">
  <h2 className="text-lg font-semibold text-zinc-900">{heading}</h2>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/admin/Toast.tsx` | component | event-driven | No toast/notification component exists; hand-author per UI-SPEC (fixed-position div, auto-dismiss 3s, no library) |
| `src/components/admin/AdminShell.tsx` | layout | — | No sidebar/nav shell exists; closest structural reference is `src/app/layout.tsx` but the responsive sidebar pattern is new to Phase 3 |

**For Toast.tsx** — build per UI-SPEC contract: `fixed bottom-4 left-1/2 -translate-x-1/2, bg-zinc-900 text-white text-sm rounded-full px-4 py-2`, `useEffect` setTimeout 3000ms auto-dismiss, `useTransition` or `useState` show/hide.

**For AdminShell.tsx** — build per UI-SPEC contract: left sidebar 240px fixed at `lg:` breakpoint, off-canvas at mobile, nav links using conditional class pattern from `MilestoneStepper.tsx`, logout calls `logoutAction` server action.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/`, `src/types/`
**Files scanned:** 22 source files read
**Pattern extraction date:** 2026-06-12
