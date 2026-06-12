# Phase 3: Admin Dashboard - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The staff-facing admin dashboard: shared-password login gating all pages; a metrics summary (calls received/answered/missed/success rate over today/7d/30d); a filterable, searchable call-history log with per-call transcript and recording playback; full driver CRUD (the list the Phase 4 voice agent will call for outbound escalation); and an outbound driver-call sub-log linked to its parent customer call.

**In scope:** ADMIN-01..07.

**Out of scope:** the voice agent itself and real call data (Phase 4 — this phase reads the `calls` table and seeds sample data), live Pall-Ex credentials, per-user accounts/SSO (shared password is the v1 decision), v2 deferrals.

**Key sequencing reality:** the `calls` table is populated by the Phase 4 voice pipeline, so it is EMPTY during Phase 3 development. Driver CRUD (ADMIN-06) operates on real data immediately and is the hard prerequisite that places Phase 3 before Phase 4.
</domain>

<decisions>
## Implementation Decisions

### Empty-data strategy
- **D-01:** Add a **dev-only seed script** that inserts realistic sample data into `calls` (inbound customer calls with transcripts, outcomes, durations, masked-able `from_number`, plus some outbound `call_type='driver'` rows with `parent_call_id` set) so metrics, history, transcript views, recording playback, and the driver-call sub-log are all fully reviewable and testable now. Seed data is clearly marked/identifiable and is replaced by real calls in Phase 4.
- **D-02:** Also build **polished empty states** for every data surface (metrics, history, transcript, sub-log) so the dashboard reads correctly when the table is genuinely empty (e.g. fresh Phase 4 production before any calls). Both seed AND empty states — the dashboard must never look broken.
- **D-03:** Recording playback (ADMIN-05) UI is built now with a seed placeholder reference (e.g. a sample/stub audio URL or a "recording unavailable" state); real recording files and the 30-day retention mechanism arrive with Phase 4. The playback component and the 30-day-retention expectation are designed now.

### Login & gating (ADMIN-01)
- **D-04:** A **login page + signed httpOnly session cookie**. The shared password is stored as an **env var** (server-side only, never shipped to the client) and checked server-side; a correct entry sets a signed, httpOnly, secure session cookie.
- **D-05:** **Middleware** redirects any unauthenticated request for a dashboard route to the login page — all dashboard pages are gated (no page renders its data without a valid session). Includes a logout action and a session expiry.
- **D-06:** The session cookie is signed/verified server-side (reuse the HMAC approach established for share tokens in Phase 2 if it fits, or Next.js session conventions) — the secret is an env var, server-only.

### Layout & navigation
- **D-07:** **Multi-route** dashboard with a shared nav/shell: distinct routes for **Metrics (overview)**, **Call history**, and **Drivers**. (Login is its own route outside the authed shell.)
- **D-08:** **Mobile-first responsive** (consistency with the Phase 2 portal), but the call-history table and transcript views MUST degrade gracefully on narrow screens — horizontal scroll or a card/stacked layout for table rows rather than a clipped table. Staff often work at desks, so the desktop/tablet width should feel comfortable too.
- **D-09:** Reuse the Phase 2 visual system — the single accent CSS token (`--accent`), Tailwind utilities (`bg-accent`/`text-accent`), and the same neutral base — so portal and dashboard feel like one product.

### Driver management UX (Claude's discretion — defaults below)
- **D-10:** Add/edit drivers via **modal forms**; **"deactivate"** = set the existing `active` boolean to false (soft, reversible — keeps history intact and is what the Phase 4 outbound-call query should respect); **"delete"** = hard delete behind a confirm step. Phone numbers validated as **E.164**. Driver changes are immediately reflected in the list the voice agent reads (ADMIN-06).

### Data surfaces (from existing schema — no migration needed)
- **D-11:** Metrics (ADMIN-02): derive received/answered/missed/success(containment) from the `calls` table over today/7d/30d windows. "Success/containment" = resolved without human escalation (outcome `resolved` vs `escalated`/`failed`).
- **D-12:** Call history (ADMIN-03): list inbound customer calls (date/time, duration, tracking ref, outcome, **masked** `from_number`) with date-range + outcome filters and tracking-reference search. Each row opens a detail view with full **transcript** (speaker-labelled — ADMIN-04) and **recording** playback (ADMIN-05).
- **D-13:** Driver-call sub-log (ADMIN-07): on a customer call's detail, show linked outbound `call_type='driver'` rows (via `parent_call_id`) with driver, duration, outcome.

### Claude's Discretion
- Exact metrics layout (cards vs compact stat row), table vs card breakpoints, transcript rendering style, loading/skeleton states, seed-data volume and content — Claude's discretion within the decisions above.
- Session library/mechanism choice (Next.js middleware + signed cookie vs a lightweight session lib) — research/planning decision; must meet D-04..D-06 (httpOnly, server-checked env password, all routes gated).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ADMIN-01..07 and the v1 requirement set.
- `.planning/ROADMAP.md` §"Phase 3: Admin Dashboard" — goal + 5 success criteria.

### Existing schema & backend (Phase 1)
- `supabase/migrations/0001_init_foundation.sql` — the `calls` table (with `parent_call_id`, `transcript`, `from_number`, `call_type`, `direction`, `outcome`, `disconnection_reason`) and the `drivers` table (`name`, `phone_e164` UNIQUE, `active`). No migration needed for Phase 3; both tables already exist with RLS.
- `src/lib/supabase.ts` — server-only service-role client (all dashboard data access goes through this).
- `src/types/database.ts` — `CallRow`, `DriverRow` row types.
- `src/lib/repositories/lookup-log.ts` — the repository + injectable-factory pattern to follow for new `calls`/`drivers` repositories.

### Phase 2 (visual + auth patterns to reuse)
- `src/app/globals.css` — the accent token and neutral base.
- `src/lib/share/token.ts` — HMAC signing/verification pattern (candidate basis for the session cookie signature, D-06).
- `.planning/phases/02-tracking-portal/02-CONTEXT.md` — the established theming/server-action conventions.

### Research
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md` — data model, known traps (PII/driver-number handling, instrumentation), stack conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`calls` + `drivers` tables** already exist (Phase 1) with exactly the columns Phase 3 needs — including `parent_call_id` (self-ref for ADMIN-07) and `active` (soft-deactivate for ADMIN-06). No schema migration required.
- **`src/lib/supabase.ts`** server-only client + the **`src/lib/repositories/` factory pattern** (`createLookupLogRepo`) — new `calls` and `drivers` repositories follow the same injectable shape (testable with a fake client, no live DB for unit tests).
- **`src/types/database.ts`** — `CallRow`, `DriverRow` already defined.
- **Phase 2 visual system** — accent token, Tailwind setup, neutral base; reuse for a consistent product feel (D-09).
- **`src/lib/share/token.ts`** — HMAC pattern reusable for the signed session cookie (D-06).

### Established Patterns
- Next.js 16 App Router, `src/` dir, TypeScript, Tailwind. Server-only data access is the norm (service-role client must never reach a client bundle — `server-only` guard established in Phase 1).
- Server actions / Server Components for data; client components only where interactivity is needed (driver modals, filters).
- The Phase 1 code-review lesson: anything reading the service-role client or a secret env var stays server-side with the `server-only` import.

### Integration Points
- New: an auth route + middleware gating `/dashboard/*` (or equivalent); metrics/history/drivers routes; `calls` + `drivers` repositories; a dev seed script; recording-playback + transcript components; driver modal forms.
- **Driver list is the contract Phase 4 consumes** — the `active` flag semantics decided here (D-10) directly drive the Phase 4 outbound-call eligibility query.
- **21st.dev Magic MCP** (user's preferred UI builder) is available for scaffolding dashboard components — note its API key is still a placeholder.

</code_context>

<specifics>
## Specific Ideas

- Dashboard and portal should feel like one product (shared accent/theme).
- Staff must be able to actually see metrics/history/transcripts working in this phase — hence seed data — not wait until Phase 4.
- "Deactivate" is reversible and preserves history; "delete" is the hard, confirmed action. The Phase 4 outbound query respects `active`.
- Every data surface has a real empty state so a fresh production deploy (no calls yet) looks intentional, not broken.

</specifics>

<deferred>
## Deferred Ideas

- Real call data, real recording files, and the 30-day retention enforcement mechanism — arrive with the Phase 4 voice pipeline; Phase 3 seeds samples and builds the UI/retention expectation.
- Per-user staff accounts / SSO / role-based access — explicitly out of scope; shared password is the v1 decision. Revisit if the team grows or audit needs emerge.
- Exporting metrics/history (CSV etc.) — not in ADMIN-01..07; note as a possible v2 item, do not build.

None of the above changes Phase 3 scope.

</deferred>

---

*Phase: 03-admin-dashboard*
*Context gathered: 2026-06-12*
