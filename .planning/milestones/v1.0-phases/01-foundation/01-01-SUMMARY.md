---
phase: 01-foundation
plan: 01
subsystem: foundation
tags: [scaffold, types, env, vitest, nextjs]
dependency_graph:
  requires: []
  provides:
    - Next.js 15 App Router project at repo root
    - Validated env accessor with PALLEX_MOCK boolean switch (src/lib/env.ts)
    - Shared NexusConsignment + TrackingResult types (src/types/)
    - Vitest test runner configured and passing
  affects:
    - All Phase 1 plans (02, 03, 04) import from src/types and src/lib/env
tech_stack:
  added:
    - Next.js 16.x (App Router, TypeScript, Tailwind CSS, src dir)
    - "@supabase/supabase-js + @supabase/ssr (latest)"
    - "@upstash/redis (latest)"
    - "zod 3.x (runtime env + schema validation)"
    - "date-fns 3.x"
    - "msw 2.x (mock mode)"
    - "vitest + @vitest/coverage-v8 (test runner)"
  patterns:
    - Lazy proxy for module-level env export avoids test-environment parse failures
    - parseEnv(source) pure function enables direct testing without module-cache resets
    - zod .refine() at object level enforces cross-field constraint (creds required when mock=false)
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - vitest.config.ts
    - .env.example
    - .gitignore
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/lib/env.ts
    - src/lib/env.test.ts
    - src/types/consignment.ts
    - src/types/tracking.ts
    - src/types/index.ts
  modified: []
decisions:
  - "Lazy Proxy for env export: module-level eager parse failed in test environments because process.env lacks required vars; wrapping in a Proxy defers parse to first property access, keeping the exported env shape identical while unblocking tests"
  - "parseEnv(source) exported alongside env: allows tests to call with explicit objects without vi.resetModules() or dynamic imports"
  - "Tailwind 4 with @tailwindcss/postcss: create-next-app 16.x ships Tailwind 4 by default; compatible with shadcn/ui as noted in STACK.md"
metrics:
  duration_minutes: 9
  completed_date: "2026-06-11"
  tasks_completed: 3
  files_created: 13
  files_modified: 0
---

# Phase 01 Plan 01: Project Scaffold and Shared Contracts Summary

**One-liner:** Next.js 16 App Router project scaffolded with zod-validated env accessor (PALLEX_MOCK boolean switch), Nexus v2.2.1 response types, and vitest passing 8 tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold Next.js 15 app and install Phase-1 dependencies | db768a4 | package.json, tsconfig.json, next.config.ts, vitest.config.ts, .gitignore, .env.example, src/app/*, public/* |
| 2 (RED) | Add failing env tests | 3ff9151 | src/lib/env.test.ts |
| 2 (GREEN) | Create validated env accessor | d35da00 | src/lib/env.ts |
| 3 | Define shared Nexus and tracking type contracts | daba72a | src/types/consignment.ts, src/types/tracking.ts, src/types/index.ts |

## Verification Results

- `npm run build` — PASS (Next.js 16 build, 0 errors)
- `npx tsc --noEmit` — PASS (strict TypeScript, 0 errors)
- `npm test` — PASS (8/8 tests passing in vitest)
- `git check-ignore .env` — PASS (.env correctly git-ignored)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] create-next-app refused in-place scaffold due to directory name**
- **Found during:** Task 1
- **Issue:** `create-next-app` rejected the working directory name "Delivery assistant" due to npm naming restrictions (capital letters, spaces). The plan's primary command `npx create-next-app@latest .` failed with exit 1.
- **Fix:** Scaffolded into `/tmp/da-scaffold` and copied generated files (package.json, tsconfig.json, next.config.ts, eslint config, postcss config, src/app/*, public/*) to repo root, preserving existing CLAUDE.md and .planning/. Renamed project name to `delivery-assistant` in package.json.
- **Files modified:** package.json (name field)
- **Commit:** db768a4

**2. [Rule 1 - Bug] Eager module-level env parse failed in test environment**
- **Found during:** Task 2 (GREEN)
- **Issue:** `export const env = parseEnv(process.env)` at module load caused all env tests to fail with "Invalid environment" because vitest's test environment doesn't set the required process.env vars when importing the module.
- **Fix:** Replaced eager parse with a lazy `Proxy` that defers parsing to first property access. The `parseEnv(source)` pure function is exported separately for direct testing without module-cache issues.
- **Files modified:** src/lib/env.ts
- **Commit:** d35da00

**3. [Rule 3 - Deviation] Next.js version is 16.2.9 (not 15)**
- **Found during:** Task 1
- **Issue:** `npx create-next-app@latest` installed Next.js 16.2.9 (the current release as of 2026-06-11). The plan specifies "Next.js 15" but this is the version current at planning time.
- **Fix:** Accepted 16.2.9 — all compatibility verified (build passes, Tailwind 4 works, App Router unchanged). STACK.md compatibility table applies to 15+ generally.
- **Impact:** No downstream impact; Next.js 16 is a minor release on the 15 App Router foundations.

## Known Stubs

None — this plan delivers contracts and tooling only, no business logic or UI rendering.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. Verified:
- T-01-01: `.env` and `.env.local` are in `.gitignore` and confirmed git-ignored
- T-01-02: `src/lib/env.ts` reads all secrets via `process.env` only; no literals in code
- T-01-03: `PALLEX_MOCK` is an explicit enum-validated boolean; credentials required via `.refine()` when `PALLEX_MOCK=false`

## TDD Gate Compliance

- RED gate: commit `3ff9151` — `test(01-01): add failing tests for env accessor (RED)`
- GREEN gate: commit `d35da00` — `feat(01-01): create validated env accessor with config-driven mock switch`
- REFACTOR: not needed (implementation was clean on first pass)

## Self-Check

Files exist:
- src/lib/env.ts — FOUND
- src/lib/env.test.ts — FOUND
- src/types/consignment.ts — FOUND
- src/types/tracking.ts — FOUND
- src/types/index.ts — FOUND

Commits exist:
- db768a4 — FOUND
- 3ff9151 — FOUND
- d35da00 — FOUND
- daba72a — FOUND

## Self-Check: PASSED
