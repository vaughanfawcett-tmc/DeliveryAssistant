---
phase: 01-foundation
plan: 03
subsystem: api
tags: [supabase, postgres, migration, rls, repository, lookup-log, tdd]

requires:
  - phase: 01-foundation-plan-01
    provides: "src/lib/env.ts (lazy Proxy env accessor), src/types/tracking.ts (LookupFailureReason)"

provides:
  - "Applied Postgres schema: portal_lookups, calls, drivers with indexes + RLS (supabase/migrations/0001_init_foundation.sql)"
  - "Server-only service-role Supabase client (src/lib/supabase.ts)"
  - "Hand-written DB row types: PortalLookupRow, CallRow, DriverRow (src/types/database.ts)"
  - "Lookup-logging repository: logLookup + countByOutcome, injectable via createLookupLogRepo (src/lib/repositories/lookup-log.ts)"

affects:
  - "Plan 04 (tracking service): calls logLookup on every lookup outcome"
  - "Phase 3 (admin dashboard): countByOutcome powers success metrics; calls/drivers tables consumed"
  - "Phase 4 (voice agent): calls table records call pipeline; drivers table drives outbound calling"

tech-stack:
  added:
    - "@supabase/supabase-js — server-side createClient with persistSession:false"
    - "supabase CLI — local Postgres stack via Docker (supabase start / db reset)"
  patterns:
    - "Injectable repository factory: createLookupLogRepo(client) for fake-client unit tests; lazy default bound to real supabase via dynamic import"
    - "Service-role client is SERVER ONLY (bypasses RLS); explicit top-of-file warning comment"
    - "logLookup never throws to caller — logging must never break a customer lookup"

key-files:
  created:
    - supabase/config.toml
    - supabase/migrations/0001_init_foundation.sql
    - src/lib/supabase.ts
    - src/types/database.ts
    - src/lib/repositories/lookup-log.ts
    - src/lib/repositories/lookup-log.test.ts
  modified: []

key-decisions:
  - "Hand-written DB types (src/types/database.ts) rather than generated types: schema is small and stable; avoids a codegen step and keeps the type surface explicit. Noted false-positive risk (types compile without live schema) — mitigated by actually applying the migration (Task 2)."
  - "logLookup default export wired via dynamic import('../supabase') inside a lazy getter: a top-level import would trigger env validation at module load and break the injected-client test pattern. The injectable factory path is env-free."
  - "Migration applied to local Supabase stack (Docker) rather than a remote project: no live Supabase project exists yet; local stack is the dev source of truth. Remote push deferred to deployment."

patterns-established:
  - "Repository factory + injected fake client for DB unit tests — no live DB required for logic coverage."

requirements-completed: [API-07]

duration: orchestrator-assisted (Docker image pull blocked autonomous run)
completed: "2026-06-12"
---

# Phase 01 Plan 03: Supabase Schema + Lookup Repository Summary

**Postgres schema (portal_lookups, calls, drivers) with indexes and RLS, applied to a local Supabase stack; a server-only service-role client; and an injectable lookup-logging repository that records every lookup outcome for success metrics (API-07).**

## Performance

- **Tasks:** 3 (Task 1 + Task 3 by executor; Task 2 migration-apply by orchestrator)
- **Completed:** 2026-06-12
- **Files created:** 6

## Accomplishments

- Migration `0001_init_foundation` defines `portal_lookups` (the API-07 outcome table), plus `calls` and `drivers` for Phases 3/4, with indexes and RLS enabled on all three tables
- Migration **applied and verified** against a live local Postgres: all three tables exist, RLS = true on each, `portal_lookups` queryable (0 rows, no missing-relation error), migration `0001` registered in `supabase_migrations.schema_migrations`
- Server-only service-role Supabase client with explicit "SERVER ONLY" warning (T-01-09)
- `logLookup` maps all four outcomes (found / not_found / postcode_mismatch / api_error) to `success` + `failure_reason` and inserts into `portal_lookups`; never throws to the caller (T-01-11)
- `countByOutcome(since)` aggregates rows into a four-key outcome map for metrics (locks the Phase 3 query surface)
- 7 new tests pass via an in-memory fake client (28 total passing across the phase)

## Task Commits

| Task | Name | Commits |
|------|------|---------|
| 1 | Supabase init, schema migration, server client, DB types | `134ef08` chore(01-03) |
| 1 | Track supabase CLI .gitignore from init | `98654d2` chore(01-03) |
| 2 | [BLOCKING] Apply migration to live DB | orchestrator-applied (`supabase db reset`) — not a code commit |
| 3 RED | Lookup-log repository failing tests | `e25fdb7` test(01-03) |
| 3 GREEN | Lookup-log repository implementation | `3ac1871` feat(01-03) |

## Files Created

- `supabase/config.toml` — local Supabase project config (from `supabase init`)
- `supabase/migrations/0001_init_foundation.sql` — portal_lookups + calls + drivers, indexes, RLS
- `src/lib/supabase.ts` — server-only service-role client
- `src/types/database.ts` — PortalLookupRow, CallRow, DriverRow
- `src/lib/repositories/lookup-log.ts` — createLookupLogRepo, logLookup, countByOutcome
- `src/lib/repositories/lookup-log.test.ts` — 7 tests: 4 outcome mappings, insert-error swallow, countByOutcome aggregation, all-zero baseline

## Decisions Made

- **Hand-written DB types** over generated types — small, stable schema; explicit surface. The false-positive risk (types compile even if the table is missing) is precisely why Task 2's migration-apply is a blocking gate, which was completed and verified.
- **Dynamic-import default repo wiring** — a top-level `import { supabase }` evaluated env validation at module load and broke the injected-client test pattern; the default repo now resolves the real client lazily, leaving the factory path env-free.
- **Local Supabase stack** as the dev database — no remote Supabase project exists yet; remote `db push` is deferred to the deployment step (Phase 4 / production).

## Deviations from Plan

### Process deviation (orchestrator-assisted)

**Task 2 ([BLOCKING] apply schema) was completed by the orchestrator, not the executor.**
- **Why:** The autonomous executor's first attempt died on a transient API connection error after ~72 minutes — the time was spent inside `supabase start` pulling large Docker images over a slow connection. The image pull, not the code, was the bottleneck.
- **How resolved:** The orchestrator ran the Docker image pull in the background to completion, then applied the migration (`supabase db reset`), wrote `.env.local` with the local stack credentials, and verified the tables/RLS/migration registration directly via the Postgres container. A second executor implemented Task 3 (pure code, injected-fake tests) in parallel with the download, deliberately leaving the SUMMARY and roadmap-complete to the orchestrator so the plan was not marked complete before the blocking schema-apply genuinely landed.
- **Impact:** None on deliverables — all three tasks' acceptance criteria are met and verified.

## Known Stubs

- Upstash Redis env vars in `.env.local` are placeholders (token caching is mocked in unit tests). Real Upstash provisioning is a deployment concern, not a Phase 1 blocker.

## Threat Flags

Verified mitigations from the plan's threat model:
- T-01-09: service-role client is server-only with explicit warning; RLS enabled on all three tables as defence-in-depth
- T-01-10: `logLookup` stores the normalised postcode passed by the caller; no name/address stored in portal_lookups
- T-01-11: every outcome is logged to portal_lookups (success criterion 5)
- T-01-12: `drivers` table is RLS-gated and never queried by customer-facing code in this phase

## Self-Check

Files exist:
- supabase/migrations/0001_init_foundation.sql — FOUND
- src/lib/supabase.ts — FOUND
- src/types/database.ts — FOUND
- src/lib/repositories/lookup-log.ts — FOUND
- src/lib/repositories/lookup-log.test.ts — FOUND

Schema applied: portal_lookups, calls, drivers exist with RLS=true; migration 0001 registered — VERIFIED
Commits exist: 134ef08, 98654d2, e25fdb7, 3ac1871 — all FOUND

## Self-Check: PASSED

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|------------|--------------|
| 3 (lookup-log repo) | `e25fdb7` test(01-03): add failing tests for lookup-log repository (RED) | `3ac1871` feat(01-03): implement lookup-log repository (GREEN) |

Task 1 is scaffolding/migration (non-TDD by design); Task 2 is an operational schema-apply. Task 3 RED/GREEN gates present and ordered correctly.

---
*Phase: 01-foundation*
*Completed: 2026-06-12*
