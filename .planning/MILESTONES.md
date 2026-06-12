# Milestones

## v1.0 MVP — Delivery Assistance Agent

**Shipped:** 2026-06-12
**Phases:** 4 | **Plans:** 18 | **Tests:** 296 passing | **Source:** ~11,480 LOC TypeScript
**Timeline:** 2026-06-11 → 2026-06-12 | **Commits:** 156
**Audit:** passed (34/34 requirements, 8/8 integration seams, 0 breaking gaps) — see `milestones/v1.0-MILESTONE-AUDIT.md`

**Delivered:** A delivery-tracking self-service product for Derby Aggs on the Pall-Ex Nexus API — customers check delivery status by web or by an AI voice agent, and staff manage everything from an admin dashboard — feature-complete against mock mode and ready for the production cutover runbook.

### Key Accomplishments

1. **Foundation (Phase 1)** — Pall-Ex Nexus integration layer with single-flight token refresh + circuit breaker, Supabase schema, MSW mock mode, and a postcode-gated tracking service that is the single source of delivery data (API-01..07).
2. **Tracking Portal (Phase 2)** — mobile-first customer lookup (tracking ref + postcode), status header + milestone stepper, time window, event history, distinct error states, and HMAC-signed share/print links that never expose the postcode (PORT-01..08).
3. **Admin Dashboard (Phase 3)** — iron-session shared-password gate, call metrics (today/7d/30d), filterable/searchable/paginated call history with transcript + recording detail, full driver CRUD, and a dev seed script (ADMIN-01..07).
4. **Voice Agent (Phase 4)** — five signed `/api/voice/*` webhook tools, a pure conversation state machine (AI disclosure + consent, NATO read-back, DTMF, 3-attempt escalation, structural never-invent-data), a consent-gated driver-escalation machine with hard limits, a swappable telephony adapter (ElevenLabs/Twilio, Retell-pivot-ready), and a 30-day retention helper (VOICE-01..08, DRIV-01..04).
5. **Cross-phase integration** — the same tracking service backs portal + voice; voice calls land in the dashboard; the managed driver list drives outbound escalation; runtime MSW makes the whole product demonstrable in mock mode.
6. **Quality** — code review fixed 6 critical + 14 warnings across Phases 3–4 (webhook verifier mismatch, replay protection, recording_url SSRF, ownership guards, DTMF injection, driver-PII masking, logout session-destroy).

### Known Deferred Items (human-action / external — by design)

Acknowledged at milestone close on 2026-06-12 (see STATE.md → Deferred Items):

| Phase | Item | Status |
|-------|------|--------|
| 02 | 02-HUMAN-UAT.md — 4 browser-verification scenarios | partial |
| 03 | 03-HUMAN-UAT.md — 6 browser-verification scenarios | partial |
| 04 | 04-HUMAN-UAT.md — production cutover (SC-5 noise go/no-go, SC-6 live Pall-Ex canary + DPAs + Pro upgrades) | partial |

Full cutover instructions: `milestones/v1.0-phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md` (or `.planning/phases/...` if phases not archived).
