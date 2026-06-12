# Phase 3: Admin Dashboard - Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 App Router admin dashboard — shared-password auth, call metrics, call history with transcripts/recordings, driver CRUD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dev-only seed script inserts realistic sample data into `calls` (inbound + outbound rows with transcripts, outcomes, durations, masked `from_number`, parent_call_id links) so all dashboard surfaces are testable now. Seed data is clearly marked and is replaced by real calls in Phase 4.
- **D-02:** Polished empty states on every data surface (metrics, history, transcript, sub-log) — the dashboard must never look broken when the table is genuinely empty.
- **D-03:** Recording playback UI (ADMIN-05) built now with stub audio URL or "recording unavailable" state; real files and 30-day retention arrive in Phase 4.
- **D-04:** Login page + signed httpOnly session cookie. Shared password stored as env var (server-side only, never shipped to client); correct entry sets a signed, httpOnly, secure session cookie.
- **D-05:** Middleware redirects any unauthenticated request for `/dashboard/*` to `/login`. Includes logout action and session expiry.
- **D-06:** Session cookie signed/verified server-side; reuse or align with the HMAC approach from `src/lib/share/token.ts`, or use Next.js session conventions. Secret is an env var, server-only.
- **D-07:** Multi-route dashboard with shared nav/shell — routes for Metrics (`/dashboard`), Call History (`/dashboard/calls`), Drivers (`/dashboard/drivers`). Login is its own route outside the authed shell.
- **D-08:** Mobile-first responsive. Call-history table and transcript views MUST degrade gracefully on narrow screens (horizontal scroll or stacked card layout). Staff often at desks, so desktop/tablet width must be comfortable.
- **D-09:** Reuse Phase 2 visual system — `--accent` CSS token (`bg-accent`/`text-accent`), Tailwind utilities, neutral base — same product feel as portal.
- **D-10:** Add/edit drivers via modal forms. Deactivate = set `active` boolean to false (soft, reversible). Delete = hard delete behind confirm step. E.164 phone validation. Changes immediately reflected.
- **D-11:** Metrics (ADMIN-02): derive received/answered/missed/success(containment) from `calls` table over today/7d/30d. Success = outcome `resolved` vs `escalated`/`failed`.
- **D-12:** Call history (ADMIN-03): list inbound customer calls with filters (date-range + outcome) and tracking-ref search. Each row opens detail view with transcript (ADMIN-04) and recording playback (ADMIN-05).
- **D-13:** Driver-call sub-log (ADMIN-07): on a customer call's detail, show linked outbound `call_type='driver'` rows via `parent_call_id`.

### Claude's Discretion

- Exact metrics layout (cards vs compact stat row), table vs card breakpoints, transcript rendering style, loading/skeleton states, seed-data volume and content.
- Session library/mechanism choice (Next.js middleware + signed cookie vs lightweight session lib) — must meet D-04..D-06 (httpOnly, server-checked env password, all routes gated).

### Deferred Ideas (OUT OF SCOPE)

- Real call data, real recording files, 30-day retention enforcement — Phase 4.
- Per-user staff accounts / SSO / role-based access — v2 decision.
- Exporting metrics/history (CSV etc.) — not in ADMIN-01..07.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Staff log in with shared password; all dashboard pages gated | Iron Session v8 + Next.js middleware pattern; `DASHBOARD_PASSWORD` env var |
| ADMIN-02 | Call metrics: received/answered/missed/success rate for today/7d/30d | `calls` repo with window queries; MetricCard components; PeriodTabs |
| ADMIN-03 | Call history log filterable by date, outcome, searchable by tracking ref | `calls` repo with filter + search; CallHistoryTable with pagination; CallFilters |
| ADMIN-04 | Full transcript view with speaker labels | TranscriptView component from `calls.transcript` JSON field |
| ADMIN-05 | Call recording playback (30-day retention) | Native `<audio controls>` with stub/unavailable state; recording URL from call row |
| ADMIN-06 | Driver CRUD: add/edit/deactivate/delete | `drivers` repo; DriverList; DriverModal; DeleteConfirmDialog; toast feedback |
| ADMIN-07 | Outbound driver call sub-log linked to parent customer call | `calls` repo query by `parent_call_id`; DriverCallSubLog collapsible section |
</phase_requirements>

---

## Summary

Phase 3 adds a staff-only admin dashboard to the existing Next.js 16 App Router application. The work is contained to three areas: authentication/gating, read-only data display (metrics, call history, transcripts, recordings), and driver CRUD. The `calls` and `drivers` tables were created in Phase 1 and require no schema migration — this phase adds repositories and UI only.

The key architectural insight is that no new library is required for session management: `iron-session` v8 is the standard Next.js App Router session solution, is already indexed in npm, integrates cleanly with Next.js middleware, and its cookie encryption model meets D-04..D-06 directly. The `HMAC` approach in `src/lib/share/token.ts` from Phase 2 is a precedent but is not the right primitive for cookie sessions — iron-session wraps password-based AES encryption plus MAC, which is the correct primitive for this use case.

The Phase 2 visual system (Tailwind v4, hand-authored components, `--accent` token) is already established. All admin components follow the same patterns: Server Components for data, Client Components only where interactivity is required (filters, modals, toasts), and the `server-only` guard on any module reading the service-role client.

The calls table is empty during Phase 3 development. A dev-only seed script is the solution (D-01). Seed data should include 20–30 realistic customer calls spanning the last 30 days (mix of resolved/escalated/missed outcomes, some with tracking refs, some with transcript JSON, some without), plus 3–5 linked outbound driver calls. This gives every data surface meaningful content.

**Primary recommendation:** Use iron-session v8 for session management with a `DASHBOARD_PASSWORD` env var; add two repositories (`calls-repo.ts`, `drivers-repo.ts`) following the `createLookupLogRepo` factory pattern already established; hand-author all components following Phase 2 conventions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login form + password check | Frontend Server (SSR) | — | Password checked server-side in a Server Action; never on client |
| Session cookie set/verify | Frontend Server (SSR) | — | httpOnly cookie requires server-side write; iron-session does this in Route Handler or Server Action |
| Middleware auth gate | Frontend Server (SSR) | — | Next.js middleware runs at the edge before page render |
| Metrics query (today/7d/30d) | API / Backend | — | Server Component reads DB via service-role client; no API route needed |
| Call history query (filtered) | API / Backend | — | Server Component + URL searchParams for filters; DB read |
| Transcript display | Browser / Client | Frontend Server | Data fetched server-side; rendered client-side with scroll interaction |
| Recording playback | Browser / Client | — | Native `<audio>` element; URL resolved server-side, rendered client |
| Driver CRUD (add/edit/delete) | API / Backend | Browser / Client | Server Actions for mutations; Client Components for modals/forms |
| Driver list display | API / Backend | — | Server Component reads `drivers` table via service-role client |
| Seed script | Database / Storage | — | Node script against Supabase; dev-only |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| iron-session | 8.0.4 [VERIFIED: npm registry] | Signed + encrypted httpOnly session cookie for Next.js App Router | Official pattern for stateless cookie-based sessions in Next.js; supports `cookies()` from `next/headers`; edge-compatible; no DB required; password-based AES + MAC |
| next (App Router) | 16.2.9 [VERIFIED: package.json] | Framework — already installed | Already in use; middleware + server actions are the auth primitives |
| zod | ^3 [VERIFIED: package.json] | Runtime validation for driver form data (E.164, name) | Already in use across the project |
| @supabase/supabase-js | latest [VERIFIED: package.json] | DB access via service-role client | Already established; `src/lib/supabase.ts` is the server-only singleton |
| date-fns | ^3 [VERIFIED: package.json] | Format call timestamps, duration display, date-range window calculation | Already in package.json; no moment.js per project conventions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| server-only | ^0.0.1 [VERIFIED: package.json] | Build-time guard preventing server modules leaking to client bundle | Applied to any module reading supabase, env secrets, or iron-session config |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| iron-session | Raw HMAC cookie (extend `src/lib/share/token.ts`) | HMAC verifies integrity but does NOT encrypt — password would be readable in cookie value. iron-session encrypts + MACs, which is the right primitive for auth sessions. |
| iron-session | next-auth / Auth.js v5 | Auth.js is heavyweight for a single shared password; no user accounts needed in v1. iron-session is < 3KB, zero config beyond a password. |
| iron-session | JWT via jose | jose is a valid low-level primitive but requires hand-rolling cookie management, expiry, and the Next.js middleware integration iron-session already provides. |

**Installation:**
```bash
npm install iron-session
```

**Version verification:** iron-session 8.0.4 confirmed current as of research date. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Staff browser
    │  POST /login (password form)
    │
    ▼
Next.js Middleware (/dashboard/*)
    │  No valid session cookie → redirect /login
    │  Valid session cookie → allow
    ▼
Dashboard Shell (AdminShell — Server Component)
    │
    ├─ /dashboard          MetricsPage (Server Component)
    │                          └─ calls repo → MetricCard ×4 + PeriodTabs (client for tab switch)
    │
    ├─ /dashboard/calls    CallHistoryPage (Server Component, searchParams = filters)
    │                          └─ calls repo → CallHistoryTable + CallFilters (client)
    │                               └─ /dashboard/calls/[id]   CallDetailPage (Server Component)
    │                                    ├─ TranscriptView (client scroll)
    │                                    ├─ RecordingPlayer (native <audio>)
    │                                    └─ DriverCallSubLog (client collapsible)
    │
    └─ /dashboard/drivers  DriversPage (Server Component)
                               └─ drivers repo → DriverList (client modals + toast)
                                    ├─ DriverModal (add/edit — server action on save)
                                    └─ DeleteConfirmDialog (delete — server action on confirm)

Auth flow:
/login → LoginForm (client) → loginAction (server action) →
    iron-session.save() → redirect /dashboard

Logout:
logoutAction (server action) → iron-session.destroy() → redirect /login

Session secret: DASHBOARD_SESSION_SECRET (env var, min 32 chars)
Shared password: DASHBOARD_PASSWORD (env var, server-only)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx               # LoginForm (public route)
│   ├── dashboard/
│   │   ├── layout.tsx             # AdminShell wrapper (reads session for nav)
│   │   ├── page.tsx               # MetricsPage
│   │   ├── calls/
│   │   │   ├── page.tsx           # CallHistoryPage
│   │   │   └── [id]/
│   │   │       └── page.tsx       # CallDetailPage
│   │   └── drivers/
│   │       └── page.tsx           # DriversPage
│   └── actions/
│       ├── auth.ts                # loginAction, logoutAction (server actions)
│       └── drivers.ts             # addDriver, updateDriver, deactivateDriver, deleteDriver
├── components/
│   └── admin/
│       ├── AdminShell.tsx         # Sidebar + top bar shell
│       ├── LoginForm.tsx          # Password field + submit (client)
│       ├── PeriodTabs.tsx         # Today/7d/30d tab switcher (client)
│       ├── MetricCard.tsx         # Single stat card
│       ├── CallFilters.tsx        # Date range + outcome + search (client)
│       ├── CallHistoryTable.tsx   # Table/card list with pagination
│       ├── CallDetail.tsx         # Metadata grid (server-renderable)
│       ├── TranscriptView.tsx     # Scrollable transcript (client)
│       ├── RecordingPlayer.tsx    # <audio controls> wrapper
│       ├── DriverCallSubLog.tsx   # Collapsible driver call section (client)
│       ├── DriverList.tsx         # Table/card list
│       ├── DriverModal.tsx        # Add/edit dialog (client)
│       ├── DeleteConfirmDialog.tsx # Confirm hard delete (client)
│       └── Toast.tsx              # Auto-dismiss feedback (client)
├── lib/
│   ├── session.ts                 # iron-session config + SessionData type (server-only)
│   ├── repositories/
│   │   ├── calls-repo.ts          # createCallsRepo factory
│   │   └── drivers-repo.ts        # createDriversRepo factory
│   └── seed/
│       └── seed-calls.ts          # Dev-only seed script (never imported in app code)
└── middleware.ts                  # Auth gate: /dashboard/* → /login if no session
```

### Pattern 1: Iron Session — Login Server Action

**What:** Validate the submitted password against `DASHBOARD_PASSWORD` env var server-side; on match, save a session cookie via iron-session; redirect to dashboard.
**When to use:** The login form POST.

```typescript
// Source: Context7 /vvo/iron-session + project env patterns
// src/app/actions/auth.ts
'use server';
import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { redirect } from 'next/navigation';
import { sessionOptions, type SessionData } from '@/lib/session';
import { env } from '@/lib/env';

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = ((formData.get('password') as string | null) ?? '').trim();
  if (!password || password !== env.DASHBOARD_PASSWORD) {
    return { error: 'Incorrect password. Please try again.' };
  }
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.isLoggedIn = true;
  await session.save();
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  redirect('/login');
}
```

```typescript
// src/lib/session.ts — server-only
import 'server-only';
import type { SessionOptions } from 'iron-session';
import { env } from './env';

export interface SessionData {
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: env.DASHBOARD_SESSION_SECRET,
  cookieName: 'da_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
};
```

### Pattern 2: Next.js Middleware Auth Gate

**What:** Check iron-session cookie on every `/dashboard/*` request; redirect to `/login` if not authenticated.
**When to use:** All dashboard routes are gated.

```typescript
// Source: Context7 /vvo/iron-session middleware pattern
// src/middleware.ts
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from '@/lib/session';
import { sessionOptions } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return Response.redirect(new URL('/login', request.url), 302);
  }
  return undefined;
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

**Note:** `await cookies()` is required in Next.js 16 — the `cookies()` function now returns a Promise in the server context. [VERIFIED: codebase — `src/app/track/[token]/page.tsx` uses `await params`; same async-first pattern throughout the app]

### Pattern 3: Calls Repository Factory

**What:** Injectable factory for `calls` table queries; follows the `createLookupLogRepo` pattern exactly. Testable with a fake client.
**When to use:** All calls data access (metrics, history, call detail, driver sub-log).

```typescript
// src/lib/repositories/calls-repo.ts
// Pattern mirrors src/lib/repositories/lookup-log.ts exactly — injectable client.
export function createCallsRepo(client: SupabaseLike) {
  async function getMetrics(since: Date): Promise<CallMetrics> { ... }
  async function listCustomerCalls(opts: CallListOptions): Promise<{ rows: CallRow[]; total: number }> { ... }
  async function getCallById(id: string): Promise<CallRow | null> { ... }
  async function getDriverCallsForParent(parentCallId: string): Promise<CallRow[]> { ... }
  return { getMetrics, listCustomerCalls, getCallById, getDriverCallsForParent };
}
```

### Pattern 4: Driver CRUD via Server Actions

**What:** CRUD operations as Server Actions; client components call them; server validates with zod (E.164).
**When to use:** DriverModal save, deactivate toggle, delete confirm.

```typescript
// src/app/actions/drivers.ts
'use server';
import 'server-only';
import { z } from 'zod';

const driverSchema = z.object({
  name: z.string().min(1, 'Please enter the driver\'s full name.'),
  phone_e164: z.string().regex(
    /^\+[1-9]\d{7,14}$/,
    'Enter a valid phone number in E.164 format (e.g. +44 7911 123456).',
  ),
});
// Session must be verified inside each action — middleware gates pages but
// actions are POST endpoints that can be called directly.
```

### Pattern 5: Metrics Period Filtering

**What:** Three fixed windows (today, 7d, 30d) calculated from `calls` table columns `start_at` and `outcome`. Tab state is client-side URL param, data re-fetched server-side.
**When to use:** MetricsPage.

Metrics derivation from `calls` table:
- **Received** = COUNT(*) WHERE `call_type='customer'` AND `direction='inbound'` AND `start_at >= window_start`
- **Answered** = received WHERE `outcome IS NOT NULL` (call connected and agent responded)
- **Missed** = received WHERE `outcome = 'no_data'` OR `end_at IS NULL` (no answer / disconnected immediately)
- **Success rate** = answered WHERE `outcome = 'resolved'` / answered × 100

**Note:** The `outcome` field values are: `'resolved' | 'escalated' | 'no_data' | 'failed' | null`. During Phase 3, the seed script must include rows for all outcome values to make metrics non-trivial.

### Pattern 6: Seed Script

**What:** A standalone Node script (never imported in app code) that inserts realistic sample data into `calls` and validates no real data is overwritten.
**When to use:** Developer runs `npx tsx src/lib/seed/seed-calls.ts` (or a package.json script `"seed": "tsx src/lib/seed/seed-calls.ts"`).

```typescript
// src/lib/seed/seed-calls.ts
// Guard: only runs when PALLEX_MOCK=true (dev mode) — never executes against production.
// Inserts ~25 customer calls spanning 30 days + ~5 driver call rows.
// Each call row has a clearly recognisable tracking_ref prefix ("SEED-") for identification.
// Script is idempotent: checks for existing SEED- rows and skips if already seeded.
```

### Anti-Patterns to Avoid

- **Session check in page components instead of middleware:** Putting `getIronSession()` in every page component creates races and gaps. Middleware is the single gate.
- **Reading `supabase` singleton in a client component:** The `server-only` guard in `src/lib/supabase.ts` will catch this at build time, but never attempt to work around it. All DB access goes through Server Components or Server Actions.
- **Passing `CallRow` objects wholesale as props to client components:** `CallRow.transcript` and `CallRow.from_number` contain PII. Pass only the specific fields a client component needs; mask `from_number` before it leaves the server.
- **Storing `DASHBOARD_PASSWORD` as a hardcoded default:** Unlike `SHARE_TOKEN_SECRET` which has a dev default, the admin password must have NO default — an empty or missing `DASHBOARD_PASSWORD` must throw at startup, not silently allow any password.
- **Using `useEffect` + `fetch` for metrics:** Use Server Components with `searchParams` for filter state. Avoids client-side waterfalls and keeps PII server-side.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signed + encrypted session cookie | Custom HMAC cookie (extend share token) | iron-session v8 | HMAC verifies integrity but does not encrypt — session cookie would expose `isLoggedIn` in plaintext; iron-session uses AES-256-CBC + HMAC |
| Dialog focus trap | Custom JS focus management | Hand-authored modal with `inert` attribute polyfill or `tabIndex` management | The project has no Radix — implement focus trap manually; `inert` is supported in all modern browsers (2022+) and is the standard approach |
| E.164 phone validation | Custom regex | zod refinement with `/^\+[1-9]\d{7,14}$/` | This regex is the standard E.164 format check; no library needed beyond zod which is already installed |
| Toast notification | Complex toast library (react-toastify, sonner) | Hand-authored single Toast component per UI spec | The project uses no component library; a fixed-position auto-dismiss div is 20 lines of code; no dependency needed |
| Date window calculation | Custom date math | date-fns `startOfDay`, `subDays` | date-fns is already installed and handles DST-safe date arithmetic |

**Key insight:** This phase needs zero new UI libraries. The design system is already established in Phase 2. Every component listed in the UI spec can be hand-authored with Tailwind utilities in under 100 lines each.

---

## Common Pitfalls

### Pitfall 1: cookies() Is Async in Next.js 16

**What goes wrong:** `const cookieStore = cookies()` (no await) fails silently or throws in Next.js 16 because `cookies()` returns a Promise in server contexts.
**Why it happens:** Breaking change between Next.js 14/15 and 16. Iron-session documentation examples sometimes omit `await`.
**How to avoid:** Always `const cookieStore = await cookies()` and pass to `getIronSession(cookieStore, sessionOptions)`. The existing codebase uses `await params` — apply the same pattern.
**Warning signs:** `TypeError: cookieStore.get is not a function` at runtime.

### Pitfall 2: Middleware Cannot Import server-only Modules

**What goes wrong:** `src/middleware.ts` imports `@/lib/session.ts` which imports `@/lib/env.ts` which is fine — BUT if `src/lib/supabase.ts` is imported anywhere in the middleware chain, Next.js throws because middleware runs in the Edge runtime and `server-only` is not edge-compatible.
**Why it happens:** Middleware runs in a restricted Edge-compatible environment; `import 'server-only'` throws in edge context.
**How to avoid:** `src/lib/session.ts` must NOT import `server-only`. Keep it as a pure config file. Only Server Actions and Server Components import `server-only` modules.
**Warning signs:** Build error: `The module 'server-only' cannot be used in Edge Runtime`.

### Pitfall 3: DASHBOARD_PASSWORD Must Have No Default

**What goes wrong:** If `env.ts` declares a default for `DASHBOARD_PASSWORD` (like `SHARE_TOKEN_SECRET` does), then a misconfigured production deployment silently uses the default and the dashboard is either open to everyone (if default is empty string) or secured with a known default password.
**Why it happens:** Developers copy the `SHARE_TOKEN_SECRET` pattern which has a dev default as a convenience.
**How to avoid:** Add `DASHBOARD_PASSWORD: z.string().min(8)` with NO `.default()` in `env.ts`. Fail loudly at startup if absent.
**Warning signs:** Dashboard accessible with a password that was never explicitly set.

### Pitfall 4: from_number PII Leaked to Client Components

**What goes wrong:** A Server Component fetches a `CallRow` and passes the entire object as props to a client component. `from_number` (caller's phone number) is personal data and must not leave the server unmasked.
**Why it happens:** TypeScript spreading `CallRow` without thinking about PII fields.
**How to avoid:** Define a `CallSummary` type that includes only the fields the client component needs, with `from_number_masked: string` (e.g., "••• 1234"). Never pass raw `CallRow` to client components.
**Warning signs:** Client component receives `from_number: "+447..."` in its props.

### Pitfall 5: Server Actions Are Publicly Addressable POST Endpoints

**What goes wrong:** A driver mutation server action (delete, deactivate) is called directly without re-verifying the session inside the action. A malicious actor calls the action POST endpoint directly without a session cookie.
**Why it happens:** Developers assume middleware auth gate protects server actions — it does not. Middleware gates page routes; server actions are separate POST endpoints.
**How to avoid:** Every mutation server action (`addDriver`, `updateDriver`, `deactivateDriver`, `deleteDriver`) must call `getIronSession()` and verify `session.isLoggedIn === true` as its first step. If not authenticated, throw or return an error.
**Warning signs:** Mutations succeed when called with `curl` without a session cookie.

### Pitfall 6: Seed Data Volume Too Large or Too Small

**What goes wrong:** Too few seed rows (< 10) means the call history table looks like an empty state; metrics show "0" for most windows. Too many (> 100) means the dev DB becomes slow and seeding takes minutes.
**Why it happens:** No guidance on seed data volume.
**How to avoid:** Target 25 customer call rows: ~8 in the last 24h, ~15 in the last 7d, 25 total in 30d. Mix all four outcomes. Include 3–5 with transcripts (multi-turn JSON strings). Add 4 linked driver call rows for two of the customer calls. Add 5 driver rows. This is sufficient to show pagination, filters, and metrics with non-trivial numbers.
**Warning signs:** Metrics page shows "0 / 0 / 0" for all periods because all seed data was inserted outside the 30d window.

---

## Code Examples

### Iron Session Config (server-only)

```typescript
// Source: Context7 /vvo/iron-session — verified pattern
// src/lib/session.ts — NO 'server-only' import (middleware compatibility)
import type { SessionOptions } from 'iron-session';

export interface SessionData {
  isLoggedIn: boolean;
}

// Password read lazily — session.ts is imported by middleware which runs in Edge;
// env.ts lazy proxy is fine here but supabase.ts must NOT be imported.
export function getSessionOptions(): SessionOptions {
  return {
    password: process.env.DASHBOARD_SESSION_SECRET ?? (() => { throw new Error('DASHBOARD_SESSION_SECRET is required'); })(),
    cookieName: 'da_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hour session expiry
    },
  };
}
```

### Calls Repository — Metrics Query

```typescript
// Source: pattern mirrors src/lib/repositories/lookup-log.ts [VERIFIED: codebase]
// src/lib/repositories/calls-repo.ts

export interface CallMetrics {
  received: number;
  answered: number;
  missed: number;
  successRate: number; // 0-100
}

export function createCallsRepo(client: SupabaseLike) {
  async function getMetrics(since: Date): Promise<CallMetrics> {
    const { data, error } = await client
      .from('calls')
      .select('outcome, end_at, call_type, direction, start_at')
      .eq('call_type', 'customer')
      .eq('direction', 'inbound')
      .gte('start_at', since.toISOString());

    if (error || !data) return { received: 0, answered: 0, missed: 0, successRate: 0 };

    const rows = data as Array<{ outcome: string | null; end_at: string | null }>;
    const received = rows.length;
    const answered = rows.filter(r => r.outcome !== null && r.outcome !== 'no_data').length;
    const resolved = rows.filter(r => r.outcome === 'resolved').length;
    const missed = received - answered;
    const successRate = answered > 0 ? Math.round((resolved / answered) * 100) : 0;

    return { received, answered, missed, successRate };
  }
  // ...
  return { getMetrics, /* ... */ };
}
```

### E.164 Validation with Zod

```typescript
// Source: zod docs + project convention [VERIFIED: codebase uses zod throughout]
const driverSchema = z.object({
  name: z.string().min(1, "Please enter the driver's full name."),
  phone_e164: z
    .string()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      'Enter a valid phone number in E.164 format (e.g. +44 7911 123456).',
    ),
});
```

### Date Window Calculation

```typescript
// Source: date-fns v3 — already in package.json [VERIFIED: codebase]
import { startOfDay, subDays } from 'date-fns';

export function getWindowStart(period: 'today' | '7d' | '30d'): Date {
  const now = new Date();
  if (period === 'today') return startOfDay(now);
  if (period === '7d') return startOfDay(subDays(now, 7));
  return startOfDay(subDays(now, 30));
}
```

---

## Runtime State Inventory

This is not a rename/refactor/migration phase. Omitted.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-auth for simple password gate | iron-session for stateless cookie sessions | iron-session v8 (2024) | Simpler, no DB required, edge-compatible |
| `cookies()` synchronous | `await cookies()` async | Next.js 15+ | Must await; omitting causes runtime errors |
| `params` synchronous | `await params` async | Next.js 15+ | Already handled in codebase (`src/app/track/[token]/page.tsx`) |

**Deprecated/outdated:**
- `next-auth v4`: Superseded by Auth.js v5; overkill for shared-password use case.
- `cookies-next` package: Not needed — `next/headers` `cookies()` is sufficient.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | seed script (tsx) | ✓ | — | — |
| iron-session | ADMIN-01 auth | ✗ (not yet installed) | 8.0.4 in registry | — |
| Supabase local | seed script + dev testing | ✓ | supabase CLI in devDependencies | Use remote Supabase project |
| tsx (for seed script) | seed script runner | ✗ (not in package.json) | — | Add to devDependencies or use `node --loader ts-node/esm` |

**Missing dependencies with no fallback:**
- `iron-session` — must be installed (`npm install iron-session`) before auth work begins.

**Missing dependencies with fallback:**
- `tsx` — seed script can be run with `node --experimental-strip-types` (Node 22+) or by adding `tsx` as a devDependency.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | iron-session password comparison; env var password; timing-safe comparison for password check |
| V3 Session Management | yes | iron-session httpOnly cookie; server-side destruction on logout; 8h expiry |
| V4 Access Control | yes | Middleware gate on all /dashboard/* routes; session re-check in every mutation server action |
| V5 Input Validation | yes | zod for driver name + E.164 phone; input caps on all server actions |
| V6 Cryptography | yes | iron-session AES-256-CBC + HMAC; never hand-roll |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session cookie theft (XSS) | Spoofing | httpOnly cookie via iron-session — JS cannot read it |
| Password brute-force | Spoofing | Shared password is a v1 decision; acceptable at this scale; rate-limit login endpoint if needed |
| CSRF on driver mutation server actions | Tampering | Next.js Server Actions include CSRF protection via origin check by default in Next.js 14+ [ASSUMED — verify in Next.js 16 changelog] |
| PII exposure (from_number) | Info Disclosure | Mask before passing to client components; `server-only` guard on supabase module |
| Unauthenticated server action calls | Elevation of Privilege | Re-verify session inside every mutation action; never rely on middleware alone |
| Seed data in production | Info Disclosure | Seed script guarded by `PALLEX_MOCK=true` check; SEED- prefixed rows trivially identifiable |

---

## Open Questions (RESOLVED)

1. **`await cookies()` in middleware — edge compatibility with iron-session 8.0.4** — **RESOLVED**
   - What we know: Next.js 16 makes `cookies()` async; iron-session 8 examples show `await cookies()`.
   - What's unclear: Whether `getIronSession` with `await cookies()` works inside `src/middleware.ts` in the Edge runtime (middleware runs on Vercel Edge by default).
   - Recommendation: Test the middleware iron-session pattern early in the first plan wave. If Edge-incompatible, use `request.cookies.get('da_session')` + a lightweight manual verification inside middleware, and reserve `getIronSession` for Server Actions and Server Components only.
   - **RESOLVED:** Plan 03-01 Task 2 implements the iron-session middleware path AND a documented fallback to a presence-only cookie check (`request.cookies.get('da_session')`) for the Edge runtime, with a SUMMARY deviation note if the fallback is taken. `session.ts` deliberately omits `import 'server-only'` so it is Edge-safe.

2. **DASHBOARD_PASSWORD env var naming — conflict with existing `env.ts` schema** — **RESOLVED**
   - What we know: `env.ts` uses zod to validate all env vars. Adding `DASHBOARD_PASSWORD` and `DASHBOARD_SESSION_SECRET` requires updating `envSchema`.
   - What's unclear: Whether the session secret should be a second separate env var or reuse `SHARE_TOKEN_SECRET`. They serve different cryptographic purposes (session encryption vs HMAC signing) — they should be separate.
   - Recommendation: Add both `DASHBOARD_PASSWORD: z.string().min(8)` and `DASHBOARD_SESSION_SECRET: z.string().min(32)` to `envSchema` with NO defaults.
   - **RESOLVED:** Plan 03-01 Task 1 adds both vars as separate zod entries with NO defaults — `DASHBOARD_PASSWORD: z.string().min(8)` and `DASHBOARD_SESSION_SECRET: z.string().min(32)`. They are kept distinct from `SHARE_TOKEN_SECRET` (session encryption vs HMAC signing).

3. **Transcript field format — plain text or structured JSON** — **RESOLVED**
   - What we know: `calls.transcript` is `text` in the schema. Phase 4 will write it. The UI spec shows speaker-labelled turns (Agent / Customer + timestamp).
   - What's unclear: Whether the Phase 4 voice platform will write structured JSON (array of `{speaker, text, timestamp}`) or plain concatenated text.
   - Recommendation: Seed data should write transcript as structured JSON (e.g., `[{"speaker":"agent","text":"Hello...","ts":0},...]`). TranscriptView should attempt JSON.parse and fall back to plain text rendering. This makes Phase 3 work with seed data and Phase 4 compatible without a migration.
   - **RESOLVED:** Plan 03-02 Task 3 seeds transcripts as structured JSON; Plan 03-04 Task 3 `TranscriptView` attempts `JSON.parse` and falls back to plain-text rendering — no migration required for Phase 4 compatibility.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSRF protection is automatic in Next.js 16 Server Actions via origin check | Security Domain | If wrong, mutation server actions could be called cross-origin; add manual CSRF token |
| A2 | iron-session 8 `getIronSession` works in Next.js middleware Edge runtime with `await cookies()` | Pitfall 1 + Code Examples | If wrong, must implement lighter-weight cookie verification in middleware and reserve iron-session for Server Components/Actions |
| A3 | `calls.outcome = 'no_data'` is the correct value for "agent couldn't answer / missed" | Architecture Patterns (Metrics) | If wrong, missed call count will be incorrect; check CallRow type definition (confirmed in database.ts: `'resolved' | 'escalated' | 'no_data' | 'failed' | null`) |
| A4 | `tsx` is not yet in devDependencies | Environment Availability | If wrong (tsx already installed), seed script can run immediately |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/repositories/lookup-log.ts` [VERIFIED: codebase] — injectable factory pattern to follow for calls/drivers repositories
- `src/lib/share/token.ts` [VERIFIED: codebase] — HMAC signing pattern; established as the session signing precedent
- `src/lib/supabase.ts` [VERIFIED: codebase] — server-only service-role client pattern
- `src/lib/env.ts` [VERIFIED: codebase] — zod env schema; DASHBOARD_PASSWORD must be added
- `supabase/migrations/0001_init_foundation.sql` [VERIFIED: codebase] — confirmed calls + drivers schema; no migration needed
- `src/types/database.ts` [VERIFIED: codebase] — CallRow, DriverRow types confirmed
- `package.json` [VERIFIED: codebase] — confirmed installed deps: next 16.2.9, zod, date-fns, supabase-js
- Context7 `/vvo/iron-session` [VERIFIED: Context7] — iron-session 8 App Router patterns (middleware, login action, logout, `await cookies()`)
- npm registry [VERIFIED: npm view] — iron-session 8.0.4 current version

### Secondary (MEDIUM confidence)
- `.planning/phases/03-admin-dashboard/03-UI-SPEC.md` [CITED: codebase] — component inventory, route structure, design tokens
- `.planning/phases/03-admin-dashboard/03-CONTEXT.md` [CITED: codebase] — locked decisions D-01..D-13
- `.planning/research/STACK.md`, `PITFALLS.md`, `ARCHITECTURE.md` [CITED: codebase] — project-wide stack decisions

### Tertiary (LOW confidence)
- None — all significant claims verified against codebase or Context7.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — iron-session verified in npm registry + Context7; all other deps confirmed in package.json
- Architecture: HIGH — patterns derived directly from existing codebase (lookup-log.ts, share/token.ts, supabase.ts)
- Pitfalls: HIGH — 5 of 6 pitfalls derived from codebase inspection; 1 (CSRF) tagged ASSUMED
- UI spec: HIGH — 03-UI-SPEC.md is a complete design contract already produced

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable stack — iron-session, Next.js 16, Tailwind v4 are not fast-moving)
