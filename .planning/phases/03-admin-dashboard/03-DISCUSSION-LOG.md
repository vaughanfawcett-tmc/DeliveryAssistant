# Phase 3: Admin Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 03-admin-dashboard
**Areas discussed:** Empty-data strategy, Login & gating, Layout & navigation
**Area not selected (Claude's discretion):** Driver management UX

---

## Area selection

| Option | Selected |
|--------|----------|
| Empty-data strategy | ✓ |
| Login & gating | ✓ |
| Layout & navigation | ✓ |
| Driver management UX | (deferred to Claude's discretion) |

---

## Empty-data strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Seed sample call data | Dev seed + empty states | ✓ |
| Empty states only | Build against empty table | |
| Seed, no empty states | Seed only, assume present | |

**User's choice:** Seed sample call data (with empty states too).
**Notes:** The calls table is empty until Phase 4. Seed realistic sample calls/transcripts/outbound-driver rows so metrics, history, transcripts, recording playback, and the driver-call sub-log are reviewable now; also build empty states so a genuinely empty table looks intentional.

---

## Login & gating (ADMIN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Login page + session cookie | Env password, signed httpOnly cookie, middleware gating | ✓ |
| HTTP Basic auth | Browser-native popup via middleware | |
| Password prompt + token | Minimal entry + browser token | |

**User's choice:** Login page + signed httpOnly session cookie.
**Notes:** Shared password as a server-only env var; correct entry sets a signed httpOnly secure cookie; middleware redirects unauthenticated dashboard requests to login; logout + expiry supported. HMAC pattern from Phase 2 share tokens is a candidate for the cookie signature.

---

## Layout & navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-route, desktop-first | Routes + nav, desktop-first | |
| Single page, sections | One scrolling page | |
| Multi-route, mobile-first | Routes + nav, mobile-first | ✓ |

**User's choice:** Multi-route, mobile-first.
**Notes:** Distinct routes for Metrics / Call history / Drivers with a shared nav shell; mobile-first for consistency with the Phase 2 portal. Caveat captured in CONTEXT (D-08): call-history tables + transcripts must degrade gracefully on narrow screens (horizontal scroll or card layout), and remain comfortable at desktop/tablet width since staff often work at desks.

---

## Claude's Discretion

- Driver management UX (not selected): modal add/edit forms; "deactivate" = `active=false` (soft, reversible); "delete" = hard delete with confirm; E.164 phone validation.
- Metrics layout, table/card breakpoints, transcript rendering, loading states, seed volume.
- Session mechanism/library choice (must meet httpOnly + server-checked env password + all routes gated).

## Deferred Ideas

- Real call data / recording files / 30-day retention enforcement — Phase 4.
- Per-user accounts / SSO / RBAC — out of scope; shared password is v1.
- Metrics/history export (CSV) — not in scope; possible v2.
