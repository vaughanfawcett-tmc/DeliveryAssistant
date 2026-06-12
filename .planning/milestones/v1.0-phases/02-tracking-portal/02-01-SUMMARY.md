---
phase: 02-tracking-portal
plan: 01
subsystem: portal-foundation
tags: [theme, env, testing, tailwind, vitest]
requirements: [PORT-06]

dependency_graph:
  requires:
    - "01-04: tracking service (lookupConsignment, TrackingResult)"
    - "01-01: env schema base (envSchema, Env type)"
  provides:
    - "accent CSS token (--accent / --color-accent) for all portal components"
    - "CONTACT_PHONE env field for D-11 error UI"
    - "SHARE_TOKEN_SECRET env field for D-12 share links"
    - "jsdom + @testing-library/react for Plans 02-04 component tests"
  affects:
    - "All Phase 2 component plans (consume text-accent / bg-accent utilities)"
    - "02-04 error state component (CONTACT_PHONE via env)"
    - "02-05 share token utility (SHARE_TOKEN_SECRET via env)"

tech_stack:
  added:
    - "jsdom (DOM environment for vitest)"
    - "@testing-library/react (component rendering)"
    - "@testing-library/dom (queries)"
    - "@testing-library/jest-dom (custom matchers)"
  patterns:
    - "CSS custom property + @theme inline alias for Tailwind colour token"
    - "Vitest per-file environment override via // @vitest-environment jsdom docblock"
    - "Zod env field with mock-safe default (no NEXT_PUBLIC_ prefix — server-only)"

key_files:
  created:
    - "src/test/setup-dom.ts"
  modified:
    - "src/lib/env.ts"
    - "src/app/globals.css"
    - "src/app/layout.tsx"
    - "vitest.config.ts"
    - "package.json"
    - "package-lock.json"

decisions:
  - "SHARE_TOKEN_SECRET uses .min(32) with 40-char dev default — never optional; missing secret must never silently disable HMAC signing"
  - "Global vitest environment stays 'node'; jsdom per component test file via docblock (no cross-contamination)"
  - "Accent hex #2563eb lives only in globals.css :root; all components reference text-accent / bg-accent utilities"

metrics:
  duration_seconds: 122
  completed_date: "2026-06-12"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 6
---

# Phase 2 Plan 01: Portal Foundation — Accent Token, Env Config, DOM Test Setup Summary

**One-liner:** Accent theme token wired as a single CSS variable, CONTACT_PHONE and SHARE_TOKEN_SECRET added to the zod env schema with mock-safe defaults, and jsdom + @testing-library/react installed for per-file DOM component testing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add CONTACT_PHONE and SHARE_TOKEN_SECRET to env schema | ffdcaa7 | src/lib/env.ts |
| 2 | Add accent theme token and update app shell metadata | ba63078 | src/app/globals.css, src/app/layout.tsx |
| 3 | Enable jsdom + testing-library for component tests | 16990c2 | src/test/setup-dom.ts, vitest.config.ts, package.json |

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors)
- `npx vitest run`: PASS (8 test files, 46 tests, 0 failures)
- Accent hex `#2563eb` appears exactly 1 time in globals.css (single source of truth)
- `CONTACT_PHONE` and `SHARE_TOKEN_SECRET` present in envSchema with correct zod constraints
- Global vitest environment remains `'node'`; `setupFiles` registers jest-dom matchers

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan adds infrastructure only (no data-rendering components).

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced.
All security-relevant items (SHARE_TOKEN_SECRET server-only, CONTACT_PHONE env origin) are per the plan's threat model.

## Self-Check: PASSED

- [x] `src/test/setup-dom.ts` exists and contains `@testing-library/jest-dom/vitest`
- [x] `src/lib/env.ts` contains `CONTACT_PHONE` and `SHARE_TOKEN_SECRET` with correct constraints
- [x] `src/app/globals.css` contains `--accent: #2563eb` and `--color-accent: var(--accent)`
- [x] `src/app/layout.tsx` title is "Derby Aggs — Track your delivery"
- [x] Commits ffdcaa7, ba63078, 16990c2 all present in git log
