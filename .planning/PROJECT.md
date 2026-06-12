# Delivery Assistance Agent

## What This Is

A delivery assistance system for Derby Aggs that lets their customers check delivery status themselves — via a web tracking portal or by phoning a voice AI agent — instead of ringing the office. It integrates with the Pall-Ex Nexus REST API for real-time consignment status, and includes an admin dashboard for the Derby Aggs team to monitor call volume, agent performance, and customer interactions. When the API can't answer a question (e.g., a live ETA), the voice agent can call one of Derby Aggs' own drivers, get the answer, and relay it to the customer.

## Core Value

A customer can find out where their delivery is — accurately, in under a minute, without a human — by web or by phone.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Customer can track a delivery on a web portal using tracking number + delivery postcode
- [ ] Portal shows delivery status, status description, estimated delivery date/time, and progress milestones in a clean mobile-first UI
- [ ] Customer can call a phone number and get the same tracking information from a voice AI agent
- [ ] Voice agent reliably captures tracking numbers and postcodes by voice, including in noisy environments
- [ ] Voice agent handles invalid details, no-result lookups, and API downtime with clear fallback paths (including human escalation)
- [ ] Voice agent can place an outbound call to a Derby Aggs driver mid-interaction to obtain a live ETA or status, and relay it to the customer
- [ ] Derby Aggs team can manage a list of drivers (name, phone number) in the admin dashboard
- [ ] Admin dashboard shows core call metrics: total calls received, answered, missed, success rate
- [ ] Admin dashboard shows call history (customer name, tracking number, date/time, duration, outcome) with date/agent/status filters and search
- [ ] Derby Aggs team can log in to the dashboard with a shared password

### Out of Scope

- Multi-carrier support — Pall-Ex only for v1; per the brief, future phase
- Proactive notifications (SMS/email status updates) — groundwork only; future automation phase
- Scheduled/automatic driver check-in calls — outbound calling is v1 only as mid-call escalation
- Per-user dashboard accounts / SSO — shared password chosen for v1; revisit if team grows or audit needs emerge
- Integration with a TMS/HR system for driver data — driver list is managed manually in the dashboard for v1

## Context

- **Client**: Derby Aggs (aggregates supplier), shipping via the Pall-Ex pallet network.
- **Pall-Ex Nexus REST API v2.2.1** — full spec held locally (`Pall-Ex Group Nexus Rest API Spec v2.2.1.pdf`, 222 pages). Key facts established:
  - Auth: `POST/Account/login` with username/password → `bearerToken` (1 hour) + `refreshToken` (24 hours). No static API key. Token refresh management is required in the backend.
  - Tracking lookup: `GET/Consignments` with `searchTerm` (matches consignment number start/end, exact customer reference, barcodes, consignmentID) or `GET/Consignments/{consignmentID}`.
  - Response provides the brief's field mapping: `consignmentNumber`, `status.name`, `estimatedDelDate`, `startWindow`/`endWindow`, `delAddressLine1`, `delAddressTown`, `delAddressPostcode`.
  - Postcode verification is performed in our backend: compare caller/user-supplied postcode against `delAddressPostcode`.
  - `include=routedetails` adds vehicle/route info (reg number, route date, status) — no driver phone numbers.
- **API credentials not yet obtained** — Pall-Ex requires special API usernames to be issued. Development proceeds against the spec with mocked responses; credential acquisition is a tracked external dependency.
- **Driver phone numbers** live in a spreadsheet/simple list today — v1 stores them in the admin dashboard.
- **Voice agent environment**: drivers and customers may call from noisy environments (cabs, yards), so transcription quality under noise is a primary selection criterion for the voice platform.
- **Success metrics from the brief**: % successful tracking queries, voice agent accuracy vs API data, reduction in manual enquiries, call success rate, portal completion rate. The dashboard must capture the data to measure these.

## Constraints

- **Dependencies**: Pall-Ex Nexus API is the single source of delivery data — its reliability and the pending credentials are external risks; the system needs graceful degradation when it's down.
- **Voice quality**: High-accuracy transcription in noisy conditions is non-negotiable — it drives the voice platform choice.
- **Cost**: Prefer the cheapest solution that meets quality requirements, for both voice platform per-minute costs and hosting.
- **Tech stack**: No existing infra constraints — recommend a sensible modern stack (researched, not assumed).
- **Timeline**: No hard deadline — phase for quality in dependency order.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Outbound driver calling in v1, as mid-call escalation only | Customer asks something the API can't answer → agent calls the driver and relays; scheduled check-ins deferred | — Pending |
| Driver list managed in admin dashboard | Numbers currently in a spreadsheet; no existing system to integrate | — Pending |
| Shared password for dashboard auth | Small internal team, minimum viable auth | — Pending |
| Voice platform decided by research (ElevenLabs vs Vapi vs Retell vs Twilio) | User leans ElevenLabs but wants best/easiest/cheapest verified, with noisy-audio transcription as the key criterion | — Pending |
| Mock Pall-Ex API during development | Credentials pending from Pall-Ex; full spec available to mock against | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-12 — Phase 1 (Foundation) complete: Pall-Ex Nexus integration layer (single-flight token lifecycle, circuit breaker), Supabase schema, MSW mock mode, and the postcode-gated tracking service are built and verified (API-01..07, 5/5 success criteria, 46 tests). User-facing requirements remain Active — they validate when the portal (Phase 2) and voice agent (Phase 4) surfaces ship.*
