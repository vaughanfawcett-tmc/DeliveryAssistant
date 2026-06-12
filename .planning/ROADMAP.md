# Roadmap: Delivery Assistance Agent

**Project:** Delivery Assistance Agent — Derby Aggs / Pall-Ex
**Core Value:** A customer can find out where their delivery is — accurately, in under a minute, without a human — by web or by phone.
**Created:** 2026-06-11
**Granularity:** Coarse (4 phases)

---

## Phases

- [ ] **Phase 1: Foundation** — Pall-Ex API integration layer, database schema, and mock mode
- [ ] **Phase 2: Tracking Portal** — Customer-facing web delivery status lookup
- [ ] **Phase 3: Admin Dashboard** — Staff login, call metrics, history, transcripts, and driver CRUD
- [ ] **Phase 4: Voice Agent + Production** — Inbound AI agent, outbound driver escalation, live credentials

---

## Phase Details

### Phase 1: Foundation
**Goal**: The Pall-Ex Nexus API integration is solid, fully mocked, and all dependent surfaces can build against it without credentials
**Depends on**: Nothing
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07
**Success Criteria** (what must be TRUE):
  1. A consignment lookup with a valid tracking number and matching postcode returns a mapped plain-language status, description, ETA, and 5-stage milestone — using the MSW mock
  2. A lookup with a mismatched postcode is rejected before any status data is revealed
  3. Simulated Nexus downtime (5xx, timeout) triggers the circuit breaker and returns a graceful fallback response — never a raw error
  4. Under concurrent simulated requests, token refresh fires exactly once; no request receives a 401 due to a race condition
  5. Every lookup (found, not found, postcode mismatch, API error) produces a log entry with outcome — queryable from the database
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 15 app, shared types, validated env + mock switch (API-06)
- [x] 01-02-PLAN.md — Nexus client: single-flight token lifecycle, circuit breaker, MSW mock (API-01, API-05, API-06)
- [x] 01-03-PLAN.md — Supabase schema (portal_lookups/calls/drivers) + lookup-logging repository (API-07)
- [x] 01-04-PLAN.md — Tracking service: lookup + postcode gate + status mapping + outcome logging (API-02, API-03, API-04)

### Phase 2: Tracking Portal
**Goal**: A customer can look up their delivery status on a mobile phone using a tracking number and postcode, and see all relevant delivery information with clear handling of every error state
**Depends on**: Phase 1
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-07, PORT-08
**Success Criteria** (what must be TRUE):
  1. A customer on a 375px viewport can submit their tracking number and postcode and see current status, ETA, and milestone timeline above the fold — with no sensitive data in the URL
  2. When a consignment is out for delivery, the portal shows the delivery time window (e.g., "between 09:00 and 11:00")
  3. The portal shows the full scan/event history in reverse-chronological order
  4. Each distinct error state (not found, postcode mismatch, multiple matches, API unavailable) shows a specific, helpful message rather than a generic error
  5. A customer can share or print a status page via a signed link that does not expose their postcode
**Plans**: 4 plans
Plans:
- [ ] 02-01-PLAN.md — Portal foundation: swappable accent token, CONTACT_PHONE + SHARE_TOKEN_SECRET env, responsive shell, jsdom test infra (PORT-06)
- [ ] 02-02-PLAN.md — TDD: signed share-token codec + share-lookup (postcode-gate-free) + multiple-match candidate surfacing (PORT-05, PORT-08)
- [ ] 02-03-PLAN.md — Result + error components: status/stepper/time-window/history/vehicle + distinct error states & chooser (PORT-02, PORT-03, PORT-04, PORT-05, PORT-07)
- [ ] 02-04-PLAN.md — Wiring: POST server action, lookup form, signed share route, ShareBar, print stylesheet (PORT-01, PORT-06, PORT-08)
**UI hint**: yes

### Phase 3: Admin Dashboard
**Goal**: Derby Aggs staff can log in, see call metrics and history, review transcripts and recordings, and manage the driver contact list that the voice agent will use for outbound calls
**Depends on**: Phase 1
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07
**Success Criteria** (what must be TRUE):
  1. A staff member can log in with the shared password and all dashboard pages are inaccessible without it
  2. The metrics summary shows total calls received, answered, missed, and success/containment rate for today, 7 days, and 30 days
  3. The call history log can be filtered by date range, outcome, and searched by tracking reference — and each record is viewable with full transcript and call recording
  4. A staff member can add, edit, deactivate, and delete a driver (name and phone number) and the change is immediately reflected in the driver list used for outbound calls
  5. The outbound driver call sub-log is linked to the parent customer call and shows driver, duration, and outcome
**Plans**: TBD
**UI hint**: yes

### Phase 4: Voice Agent + Production
**Goal**: A customer can call a UK number, speak naturally to an AI agent that accurately captures their tracking details and reads back delivery status — and when the API cannot answer, the agent contacts a driver, relays the answer, and hands off to a human if needed — with all compliance gates met and live Pall-Ex credentials active
**Depends on**: Phase 1, Phase 3
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07, VOICE-08, DRIV-01, DRIV-02, DRIV-03, DRIV-04
**Success Criteria** (what must be TRUE):
  1. A caller is greeted with an AI disclosure and recording consent announcement before any data is collected, and can provide their tracking number and postcode by speaking (with NATO phonetic read-back confirmation) or by keypad entry
  2. After 3 failed capture attempts the call is transferred to a human with a warm-handoff summary; a caller can also request a human at any time by pressing 0 or saying "agent"
  3. The agent reads back only information present in the API response — it never invents a status, date, or ETA — and on API downtime it explains the problem and offers human transfer rather than stalling
  4. When the API cannot provide a live ETA, the agent offers to contact the driver; after the customer agrees to hold, the agent calls the driver, receives the ETA, and relays it back — with hard limits on call duration, retries, and a logged outcome for every attempt
  5. Real-world noisy-environment audio (lorry cab / haulage yard) has been tested and STT accuracy is acceptable — or the platform has been switched to Retell AI — before live calls are accepted
  6. Live Pall-Ex credentials have passed a canary test and the system is running against the live Nexus API with all compliance steps complete (DPAs signed, transcript retention TTL set, Vercel Pro and Supabase Pro active)
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/4 | Planned | - |
| 2. Tracking Portal | 0/4 | Planned | - |
| 3. Admin Dashboard | 0/? | Not started | - |
| 4. Voice Agent + Production | 0/? | Not started | - |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 1 | Pending |
| API-05 | Phase 1 | Pending |
| API-06 | Phase 1 | Pending |
| API-07 | Phase 1 | Pending |
| PORT-01 | Phase 2 | Pending |
| PORT-02 | Phase 2 | Pending |
| PORT-03 | Phase 2 | Pending |
| PORT-04 | Phase 2 | Pending |
| PORT-05 | Phase 2 | Pending |
| PORT-06 | Phase 2 | Pending |
| PORT-07 | Phase 2 | Pending |
| PORT-08 | Phase 2 | Pending |
| ADMIN-01 | Phase 3 | Pending |
| ADMIN-02 | Phase 3 | Pending |
| ADMIN-03 | Phase 3 | Pending |
| ADMIN-04 | Phase 3 | Pending |
| ADMIN-05 | Phase 3 | Pending |
| ADMIN-06 | Phase 3 | Pending |
| ADMIN-07 | Phase 3 | Pending |
| VOICE-01 | Phase 4 | Pending |
| VOICE-02 | Phase 4 | Pending |
| VOICE-03 | Phase 4 | Pending |
| VOICE-04 | Phase 4 | Pending |
| VOICE-05 | Phase 4 | Pending |
| VOICE-06 | Phase 4 | Pending |
| VOICE-07 | Phase 4 | Pending |
| VOICE-08 | Phase 4 | Pending |
| DRIV-01 | Phase 4 | Pending |
| DRIV-02 | Phase 4 | Pending |
| DRIV-03 | Phase 4 | Pending |
| DRIV-04 | Phase 4 | Pending |

**Total v1 requirements:** 34
**Mapped:** 34/34
**Unmapped:** 0

---
*Created: 2026-06-11*
