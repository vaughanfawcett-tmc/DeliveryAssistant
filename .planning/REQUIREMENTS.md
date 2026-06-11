# Requirements: Delivery Assistance Agent

**Defined:** 2026-06-11
**Core Value:** A customer can find out where their delivery is — accurately, in under a minute, without a human — by web or by phone.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Pall-Ex API Integration

- [ ] **API-01**: System authenticates with the Pall-Ex Nexus API and manages the token lifecycle automatically (bearer 1h / refresh 24h, single-flight refresh — no expired-token failures under concurrent calls)
- [ ] **API-02**: System can look up a consignment by tracking number / customer reference via `GET/Consignments` searchTerm
- [ ] **API-03**: System verifies the user-supplied postcode against `delAddressPostcode` before revealing delivery details
- [ ] **API-04**: System maps raw `status.name` values to a plain-language status, description, and a 5-stage milestone (Booked → At Hub → In Transit → Out for Delivery → Delivered)
- [ ] **API-05**: System degrades gracefully on Pall-Ex API downtime (timeouts, circuit breaker, channel-appropriate fallback messages — never raw errors)
- [ ] **API-06**: System has a mock mode replicating the Nexus spec so all development works before real credentials arrive
- [ ] **API-07**: Every tracking lookup is logged with its outcome (found / not found / postcode mismatch / API error) to power success metrics

### Tracking Portal

- [ ] **PORT-01**: Customer can look up a delivery with tracking number + delivery postcode (submitted via POST — no tracking data in URLs)
- [ ] **PORT-02**: Portal shows current status, plain-language description, estimated delivery date, and a visual milestone timeline
- [ ] **PORT-03**: Portal shows the delivery time window ("between 09:00–11:00") when the consignment is out for delivery
- [ ] **PORT-04**: Portal shows the full event/scan history in reverse-chronological order
- [ ] **PORT-05**: Portal handles error states distinctly: not found, postcode mismatch, multiple matches (user picks from list), and API unavailable
- [ ] **PORT-06**: Portal is mobile-first responsive (status + ETA above the fold on a 375px viewport)
- [ ] **PORT-07**: Portal shows vehicle/route details (reg number, route status) when available from the API
- [ ] **PORT-08**: Customer can print or share the status page via a short-lived signed link (no postcode exposed)

### Voice Agent

- [ ] **VOICE-01**: Customer can call a UK phone number and is greeted by an AI agent that discloses it is automated and announces call recording
- [ ] **VOICE-02**: Agent captures tracking number and postcode by voice with chunked read-back confirmation (NATO phonetics for letters)
- [ ] **VOICE-03**: Caller can enter their reference via keypad (DTMF) as a fallback, terminated with `#`
- [ ] **VOICE-04**: Agent answers in plain spoken English, leading with what the caller wants ("Yes, it was delivered" / "expected between nine and eleven")
- [ ] **VOICE-05**: After 3 failed capture attempts the agent escalates to a human instead of looping
- [ ] **VOICE-06**: Caller can reach a human at any time (press 0 / say "agent"); transfer includes a warm-handoff summary of the call so far
- [ ] **VOICE-07**: On API downtime the agent explains the issue and offers human transfer — it never stalls or guesses
- [ ] **VOICE-08**: Agent only states delivery information returned by the API — never invents statuses, dates, or ETAs

### Driver Escalation

- [ ] **DRIV-01**: When the API can't answer the caller's question (e.g., live ETA), the agent offers to contact the driver
- [ ] **DRIV-02**: Agent places an outbound call to the relevant driver from the managed driver list and asks for the ETA/status
- [ ] **DRIV-03**: The driver's answer is relayed back to the waiting customer (hold with check-ins, or callback if the driver is unreachable)
- [ ] **DRIV-04**: Outbound driver calls have hard limits (max duration, max retries) and every attempt is logged

### Admin Dashboard

- [ ] **ADMIN-01**: Derby Aggs team can log in with a shared password; all dashboard pages are gated behind it
- [ ] **ADMIN-02**: Dashboard shows call metrics — total received, answered, missed, and success/containment rate — for today / 7 days / 30 days
- [ ] **ADMIN-03**: Dashboard shows a call history log (date/time, duration, tracking reference, outcome, masked caller number) with date and outcome filters plus reference search
- [ ] **ADMIN-04**: Team can view the full transcript of any call with speaker labels
- [ ] **ADMIN-05**: Team can play back call recordings (30-day retention)
- [ ] **ADMIN-06**: Team can add, edit, deactivate, and delete drivers (name, phone number) used for outbound calls
- [ ] **ADMIN-07**: Dashboard shows an outbound driver-call log linked to the parent customer call (driver, duration, outcome)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Admin Analytics

- **ANLYT-01**: Failed-lookup report (references searched with no result, for data-quality analysis)
- **ANLYT-02**: API health indicator (rolling Nexus error rate, amber/red thresholds)
- **ANLYT-03**: Escalation reason breakdown (repeated failure / caller request / API down)

### Notifications & Automation

- **NOTF-01**: Proactive SMS/email status notifications with consent management
- **NOTF-02**: Scheduled automated driver check-in calls

### Platform

- **PLAT-01**: Multi-carrier support beyond Pall-Ex
- **PLAT-02**: Per-user dashboard accounts with roles / SSO
- **PLAT-03**: PWA install prompt for repeat trade customers

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live map of lorry location | Nexus API has no GPS; an approximated map erodes trust — show vehicle reg + route status instead |
| Multi-level IVR menus ("press 1 for…") | Defeats conversational AI for a single-intent line; callers speak naturally |
| "Safe place" delivery instructions | Pallet freight requires a person present; not applicable to this network |
| SMS/email summary after call | Mid-call contact capture + GDPR consent complexity not warranted for v1 |
| Voicemail / callback queue | Requires callback orchestration and staff workflow; escalate-in-hours only |
| Customer accounts / saved shipments on portal | B2B buyers have their references; stateless lookup is faster |
| Call sentiment analysis / NPS scoring | Containment rate is a better proxy at this scale |
| Real-time live-call listening | GDPR/consent complexity; transcripts + recordings suffice |
| TMS/HR integration for driver data | No existing system; managed list in dashboard is the v1 decision |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

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

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-06-11*
*Last updated: 2026-06-11 after roadmap creation*
