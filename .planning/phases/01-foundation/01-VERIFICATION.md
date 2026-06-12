---
phase: 01-foundation
verified: 2026-06-12T11:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 01: Foundation Verification Report

**Phase Goal:** The Pall-Ex Nexus API integration is solid, fully mocked, and all dependent surfaces can build against it without credentials.
**Verified:** 2026-06-12T11:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A consignment lookup with a valid tracking number and matching postcode returns a mapped plain-language status, description, ETA, and 5-stage milestone — using the MSW mock | VERIFIED | `service.test.ts` "found + postcode match" test: result.consignment.currentStage === 'in_transit', plainStatus set, estimatedDelDate === '2026-06-12'. `handlers.test.ts` confirms MSW intercepts and returns the correct fixture. All 46 tests pass. |
| 2 | A lookup with a mismatched postcode is rejected before any status data is revealed | VERIFIED | `service.test.ts` "postcode mismatch" test asserts `mapStatusNameSpy` is NOT called and reason === 'postcode_mismatch'. In `service.ts` the `postcodesMatch` call at line 93 precedes `mapStatusName` at line 99 — confirmed by direct reading. |
| 3 | Simulated Nexus downtime (5xx, timeout) triggers the circuit breaker and returns a graceful fallback response — never a raw error | VERIFIED | `handlers.test.ts` TRIGGER-503 test fires 7 requests, confirms no throw and last result is `{ ok: false, error: 'nexus_unavailable' }`. `circuit-breaker.ts` fallback function is a pure value-returning function that never re-throws. 5 breaker unit tests cover open/timeout/half-open paths. |
| 4 | Under concurrent simulated requests, token refresh fires exactly once; no request receives a 401 due to a race condition | VERIFIED | `token-manager.test.ts` "5 concurrent getToken() calls" test: loginSpy called once, all 5 callers resolve with same token. `refreshPromise` singleton pattern confirmed in `token-manager.ts` lines 43, 102–104. |
| 5 | Every lookup (found, not found, postcode mismatch, API error) produces a log entry with outcome — queryable from the database | VERIFIED | `service.ts` calls `logLookup` on every branch (lines 72, 77, 85, 94, 113). `lookup-log.test.ts` covers all four outcome mappings plus countByOutcome aggregation. Migration applied to local Postgres — `supabase db diff` reports no schema changes (tables exist). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/env.ts` | Validated env accessor with PALLEX_MOCK boolean | VERIFIED | zod schema, `parseEnv()` exported, lazy Proxy, refine for creds-when-not-mock |
| `src/types/consignment.ts` | Raw Nexus v2.2.1 response types | VERIFIED | NexusConsignment with `delAddressPostcode: string`, `estimatedDelDate: string \| null`, NexusStatus, NexusRouteDetail |
| `src/types/tracking.ts` | Mapped tracking-result and milestone types | VERIFIED | MilestoneStage, MILESTONE_ORDER (5 stages), LookupFailureReason (4 values), TrackingResult discriminated union |
| `src/lib/nexus/token-manager.ts` | Single-flight bearer/refresh token lifecycle | VERIFIED | `refreshPromise` at line 43; BEARER_TTL 3300s; REFRESH_TTL 82800s; `createTokenManager` factory |
| `src/lib/nexus/circuit-breaker.ts` | Dependency-free circuit breaker with typed fallback | VERIFIED | State machine `closed/open/half-open`; `fallback` parameter; injectable clock; timeout via Promise race |
| `src/lib/nexus/client.ts` | `getConsignmentsBySearchTerm` — authenticated, breaker-wrapped | VERIFIED | Exported function wires token manager + breaker + zod validation; fallback returns `nexus_unavailable` |
| `src/mocks/fixtures.ts` | Spec-shaped fixtures including null-ETA | VERIFIED | FOUND_IN_TRANSIT, FOUND_DELIVERED, FOUND_NULL_ETA (estimatedDelDate: null), KNOWN_CONSIGNMENTS |
| `src/mocks/handlers.ts` | MSW handlers for /Account/login and /Consignments | VERIFIED | `http.post` login, `http.get` Consignments with searchTerm matching, TRIGGER-503 downtime trigger |
| `src/mocks/server.ts` | MSW Node.js server | VERIFIED | `setupServer(...handlers)` export |
| `supabase/migrations/0001_init_foundation.sql` | portal_lookups, calls, drivers tables + indexes | VERIFIED | All 3 tables, 4 indexes, 3 RLS enables. Applied: `supabase db diff` shows no schema drift. |
| `src/lib/supabase.ts` | Server-only service-role Supabase client | VERIFIED | "SERVER ONLY" comment, `SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false` |
| `src/lib/repositories/lookup-log.ts` | `logLookup` + `countByOutcome`, injectable | VERIFIED | `createLookupLogRepo` factory, `from('portal_lookups').insert`, all four outcome mappings, never throws |
| `src/lib/tracking/postcode.ts` | `normalisePostcode` + `postcodesMatch` | VERIFIED | Upper-case + strip whitespace; reject empties; 5 tests pass |
| `src/lib/tracking/status-map.ts` | `mapStatusName` — raw name to plain status + milestone | VERIFIED | All 5 stages mapped; At Depot alias; safe unknown fallback with console.warn; 7 tests pass |
| `src/lib/tracking/service.ts` | `lookupConsignment` — full orchestration | VERIFIED | createTrackingService factory; postcode gate before shaping; logLookup on all branches; null passthrough; 6 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/env.ts` | `process.env` | zod schema parse | WIRED | `z.object(...)` schema, `envSchema.safeParse(source)` |
| `src/lib/nexus/client.ts` | `src/lib/nexus/token-manager.ts` | `getToken()` before each request | WIRED | `getTokenManager().getToken()` at `client.ts` line 87 |
| `src/lib/nexus/client.ts` | `src/lib/nexus/circuit-breaker.ts` | breaker-wrapped fetch | WIRED | `createBreaker(nexusLookupFn, nexusUnavailableFallback, ...)` at line 125; result used as `_breaker` |
| `src/mocks/handlers.ts` | `process.env.PALLEX_BASE_URL` | `getBaseUrl()` lazy function | WIRED | `getBaseUrl()` reads `process.env.PALLEX_BASE_URL` at handler evaluation time |
| `src/lib/tracking/service.ts` | `src/lib/nexus/client.ts` | `getConsignmentsBySearchTerm` | WIRED | Default singleton imports via `import('../nexus/client')`; factory dep type `nexusLookup` |
| `src/lib/tracking/service.ts` | `src/lib/repositories/lookup-log.ts` | `logLookup` on every outcome | WIRED | Called on all 5 branches (api_error, not_found, multiple_matches, postcode_mismatch, found) |
| `src/lib/tracking/service.ts` | `src/lib/tracking/postcode.ts` | `postcodesMatch` before `mapStatusName` | WIRED | `postcodesMatch` at line 93, `mapStatusName` at line 99 — ordering confirmed |
| `src/lib/repositories/lookup-log.ts` | `portal_lookups` table | `supabase.from('portal_lookups').insert` | WIRED | Confirmed in source; table exists in live local DB |
| `src/lib/repositories/lookup-log.ts` | `src/lib/supabase.ts` | dynamic import in `getDefaultRepo()` | WIRED | `import('../supabase')` at line 135 |

---

### Data-Flow Trace (Level 4)

All artifacts that render dynamic data in this phase are service/library modules, not UI components. The tracking service returns real mapped data derived from MSW fixtures (confirmed by integration tests). The lookup repository inserts to and selects from a live Postgres table (confirmed by `supabase db diff`). No hollow-prop or disconnected data paths identified.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 46 tests pass | `npx vitest run` | 8 test files, 46 tests, 0 failures, 322ms | PASS |
| TypeScript strict mode | `npx tsc --noEmit` | Exit 0, no output | PASS |
| DB schema matches migration | `npx supabase db diff --schema public` | "No schema changes found" | PASS |
| .env files are git-ignored | `git check-ignore .env .env.local` | Both printed — confirmed ignored | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| API-01 | 01-02 | Single-flight token lifecycle (bearer 1h / refresh 24h) | SATISFIED | token-manager.ts refreshPromise; 3300s/82800s TTLs; concurrency test proves 1 login per burst |
| API-02 | 01-04 | Consignment lookup by tracking number / customer reference | SATISFIED | `getConsignmentsBySearchTerm` in client.ts; `lookupConsignment` in service.ts; MSW handlers match on consignmentNumber prefix and exact customerReference |
| API-03 | 01-04 | Postcode verified against delAddressPostcode before revealing details | SATISFIED | `postcodesMatch` called at service.ts line 93 before `mapStatusName` at line 99; test proves mapStatusName is NOT called on mismatch |
| API-04 | 01-04 | Raw status.name mapped to plain-language label + 5-stage milestone | SATISFIED | status-map.ts covers all 5 canonical stages; safe fallback for unknowns; MappedConsignment carries plainStatus, description, currentStage |
| API-05 | 01-02 | Graceful degradation on Pall-Ex downtime — never raw errors | SATISFIED | circuit-breaker.ts with closed/open/half-open; TRIGGER-503 test confirms nexus_unavailable returned, never thrown; service maps to api_error |
| API-06 | 01-01, 01-02 | Mock mode replicates Nexus spec for credential-free development | SATISFIED | MSW handlers with PALLEX_MOCK gating; FOUND_IN_TRANSIT, FOUND_DELIVERED, FOUND_NULL_ETA fixtures; TRIGGER-503 trigger; all integration tests run without real credentials |
| API-07 | 01-03 | Every lookup logged with outcome | SATISFIED | `logLookup` called on all 5 service branches; portal_lookups table exists with failure_reason + success columns; countByOutcome enables metrics |

All 7 Phase 1 requirements (API-01 through API-07) are satisfied.

---

### Anti-Patterns Found

No blockers or warnings. Observations:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/lib/nexus/token-manager.ts` line 58 | `require('../env')` in production path | Info | The production fallback path (no injected config) uses require() for lazy env access. This is intentional — matches the established lazy-singleton pattern and only runs in production. Tests never reach this path. |
| `src/lib/repositories/lookup-log.ts` | Upstash Redis env vars in `.env.local` are placeholders | Info | Noted in 01-03 SUMMARY as a known stub — real Upstash provisioning is a deployment concern. Token caching is bypassed by the injectable fake store in tests. No impact on Phase 1 goals. |

No TODO/FIXME/placeholder comments in non-test source files. No empty return values in rendering paths (this phase has no UI). No hardcoded empty data flowing to customer-visible surfaces.

---

### Human Verification Required

None. All five success criteria are verifiable programmatically and confirmed by the test suite.

---

### Gaps Summary

No gaps. All five phase success criteria are achieved:

1. MSW mock returns spec-shaped mapped results for valid tracking ref + matching postcode.
2. Postcode gate executes before status shaping — test-proven that mapStatusName is not invoked on mismatch.
3. TRIGGER-503 trips the circuit breaker; callers receive `api_error`, never a raw exception.
4. Single-flight `refreshPromise` ensures exactly one Nexus login fires under five concurrent callers.
5. `logLookup` is called on every service branch; portal_lookups table exists in the live local Postgres instance.

The integration layer is complete, mocked, tested, and structurally sound. Phases 2 and 3 can build on `lookupConsignment` and `logLookup` without Pall-Ex credentials.

---

_Verified: 2026-06-12T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
