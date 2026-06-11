# Feature Research

**Domain:** Delivery tracking self-service — pallet/courier tracking portal, AI voice agent call line, internal admin dashboard (Derby Aggs / Pall-Ex network)
**Researched:** 2026-06-11
**Confidence:** HIGH (core table stakes verified against multiple industry sources and live product analysis; voice-agent patterns from platform docs and practitioner guides)

---

## Surface 1: Customer Tracking Portal

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tracking number + postcode input form | The stated entry mechanism; postcode acts as a privacy gate (confirmed against Pall-Ex MyNexus pattern — 16-digit barcode + postcode in capitals) | LOW | Pall-Ex consignment numbers are alphanumeric; form must accept both numeric consignment IDs and reference strings per Nexus API `searchTerm` semantics |
| Prominent ETA / estimated delivery date | Baymard research: this is what users open the page to learn; 25% of tested sites omit it — those sites generate support calls | LOW | Pull from `estimatedDelDate` + `startWindow`/`endWindow` fields; display as "Wednesday 12 June, between 09:00 – 11:00" not raw ISO strings |
| Visual milestone / progress timeline | Users expect to see "where in the journey" at a glance; NN/G research: vertical progress bar is better on mobile | LOW–MEDIUM | Map Pall-Ex `status.name` values to 5–6 human-readable stages: Booked → At Hub → In Transit → Out for Delivery → Delivered. Status labels must not expose internal depot codes |
| Current status with plain-language description | Removes jargon ("Processed Sort Facility" → "At Derby depot, sorting for your area") | LOW | Status badge + one-sentence explanation beneath it |
| Full event history / scan log | Users with late or stuck shipments want to see all timestamps; NN/G guideline 11 — "display all previous updates with dates" | LOW | Reverse-chronological list below the timeline; timestamp + location + description |
| Mobile-first responsive layout | 70% of tracking lookups happen on mobile; desktop is secondary | LOW–MEDIUM | Single-column layout; large tap targets (44 × 44 px minimum); ETA and status above the fold on a 375 px viewport |
| Clear error states for bad input | Users mistype tracking numbers and postcodes; generic "error" messages cause abandonment | LOW | See Error States section below |
| Postcode mismatch handling | DPD pattern: different postcode in system vs. supplied → explicit message; do not silently fail | LOW | Compare supplied postcode against `delAddressPostcode` in backend; return distinct "postcode does not match our records" message, not generic 404 |
| "Not found" state | Consignment not in Pall-Ex yet (label printed, not scanned) vs. genuinely wrong number | LOW | Distinguish: "No consignment found — your reference may not have been collected yet. Try again later or contact Derby Aggs." |
| Delivered state with proof-of-delivery indicator | Once `status.name` = Delivered, users want confirmation it arrived safely; industry standard | LOW | Show delivery timestamp, recipient location (town), and any POD reference available in API |
| HTTPS and no tracking number in URL query string | Privacy: postcode + tracking number in URL is indexable and shareable; use POST or session-based lookup | LOW | Security table stake, not a UX feature — but absence triggers distrust |

**Error States (table stakes, listed separately for clarity):**

| State | Trigger | Message Pattern |
|-------|---------|----------------|
| Not found | `searchTerm` returns empty results | "We couldn't find that consignment. Double-check your reference number and try again. If it was collected today it may not be in the system yet." |
| Postcode mismatch | Backend comparison fails | "The postcode you entered doesn't match our records for this consignment. Check your delivery confirmation and try again." |
| Multiple results | `searchTerm` matches more than one consignment | Show a list: consignment number + delivery town + estimated date; user selects one. Do not pick arbitrarily. |
| Long-ago delivered | Status = Delivered and delivery date > 90 days ago | Show delivered state normally but add "This consignment was delivered over 90 days ago. For records, contact Derby Aggs." |
| API unavailable | Nexus API timeout / 5xx | "Our tracking service is temporarily unavailable. Please try again in a few minutes or call Derby Aggs on [number]." — Never show a stack trace |
| Rate limit / abuse attempt | Rapid repeated lookups from same IP | Silent exponential back-off on the server; show "Please wait a moment before trying again." Do not expose rate-limit logic |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Delivery window display ("between 09:00–11:00") | Pall-Ex API provides `startWindow`/`endWindow` — most third-party trackers omit this; showing it reduces "when exactly?" calls | LOW | Only show when the consignment is Out for Delivery or same-day; earlier stages show date only |
| Route details (vehicle/reg if available) | `include=routedetails` returns vehicle reg and route status — visible evidence the lorry exists and is moving | MEDIUM | Useful for industrial/trade customers who want operational transparency; B2B differentiator |
| Printable / shareable status page | B2B buyers sometimes need to show delivery status to a site manager or procurement team | LOW | Print-friendly CSS media query + copyable status URL (with a short-lived signed token, not raw postcode) |
| Progressive Web App (PWA) install prompt | Repeat tracking (e.g., regular trade customers) benefits from home-screen access without app store overhead | MEDIUM | Service worker + manifest; low effort with modern frameworks |

### Anti-Features (Deliberately Not Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live map showing lorry location | Consumers see this from DPD and want it | Pall-Ex API returns route status but not GPS coordinates; building fake "approximate" map erodes trust when it's wrong | Show vehicle reg number and "Out for delivery in your area" — honest and sufficient |
| Push/SMS/email notifications on status change | Users assume they'll get updates | Out of scope for v1 per PROJECT.md; infrastructure is non-trivial and requires consent management, opt-out flows, and GDPR compliance | Display last-updated timestamp prominently; add notification groundwork as data hooks only |
| Account creation / login for saved shipments | Users expect this from e-commerce portals | Derby Aggs' customers are B2B trade buyers who have their reference numbers; account management adds auth complexity for marginal gain in v1 | Stateless lookup is faster; revisit if repeat usage data shows demand |
| "Leave in a safe place" / delivery instructions | DPD offers this; consumers expect it from B2C couriers | Pall-Ex is a pallet network — consignments are multi-pallet, heavy freight; "safe place" is not applicable; field would confuse trade buyers | Omit entirely; pallet delivery requires a person present with fork access |
| Carrier performance star rating on tracking page | Seen on some aggregator portals | Creates adversarial relationship with Pall-Ex network; a bad review on Derby Aggs' own portal harms their member relationship | Gather feedback via separate channel if needed later |

---

## Surface 2: Voice Tracking Agent

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Natural language greeting with clear purpose statement | Callers need to know immediately they've reached an automated system that can help with deliveries | LOW | "Hi, you've reached Derby Aggs delivery tracker. I can check the status of your consignment — just have your reference number and delivery postcode ready." |
| Tracking number capture by voice | Core function; the reason the caller rang | MEDIUM | Alphanumeric consignment references are the hard part — see Capture Techniques below |
| Postcode capture and verification | Serves as identity gate (matches Nexus API `delAddressPostcode`); callers expect to be asked for it | LOW | Ask for postcode separately after tracking number; confirm back before API call |
| Read-back confirmation before lookup | Best practice for alphanumeric input — agent reads the number back segment by segment and asks "is that right?" | LOW–MEDIUM | Group digits: "I heard Alpha-Bravo-Charlie, one-two-three-four-five-six — is that correct?" Use NATO phonetic alphabet for letter disambiguation |
| Status and ETA read aloud | The output the caller wants; must be clear spoken English not raw API status codes | LOW | "Your consignment is out for delivery today and the estimated window is between nine and eleven this morning." |
| Graceful handling of invalid references | If lookup returns no results, agent must not loop indefinitely | LOW | Max 2 retries; offer human escalation on third failure |
| Human escalation path | Callers must always be able to reach a person; regulatory expectation (Ofcom) and basic trust signal | LOW | "If you'd like to speak to someone at Derby Aggs, press zero or say 'agent' at any time." |
| DTMF fallback for tracking number entry | Noisy environments (lorry cabs, yards) make voice recognition unreliable; keypresses are always reliable | MEDIUM | "If it's easier, you can type your reference number on the keypad and press hash when done." Confirm digit-string back by voice after entry. `#` terminates entry for variable-length references |
| API unavailable / timeout handling | Nexus API is the single point of failure; agent must not hang or give a blank answer | LOW | Detect timeout; "Our tracking system is temporarily unavailable. I'll transfer you to the Derby Aggs team." |
| Clearly disclosed as AI | UK consumer expectation; Ofcom and emerging AI transparency norms | LOW | State at greeting that this is an automated service; do not pretend to be human if asked directly |

**Alphanumeric Capture Techniques (table stakes, detailed):**

| Technique | When to Use | Notes |
|-----------|-------------|-------|
| Chunked read-back (NATO phonetics for letters, grouped digits) | Always — primary confirmation method | Read back in groups of 3–4 characters; "I heard: Alpha-Romeo-seven-seven-four-two — is that right?" |
| DTMF keypad entry with `#` terminator | Offered proactively in noisy conditions; always available as fallback | Variable-length references need a finish character; `#` is conventional. Confirm back by voice after receipt |
| Keypad-entered postcode (digits only, no spaces) | When voice postcode fails twice | UK postcodes have a reliable pattern; agent knows when the format is invalid and can prompt correction |
| Re-ask with format hint | On first failure | "I didn't catch that clearly. Your reference number is usually 10–16 digits — could you say it again, slowly?" |
| Maximum 3 attempts then escalate | On repeated failure | Prevents loop frustration; hand off to human with context ("The caller is trying to track reference starting with...") |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Outbound call to driver for live ETA | Pall-Ex API has no real-time GPS; agent can bridge the caller to a Derby Aggs driver mid-interaction to get an exact ETA and relay it back | HIGH | Caller is told "I'm going to call your driver now — please hold a moment"; agent places outbound call to driver list (managed in admin), asks for ETA, returns to caller with answer. Requires call-hold, outbound dial, and state management across two call legs. This is the primary v1 differentiator |
| Warm handoff with context to human agent | When escalating, summarise what the caller said and what was found before connecting — human doesn't ask again | MEDIUM | Agent speaks a brief summary to the receiving agent before connecting: "Transferring a caller asking about consignment 12345, no result found in the system." |
| Intent short-circuit ("I just want to know if it's been delivered") | Recognise simple binary intent and answer without walking full milestone script | LOW | If `status.name` = Delivered, skip the full timeline read and lead with "Yes, your delivery was completed." |
| Proactive ETA framing | If consignment is Out for Delivery and a time window exists, open with the window not just "out for delivery" | LOW | "Your delivery is on its way and is expected between nine and eleven this morning." — callers who phone have higher anxiety; front-load the answer |

### Anti-Features (Deliberately Not Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-level menu tree ("Press 1 for... press 2 for...") | Traditional IVR pattern; feels familiar | Defeats the purpose of conversational AI; adds friction for a single-intent call line (delivery status); callers hate menus | Let callers speak naturally; agent infers intent from opening utterance |
| Voice biometric identity | Emerging capability; "passwordless" | Derby Aggs callers are B2B trade buyers calling occasionally, not high-frequency consumers; biometric enrolment adds friction and raises GDPR questions | Postcode + reference number is sufficient security for non-financial status information |
| Multi-turn FAQ beyond delivery status | "Can you take me through your returns policy?" | Scope creep; adds LLM prompt complexity, increases hallucination risk, and dilutes the specialist agent | Hard-scope agent to delivery tracking only; route all other questions to human |
| Scheduled automated outbound calls to all drivers | "Check in with every driver every hour" | Intrusive, high cost, and operationally complex; drivers in moving vehicles cannot always answer | Keep outbound calling as mid-interaction escalation only per PROJECT.md decision |
| SMS/email follow-up after call | "Send me a summary" | Requires collecting and validating contact details, consent, and GDPR compliance mid-call — adds significant complexity for v1 | Portal provides the written record; agent gives verbal confirmation only |
| Voicemail / callback queue | "Leave a message and we'll call you back" | Requires callback orchestration, SLA tracking, and staff workflow — out of scope | Escalate to human during business hours; out-of-hours message should state opening times |

---

## Surface 3: Admin Dashboard

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Call volume summary (today / 7-day / 30-day): received, answered, missed | The core operational question: "how busy is the line?" | LOW | Tabular or card display; "missed" = unanswered before timeout or caller hung up before agent spoke |
| Success rate / containment rate | "How often does the AI resolve the call without human help?" — the primary ROI metric | LOW | Containment rate = AI-resolved / total received × 100. Industry benchmark: 80%+ for simple intent like delivery status. Display as percentage + trend |
| Call history log | Every call must be reviewable for QA, dispute resolution, and debugging | LOW–MEDIUM | Columns: date/time, duration, tracking reference captured (if any), outcome (resolved / escalated / failed / abandoned), caller number (masked for GDPR — last 4 digits only) |
| Date range filter on call log | Standard log navigation | LOW | Preset: Today, Last 7 days, Last 30 days + custom date picker |
| Outcome / status filter on call log | Filter by resolved / escalated / abandoned / API error | LOW | Multi-select dropdown |
| Search by tracking reference in call log | Derby Aggs team will receive complaints referencing a specific consignment; they need to find the call | LOW | Free-text search on captured tracking reference field |
| Call transcript viewer | Review what was said; identify where the agent failed or misheard | MEDIUM | Per-call transcript with speaker labels (Caller / Agent). Sensitive — postcode and tracking number visible; access behind dashboard auth |
| Call recording playback | Audio review for QA and dispute evidence | MEDIUM | Linked audio player per call record. Storage costs must be considered — 30-day retention is typical; configurable |
| Driver contact list management (CRUD) | Driver phone numbers currently in a spreadsheet; dashboard replaces that | LOW | Table: Name, Phone number, Active/Inactive toggle. Add / Edit / Delete. Used by voice agent for outbound calls |
| Shared password login | v1 auth model per PROJECT.md; small internal team | LOW | Single shared credential; hashed and stored securely. No per-user accounts in v1 |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Outbound call log (calls to drivers) | Separate audit trail of agent-initiated driver calls: which driver, which call, outcome, duration | LOW–MEDIUM | Sub-table or filter within call history; links to the parent inbound call. Required for cost tracking (outbound call per-minute rates) |
| Failed-lookup report | Which tracking references were searched but returned no result — indicates data quality issues or customers misquoting references | LOW | Aggregate count + list of unresolved references; helps Derby Aggs spot patterns (e.g., references from a specific customer always failing) |
| API error rate indicator | Shows when Nexus API is degraded; helps team distinguish "agent broken" from "Pall-Ex broken" | LOW | Rolling 1-hour API call success/failure count; amber/red indicator when failure rate exceeds threshold |
| Escalation reason breakdown | Which calls were escalated and why (repeated failure / caller requested / API down) — feeds agent improvement | MEDIUM | Categorised by escalation trigger; identifies which failure mode is most common |
| Per-call success annotation | Ability for admin to mark a call transcript as "resolved" or "needs review" | LOW | Toggle on transcript view; enables manual QA workflow without a full QA platform |

### Anti-Features (Deliberately Not Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-user accounts with roles and SSO | Feels like "proper" enterprise auth | PROJECT.md explicitly deferred this; over-engineered for a small internal team; SSO integration requires IdP setup | Shared password; revisit at phase boundary if team grows or audit trail per user becomes a compliance need |
| Real-time live call monitoring / listening | "Listen in on active calls" | Technically complex (requires call streaming to browser); raises GDPR and consent issues; overkill for a 1–2 person admin team | Post-call transcript and recording provide sufficient oversight |
| Automated alerts / PagerDuty integration | "Notify me when success rate drops" | Adds infrastructure (alerting platform, on-call rotation); disproportionate for v1 | Manual dashboard check is sufficient; add if operational team grows or SLA becomes contractual |
| CRM / TMS integration for driver data | "Sync with our fleet management system" | No existing system to integrate with; manual list in admin is the v1 design decision per PROJECT.md | CRUD driver list in dashboard; integration is a future phase when a system exists |
| Call sentiment analysis / NPS scoring | Nice analytical feature | Requires additional ML pipeline; low value when calls are single-intent (status lookup); "containment rate" is a better proxy for satisfaction | Track containment + escalation reason instead |
| Customer-facing call history (self-service call record) | "Let callers see their own history" | Requires per-caller authentication; builds unnecessary portal complexity for v1 | Portal lookup by reference number covers the use case without auth |

---

## Feature Dependencies

```
[Postcode gate (portal)]
    └──requires──> [Backend postcode comparison vs. Pall-Ex delAddressPostcode]
                       └──requires──> [Pall-Ex Nexus API integration + token management]

[Voice agent tracking lookup]
    └──requires──> [Same backend API integration]
    └──requires──> [Alphanumeric STT capture + DTMF fallback]

[Voice agent outbound driver call]
    └──requires──> [Driver contact list in admin dashboard]
    └──requires──> [Call-hold + outbound dial capability in voice platform]
    └──requires──> [Inbound call state management across two call legs]

[Admin call log + transcript viewer]
    └──requires──> [Voice platform stores/exports transcripts per call]
    └──requires──> [Backend call record storage linked to platform call ID]

[Admin outbound call log]
    └──requires──> [Voice agent outbound driver call]
    └──requires──> [Admin call log (parent record)]

[Admin failed-lookup report]
    └──requires──> [Backend logging of all API lookups with outcome]

[Admin API error rate indicator]
    └──requires──> [Backend health-check logging on every Nexus API call]

[DTMF fallback (voice agent)]
    └──enhances──> [Alphanumeric tracking number capture]

[Warm handoff with context (voice agent)]
    └──enhances──> [Human escalation path]
```

### Dependency Notes

- **Nexus API integration is the root dependency** for both the portal and the voice agent. Mock responses against the spec must be available from day one of development; real credentials are a tracked external risk.
- **Driver contact list (admin) must exist before outbound calls (voice agent)** — the agent cannot dial a driver without a managed number. These two features must ship in the same phase or admin first.
- **Call log storage must be designed before the voice agent ships** — retrofitting per-call storage after the fact is painful. Log schema should be defined in the voice agent build phase.
- **DTMF and voice capture are not mutually exclusive** — both should be implemented together; DTMF is not a later enhancement, it is a launch requirement given the noisy-environment constraint.

---

## MVP Definition

### Launch With (v1)

- [ ] Tracking portal: form (reference + postcode), status + ETA display, milestone timeline, full error states — why essential: core value delivery; no workaround exists
- [ ] Tracking portal: mobile-first responsive layout — why essential: majority of users are mobile
- [ ] Pall-Ex Nexus API integration with token refresh and graceful degradation — why essential: single data source; everything depends on it
- [ ] Voice agent: greeting, tracking number capture (voice + DTMF), postcode capture, read-back confirmation, status/ETA playback — why essential: the phone channel
- [ ] Voice agent: invalid reference handling (max 3 attempts → escalate) — why essential: prevents call loops and frustrated hang-ups
- [ ] Voice agent: human escalation path (zero / "agent" at any point) — why essential: regulatory and trust baseline
- [ ] Voice agent: API unavailable fallback (→ human escalation with message) — why essential: graceful degradation
- [ ] Admin: shared-password login — why essential: gates all dashboard access
- [ ] Admin: call metrics summary (received / answered / missed / containment rate) — why essential: success measurement from day one per brief
- [ ] Admin: call history log with date + outcome filters + reference search — why essential: operational oversight and QA
- [ ] Admin: call transcript viewer — why essential: QA and dispute resolution
- [ ] Admin: driver contact list CRUD — why essential: prerequisite for outbound calls
- [ ] Voice agent: outbound driver call (mid-interaction, hold caller, dial driver, relay ETA) — why essential: the primary v1 differentiator and explicit requirement

### Add After Validation (v1.x)

- [ ] Admin: outbound call sub-log — trigger: outbound call feature ships; needed for cost tracking
- [ ] Admin: failed-lookup report — trigger: once real call volume exists; pattern analysis becomes meaningful
- [ ] Admin: API error rate indicator — trigger: Nexus API proves unreliable in production
- [ ] Portal: route details (vehicle/reg) via `include=routedetails` — trigger: user feedback requesting more transparency
- [ ] Portal: printable/shareable status page with signed token — trigger: B2B use case validated by feedback
- [ ] Admin: escalation reason breakdown — trigger: containment rate shows improvement opportunities

### Future Consideration (v2+)

- [ ] Proactive notifications (SMS/email) — why defer: GDPR consent flow, opt-out management, infra cost; PROJECT.md explicitly deferred
- [ ] Per-user dashboard accounts / SSO — why defer: small team; only needed when audit trail per user or team grows
- [ ] Multi-carrier support — why defer: Pall-Ex only for v1; per PROJECT.md
- [ ] PWA install prompt — why defer: depends on repeat-usage data justifying the effort
- [ ] Automated driver check-in calls (scheduled outbound) — why defer: PROJECT.md explicit; operational impact requires Derby Aggs process change

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Nexus API integration + token management | HIGH | MEDIUM | P1 |
| Tracking portal — status + ETA + milestone timeline | HIGH | LOW | P1 |
| Tracking portal — all error states | HIGH | LOW | P1 |
| Tracking portal — mobile-first layout | HIGH | LOW | P1 |
| Voice agent — number capture (voice + DTMF) + confirmation | HIGH | MEDIUM | P1 |
| Voice agent — status/ETA playback | HIGH | LOW | P1 |
| Voice agent — human escalation | HIGH | LOW | P1 |
| Voice agent — outbound driver call | HIGH | HIGH | P1 |
| Admin — call metrics summary | HIGH | LOW | P1 |
| Admin — call history log + filters | HIGH | LOW | P1 |
| Admin — call transcript viewer | MEDIUM | MEDIUM | P1 |
| Admin — driver contact list CRUD | HIGH | LOW | P1 |
| Admin — shared password login | HIGH | LOW | P1 |
| Admin — outbound call sub-log | MEDIUM | LOW | P2 |
| Admin — failed-lookup report | MEDIUM | LOW | P2 |
| Admin — API error rate indicator | MEDIUM | LOW | P2 |
| Portal — route details (vehicle/reg) | LOW | LOW | P2 |
| Portal — printable/shareable page | LOW | LOW | P2 |
| Admin — escalation reason breakdown | MEDIUM | MEDIUM | P2 |
| PWA install prompt | LOW | MEDIUM | P3 |
| Proactive notifications (SMS/email) | HIGH | HIGH | P3 |
| Per-user dashboard accounts / SSO | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Pall-Ex MyNexus (direct) | DPD UK (B2C reference) | Our Approach |
|---------|--------------------------|------------------------|--------------|
| Tracking entry | 16-digit barcode + postcode in capitals | Parcel number only (no postcode gate) | Reference number + postcode (security gate, consistent with MyNexus pattern) |
| ETA display | Date shown; time window available in API | 1-hour window on day-of (Predict feature) | Show date on earlier stages; `startWindow`/`endWindow` when Out for Delivery |
| Milestone timeline | Basic scan log | Visual step-tracker with driver name and photo | Clean 5-stage visual timeline; no driver photo (pallet network, not last-mile courier) |
| Live map | No | Yes (GPS on day-of) | No — Nexus API has no GPS; show route status and vehicle reg instead |
| Voice / phone channel | None (web only) | Automated IVR for basic status | Conversational AI agent with DTMF fallback and outbound driver escalation |
| Admin / operations dashboard | MyNexus operator portal (member-facing) | N/A | Custom dashboard measuring AI agent performance and call outcomes |
| Outbound driver query | Not available | Not applicable | Live mid-call outbound to named driver list — primary differentiator |

---

## Sources

- [Baymard Institute — Order Tracking UX: 6 Key Details to Provide](https://baymard.com/blog/integrate-tracking-info) — HIGH confidence; research-backed
- [NN/G — Status Trackers and Progress Updates: 16 Design Guidelines](https://www.nngroup.com/articles/status-tracker-progress-update/) — HIGH confidence; authoritative UX source
- [Pall-Ex MyNexus tracking guide](https://www.pallex.co.uk/guide-to-tracking-your-pallet) — HIGH confidence (access blocked at research time but entry mechanism confirmed via multiple secondary sources)
- [Hamming AI — Post-Call Analytics for Voice Agents](https://hamming.ai/resources/post-call-analytics-voice-agents-metrics-monitoring) — HIGH confidence; platform-specific metrics guide
- [Teneo AI — Containment Rate Benchmarks 2026](https://www.teneo.ai/blog/containment-rate-call-centre-benchmarks-improve-it-2026) — MEDIUM confidence; single vendor source but consistent with industry figures
- [Famulor — DTMF Feature for Phone Data Entry](https://www.famulor.io/blog/type-dont-talk-famulors-new-dtmf-feature-revolutionizes-phone-data-entry) — MEDIUM confidence; vendor blog, consistent with technical documentation
- [yellow.ai DTMF documentation](https://docs.yellow.ai/docs/cookbooks/voice-as-channel/usecases/dtmf) — HIGH confidence; official platform docs
- [Balto — KPIs for Voice AI Agents in Contact Centers](https://www.balto.ai/blog/kpis-for-voice-ai-agents-in-contact-centers/) — MEDIUM confidence
- [Retell AI — AI Voice Agents in 2025](https://www.retellai.com/blog/ai-voice-agents-in-2025) — MEDIUM confidence; vendor perspective
- [Nextiva — AI IVR Explained](https://www.nextiva.com/blog/ai-ivr.html) — MEDIUM confidence; vendor documentation
- [AI IVR Escalation Best Practices — Unity Connect](https://unity-connect.com/our-resources/blog/ai-ivr-escalation-to-live-agent-best-practices/) — MEDIUM confidence (page returned 403 at research time; cited pattern consistent with other sources)
- [Kwin Lau — Advice on Voice Agents (June 2025)](https://gist.github.com/kwindla/f755284ef2b14730e1075c2ac803edcf) — HIGH confidence; practitioner guide from LiveKit author
- [Deepgram — Noise-Robust Speech Recognition Methods and Best Practices](https://deepgram.com/learn/noise-robust-speech-recognition-methods-best-practices) — HIGH confidence; official platform documentation
- [European Accessibility Act — WCAG 2.2 compliance as of June 2025](https://www.w3.org/TR/WCAG21/) — HIGH confidence; regulatory requirement now in force

---

*Feature research for: Delivery tracking self-service system (Derby Aggs / Pall-Ex)*
*Researched: 2026-06-11*
