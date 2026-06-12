---
phase: 01-foundation
plan: 02
subsystem: api
tags: [nexus, token-manager, circuit-breaker, msw, upstash-redis, zod, tdd]

requires:
  - phase: 01-foundation-plan-01
    provides: "src/lib/env.ts (lazy Proxy env accessor), src/types/consignment.ts (NexusConsignment type)"

provides:
  - "Single-flight bearer/refresh token lifecycle backed by injectable TokenStore (src/lib/nexus/token-manager.ts)"
  - "Dependency-free circuit breaker state machine: closed/open/half-open (src/lib/nexus/circuit-breaker.ts)"
  - "getConsignmentsBySearchTerm — authenticated, breaker-wrapped, zod-validated Nexus lookup (src/lib/nexus/client.ts)"
  - "Upstash Redis TokenStore adapter with lazy init (src/lib/redis.ts)"
  - "MSW 2.x handlers replicating Nexus v2.2.1 including null-ETA and 503 trigger (src/mocks/)"

affects:
  - "Plan 03 (database): no overlap — parallel plan"
  - "Plan 04 (tracking service): imports getConsignmentsBySearchTerm from src/lib/nexus/client.ts"
  - "Phase 2 (tracking portal): all web lookups flow through this client"
  - "Phase 4 (voice agent): voice tool endpoint uses same client singleton"

tech-stack:
  added:
    - "msw 2.x — http factory (not rest), setupServer from msw/node"
    - "zod — response validation schema for Nexus consignment array"
    - "@upstash/redis — lazy singleton via getRedisClient()"
  patterns:
    - "Lazy singleton init pattern: module-level `let _x: T | undefined` + getter function avoids env parse at import time"
    - "Dependency injection via factory: createTokenManager(store, httpPost, config) enables full unit-test isolation without network or env"
    - "Discriminated result type: NexusLookupResult {ok:true|false} — callers never see raw errors"
    - "Circuit breaker as pure state machine with injectable clock for deterministic fake-timer tests"
    - "Single-flight refreshPromise: concurrent getToken() callers join one in-flight promise"

key-files:
  created:
    - src/lib/redis.ts
    - src/lib/nexus/token-manager.ts
    - src/lib/nexus/token-manager.test.ts
    - src/lib/nexus/circuit-breaker.ts
    - src/lib/nexus/circuit-breaker.test.ts
    - src/lib/nexus/client.ts
    - src/mocks/fixtures.ts
    - src/mocks/handlers.ts
    - src/mocks/server.ts
    - src/mocks/handlers.test.ts
  modified: []

key-decisions:
  - "No opossum: circuit-breaker.ts is a self-contained state machine (no CommonJS dependency, Edge-compatible). ARCHITECTURE.md suggests opossum but PLAN library_notes explicitly prohibits it."
  - "Injectable TokenManagerConfig: env access is factored into a config object passed to createTokenManager(), so unit tests inject a fake config and never trigger env parsing — avoids vi.mock(env) complexity."
  - "TokenStore interface in redis.ts: thin adapter wrapping Upstash client; token manager depends on the interface, not the concrete Redis client — enables in-memory fake stores in tests."
  - "env imported directly in client.ts (not via require()): the env Proxy safely defers property access to call time; require() in vitest ESM context caused silent failures that returned nexus_unavailable."
  - "__resetSingletonsForTest(tokenStore?) in client.ts: allows tests to inject a fake store and get a fresh breaker without module cache resets."

patterns-established:
  - "Lazy singleton: `let _x | undefined; function getX() { if (!_x) _x = init(); return _x; }` — used for token manager, breaker, Redis client. Safe at module load, no env access until first call."
  - "TDD RED-GREEN per task: failing test committed first, then implementation committed separately."

requirements-completed: [API-01, API-05, API-06]

duration: 12min
completed: "2026-06-11"
---

# Phase 01 Plan 02: Pall-Ex Nexus API Client Summary

**Single-flight JWT token lifecycle (55m/23h Upstash Redis), dependency-free circuit breaker (closed/open/half-open), and MSW 2.x mock replicating Nexus v2.2.1 including null-ETA and 503 downtime trigger — all wired into one typed `getConsignmentsBySearchTerm` function.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-11T20:05:38Z
- **Completed:** 2026-06-11T20:17:39Z
- **Tasks:** 3 (each with RED + GREEN commits)
- **Files created:** 10

## Accomplishments

- Token manager with single-flight `refreshPromise` guarantees exactly one login under concurrent callers; bearer cached 55m, refresh cached 23h in Upstash Redis (API-01, T-01-05)
- Dependency-free circuit breaker opens on threshold, returns typed fallback without calling the wrapped function, recovers via half-open after `resetTimeoutMs` (API-05, T-01-06)
- MSW 2.x handlers replicate `/Account/login` and `/Consignments` responses including the critical null-ETA edge case and a TRIGGER-503 downtime trigger (API-06)
- Client exports a single `getConsignmentsBySearchTerm(searchTerm): Promise<NexusLookupResult>` that is authenticated, breaker-wrapped, zod-validated, and never throws to callers (T-01-07)
- 13 new tests pass across token-manager, circuit-breaker, and handlers integration suites (21 total passing)

## Task Commits

| Task | Name | Commits |
|------|------|---------|
| 1 RED | Token manager failing tests | `9650c25` test(01-02) |
| 1 GREEN | Single-flight token lifecycle manager | `6c85e02` feat(01-02) |
| 2 RED | Circuit breaker failing tests | `8e580bc` test(01-02) |
| 2 GREEN | Circuit breaker implementation | `2826681` feat(01-02) |
| 3 RED | MSW handlers failing integration tests | `dcbbed1` test(01-02) |
| 3 GREEN | MSW mock + Nexus client | `5798a55` feat(01-02) |

## Files Created

- `src/lib/redis.ts` — Lazy Upstash Redis singleton + TokenStore interface and adapter
- `src/lib/nexus/token-manager.ts` — Single-flight getToken(); createTokenManager() factory with DI
- `src/lib/nexus/token-manager.test.ts` — 4 unit tests: concurrency, cache hit, login-on-miss, TTLs
- `src/lib/nexus/circuit-breaker.ts` — Dependency-free state machine breaker with injectable clock
- `src/lib/nexus/circuit-breaker.test.ts` — 5 unit tests: passthrough, open, failure count, timeout, half-open
- `src/lib/nexus/client.ts` — `getConsignmentsBySearchTerm` + zod validation + singleton management
- `src/mocks/fixtures.ts` — FOUND_IN_TRANSIT, FOUND_DELIVERED, FOUND_NULL_ETA, KNOWN_CONSIGNMENTS
- `src/mocks/handlers.ts` — MSW 2.x handlers: login + Consignments + TRIGGER-503
- `src/mocks/server.ts` — `setupServer(...handlers)` export for integration tests
- `src/mocks/handlers.test.ts` — 4 integration tests: found, not_found, null-ETA, 503 never-throws

## Decisions Made

- **No opossum**: the plan's library_notes explicitly prohibit it (CommonJS, breaks Edge runtime). Implemented a self-contained state machine in `circuit-breaker.ts` that is portable and fully unit-testable with vitest fake timers.
- **Injectable TokenManagerConfig**: factoring env access into a config object (closures over env) keeps the factory testable — test passes a fake config, never triggers env parsing. Simpler than `vi.mock()` or module cache resets.
- **Direct `env` import in client.ts (not `require`)**: the lazy Proxy in `env.ts` defers all property access to call time, so a top-level `import { env } from '../env'` is safe. Using `require('../env')` inside closures in vitest's ESM environment caused the Proxy not to return the configured test values, resulting in every lookup returning `nexus_unavailable`.
- **`__resetSingletonsForTest(tokenStore?)` in client.ts**: injection point for tests to swap in an in-memory store and get a fresh circuit breaker without module isolation overhead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] TokenManagerConfig injectable config object added**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** The plan specifies `createTokenManager(store: TokenStore, httpPost: typeof fetch)`. In tests, `httpPost` is a spy that never reads env. But `login()` still accessed `env.PALLEX_BASE_URL` before calling `httpPost`, causing env parse errors in tests.
- **Fix:** Added optional `config?: TokenManagerConfig` parameter to `createTokenManager`. Tests pass a fake config object; production uses the default path which reads from env lazily. The exported signature is a superset of the spec.
- **Files modified:** `src/lib/nexus/token-manager.ts`, `src/lib/nexus/token-manager.test.ts`
- **Verification:** 4 token-manager tests pass without env vars set.
- **Committed in:** `6c85e02`

**2. [Rule 1 - Bug] `require('../env')` in client.ts closures silently returned wrong values**
- **Found during:** Task 3 (GREEN phase, debugging nexus_unavailable on all lookups)
- **Issue:** `getTokenManagerConfig()` used `require('../env')` inside closures for lazy env access. In vitest's ESM environment, these `require` calls did not pick up the test-configured `process.env` values, causing every `getToken()` call to fail and trip the breaker.
- **Fix:** Removed `getTokenManagerConfig()` + `require` pattern. Import `env` directly at module top — the existing lazy Proxy defers all property access to call time, making top-level import safe.
- **Files modified:** `src/lib/nexus/client.ts`
- **Verification:** All 4 integration tests pass after fix; no `nexus_unavailable` on valid consignments.
- **Committed in:** `5798a55`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes required for correctness. Exported API surface is a strict superset of plan spec.

## Known Stubs

None — all three components deliver real behavior backed by MSW mocks.

## Threat Flags

No new threat surface beyond the plan's threat model. Verified mitigations:
- T-01-04: `login()` never logs credentials or token values (no console.log in critical paths)
- T-01-05: `refreshPromise` singleton guarantees one in-flight login under concurrency
- T-01-06: circuit breaker returns fallback without calling `fn` when open; never re-throws
- T-01-07: zod validates Nexus response array before returning to callers

## Self-Check

Files exist:
- src/lib/redis.ts — FOUND
- src/lib/nexus/token-manager.ts — FOUND
- src/lib/nexus/circuit-breaker.ts — FOUND
- src/lib/nexus/client.ts — FOUND
- src/mocks/fixtures.ts — FOUND
- src/mocks/handlers.ts — FOUND
- src/mocks/server.ts — FOUND

Commits exist: 9650c25, 6c85e02, 8e580bc, 2826681, dcbbed1, 5798a55 — all FOUND

## Self-Check: PASSED

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|------------|--------------|
| 1 (token-manager) | `9650c25` test(01-02): add failing tests for token manager (RED) | `6c85e02` feat(01-02): implement single-flight token lifecycle manager (GREEN) |
| 2 (circuit-breaker) | `8e580bc` test(01-02): add failing tests for circuit breaker (RED) | `2826681` feat(01-02): implement dependency-free circuit breaker with typed fallback (GREEN) |
| 3 (MSW + client) | `dcbbed1` test(01-02): add failing integration tests for MSW handlers + Nexus client (RED) | `5798a55` feat(01-02): implement MSW mock + Nexus client lookup function (GREEN) |

All RED/GREEN gate commits present and ordered correctly.

---
*Phase: 01-foundation*
*Completed: 2026-06-11*
