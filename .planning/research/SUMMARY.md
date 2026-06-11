# Project Research Summary

**Project:** Delivery Assistance Agent — Derby Aggs / Pall-Ex
**Domain:** Multi-channel delivery tracking (customer web portal + AI voice agent + admin dashboard, Pall-Ex Nexus REST API)
**Researched:** 2026-06-11
**Confidence:** HIGH

---

## Executive Summary

This project builds three tightly coupled surfaces over a single external data source (the Pall-Ex Nexus REST API): a customer-facing tracking portal where buyers enter a consignment reference and postcode to see delivery status; an AI voice agent that handles inbound customer calls and can place outbound calls to drivers for live ETAs; and an admin dashboard for Derby Aggs staff to monitor call outcomes, manage the driver list, and review transcripts. The Nexus API is the single root dependency — everything else is a consumer of it, and its JWT token lifecycle and potential downtime must be the first engineering problem solved before any user-facing surface is built.

The recommended approach is a Next.js 15 (App Router) monorepo with ElevenLabs Agents as the voice platform (Scribe v2 Realtime STT, Twilio UK number, post-call webhooks), Supabase for Postgres and auth, and Upstash Redis for the Pall-Ex bearer token cache. ElevenLabs is the primary recommendation on cost and feature grounds: at 500 calls/month it costs roughly $125/month all-in versus $170–180/month for Retell or Vapi equivalents, with purpose-built real-time telephony ASR (93.5% accuracy on FLEURS). The critical qualification is alphanumeric tracking number capture: ElevenLabs requires a voice spell-out and read-back confirmation flow rather than native DTMF digit collection. If real-world noisy-environment testing (lorry cabs, haulage yards) shows unacceptable error rates, Retell AI is the ready pivot — it has native keypad digit collection but costs 3–4x more per minute. The backend architecture patterns (async outbound calls, post-call webhooks, shared backend service) are platform-agnostic and apply equally to either platform.

The key risks are threefold. First, STT accuracy on alphanumeric strings under industrial noise is the highest technical risk and must be validated with real-world audio samples before voice agent launch. Second, the Nexus API bearer token expires hourly and concurrent voice calls will trigger refresh race conditions unless a singleton mutex is built from the start. Third, call recording, transcript storage, and the outbound driver call feature each have direct UK GDPR and PECR implications that must be designed in from the first phase — the Data (Use and Access) Act 2025 aligns PECR fines with UK GDPR maximums (£17.5m / 4% turnover), making post-launch compliance patching unacceptable.

---

## Key Findings

### Recommended Stack

A single Next.js 15 monorepo (Turborepo) covers all three surfaces and the shared API layer. The customer portal and admin dashboard are separate Next.js apps that share a common type library and call a shared backend. ElevenLabs Agents (with Twilio for UK number provisioning) handles all telephony. Supabase provides managed Postgres with built-in row-level security and Auth; Upstash Redis provides the serverless-safe HTTP Redis required for Pall-Ex JWT caching on Vercel's stateless functions. shadcn/ui and Recharts handle the admin dashboard UI. MSW 2.x mocks the Pall-Ex API during development against the exact same application code paths as production.

**Core technologies:**
- **ElevenLabs Agents (Scribe v2 Realtime):** Voice AI platform — best all-in cost at 500–2,000 calls/month; server webhook tools, post-call transcription webhooks, and `transfer_to_number` system tool all verified present; Scribe v2 Realtime must be explicitly enabled under Advanced config (not the default)
- **Twilio:** UK phone number provisioning and telephony transport — native ElevenLabs integration partner; used for inbound agent number and agent-initiated outbound calls
- **Next.js 15 (App Router):** Full-stack framework for all three surfaces — single framework covers public portal, admin dashboard, and API routes; server components reduce client JS; zero-config Vercel deployment
- **Supabase (Postgres 15 + Auth):** Database and authentication — managed Postgres with built-in RLS; Supabase Auth sufficient for shared admin password v1; free tier for dev, Pro ($25/mo) required for production
- **Upstash Redis:** Serverless-safe token cache — HTTP-based (not TCP), required for Vercel; maps directly to 1h bearer / 24h refresh token TTL lifecycle; free tier covers expected volume
- **Vercel Pro:** Hosting — zero-config Next.js; Pro plan required (Hobby is non-commercial and has a 10-second function timeout insufficient for webhook processing)
- **MSW 2.x:** Pall-Ex API mock for development — same code path in mock and production; unblocks all development tracks before credentials arrive

**Fallback platform:** If ElevenLabs alphanumeric capture fails real-world noise testing, pivot to Retell AI (native DTMF digit collection, Deepgram Nova-3 + Azure auto-failover STT, ~$0.17/min blended vs ~$0.08–0.10/min for ElevenLabs). The backend architecture is platform-agnostic — webhook endpoints, outbound call orchestration, and the async driver call pattern require only endpoint reconfiguration, not redesign.

**What not to use:** Raw Twilio + DIY STT/LLM/TTS pipeline (4–6 weeks engineering, not justified at this scale); `ioredis` on Vercel (TCP conflicts with serverless model); Vercel Hobby in production; Supabase free tier in production; Whisper for real-time STT (batch model, inadequate under noise); moment.js.

### Expected Features

The project spans three surfaces, each with clear table-stakes requirements. The Nexus API integration layer underpins all of them.

**Must have (table stakes — v1 launch):**
- Tracking portal: reference + postcode input form, status + ETA display (using `estimatedDelDate` + `startWindow`/`endWindow`), 5-stage milestone timeline, full error states (not found, postcode mismatch, multiple results, API unavailable), mobile-first responsive layout
- Tracking portal: HTTPS enforced; no tracking number/postcode in URL query string
- Pall-Ex Nexus API integration with JWT refresh mutex, circuit breaker, and graceful degradation (stale cache + disclosure when circuit open)
- Voice agent: greeting with AI disclosure, tracking number capture (voice spell-out + NATO phonetic read-back confirmation), DTMF fallback for keypad entry (required at launch given noisy-environment constraint — not a v1.x enhancement), postcode capture, status/ETA playback in plain English
- Voice agent: invalid reference handling (max 3 attempts then escalate), human escalation path (zero / "agent" at any time), API unavailable fallback script
- Voice agent: outbound driver call (mid-interaction, async pattern — hold caller, dial driver, relay ETA) — the primary v1 differentiator
- Admin: shared-password login, call metrics summary (received/answered/missed/containment rate), call history log with date + outcome + reference filters, transcript viewer, driver contact list CRUD
- Instrumentation: call outcome event logging from day one, supporting all five brief success metrics (% successful tracking queries, voice agent accuracy vs API data, reduction in manual enquiries, call success rate, portal completion rate)

**Should have (add after validation — v1.x):**
- Admin: outbound call sub-log, failed-lookup report, API error rate indicator, escalation reason breakdown
- Portal: route details (vehicle/reg) via `include=routedetails`, printable/shareable status page with signed token

**Defer to v2+:**
- Proactive SMS/email notifications (GDPR consent flows, opt-out infra, explicitly deferred in project brief)
- Per-user dashboard accounts and SSO (small team; shared password acceptable for v1)
- Multi-carrier support (Pall-Ex only for v1)
- PWA install prompt (depends on repeat-usage data)
- Scheduled automated outbound driver calls (requires Derby Aggs process change)

**Anti-features (deliberately not build):**
- Live GPS map (Nexus API has no coordinates; fake map erodes trust — show vehicle reg and "Out for delivery in your area" instead)
- Multi-level IVR menu tree (defeats conversational AI; this is a single-intent call line)
- "Leave in a safe place" instructions (pallet network requires person present with fork access)
- Real-time live call monitoring (GDPR/consent complexity; post-call transcript is sufficient oversight)

### Architecture Approach

The architecture is a shared-backend monorepo: a single Next.js API layer handles all three channels to avoid duplicating the Nexus JWT lifecycle, caching, and circuit-breaker logic. Voice and web portal channels both call `POST /api/track` with a `channel` discriminator (`"web"` or `"voice"`), receiving channel-appropriate response shapes (structured JSON for web; a `spokenSummary` string for voice TTS). The Nexus API client is a singleton with a refresh mutex and opossum circuit breaker, backed by Upstash Redis. The outbound driver call uses an async pattern: the tool call returns immediately with a holding phrase ("I'm just calling the driver now"), the backend initiates the driver call separately via the ElevenLabs REST API, and the result is relayed via a follow-up tool poll once the driver call webhook arrives — this avoids voice platform tool call hard timeouts (5–10 seconds).

**Major components:**
1. **Nexus API Client** — JWT singleton with refresh mutex, 55-minute proactive token refresh (5-minute safety margin), opossum circuit breaker, MSW mock mode, 120-second consignment response cache
2. **Tracking Service** — lookup orchestration, postcode normalisation and comparison (case-insensitive, strip spaces), channel-specific response shaping
3. **Voice Tool Endpoint (`POST /api/voice/tool`)** — mid-call tool handler for ElevenLabs server webhook tools; must respond within 5 seconds; handles `lookup_tracking`, `call_driver`, and `get_driver_result` tools
4. **Outbound Call Orchestrator** — async driver call initiation via ElevenLabs REST API; stores result keyed by parent `call_id`; 45-second timeout with human escalation fallback; single-attempt limit
5. **Call Pipeline Service** — post-call webhook receiver; HMAC signature validation; upserts `calls` table rows; persists full transcript; derives outcome classification
6. **Admin Dashboard (Next.js App Router)** — call metrics, history, transcript viewer, driver CRUD; shared-password session via Supabase Auth; RLS restricts direct DB access
7. **Web Tracking Portal (Next.js App Router)** — server-component-first; writes `portal_lookups` row on every lookup for completion-rate metrics
8. **Database (Supabase Postgres)** — three core tables: `calls` (with `parent_call_id` FK for driver sub-calls), `drivers`, `portal_lookups`; all dashboard metrics derived from SQL aggregation — no separate metrics store needed at v1 scale

**Key patterns:**
- Single shared `POST /api/track` endpoint for both web and voice (channel discriminator pattern)
- JWT singleton with refresh mutex — never reactive 401 handling without a mutex
- Circuit breaker with stale-cache fallback (not a hard error) for Nexus downtime
- Async outbound driver call — return holding phrase immediately, poll for result
- MSW intercepting fetch at network level — same code path as production; mock edge cases explicitly (null `estimatedDelDate`, 429, 5xx)
- Transcript stored in own DB via post-call webhook — never rely solely on voice platform retention

### Critical Pitfalls

1. **STT captures wrong tracking number or postcode silently** — Read-back confirmation loop (full string, single yes/no) is mandatory before any API call; offer DTMF fallback proactively; use NATO phonetic prompt on second failure; maximum 3 attempts then human escalation. Must be in initial agent design, not retrofitted. Error is invisible in quiet office testing; only manifests in real lorry cab noise.

2. **Nexus bearer token refresh race condition** — Implement a singleton refresh mutex from day one: only one in-flight refresh permitted; concurrent callers queue and retry with the new token. Proactively refresh at 50 minutes, not reactively on 401. Production failure mode is cascading 401s that masquerade as "consignment not found" errors, clustering around clock boundaries.

3. **LLM hallucinating delivery status when API fields are null** — System prompt must be data-grounded-only: agent may only state information present in the API response. Null `estimatedDelDate` must trigger driver escalation, not LLM inference. Add an output validation layer that rejects non-grounded claims before TTS speaks them.

4. **No call recording consent / GDPR violation** — Recording consent announcement must be the first three seconds of every inbound call, before any data collection begins. Separate retention schedules for audio (ephemeral), transcripts (90-day default), and metadata. Data processor agreements with ElevenLabs and the LLM provider must be in place before any live calls. Driver phone numbers must never appear in customer-visible call data.

5. **Building all three surfaces before the API integration is solid** — The Nexus API layer (with real credentials validated) must be signed off before portal or voice agent development begins. Pall-Ex credential issuance is the critical-path external dependency and must be tracked as a milestone blocker, not assumed to arrive on demand.

6. **Outbound driver call safety and legal exposure** — Place driver calls only after explicit customer consent to hold; maximum one call attempt per customer query; time-gate to delivery hours only; document use of driver numbers in contractor agreements; driver numbers never exposed in customer-facing data.

7. **Prompt injection via caller speech** — Harden system prompt with explicit role boundary; inject only the current consignment API response into LLM context (never driver list, never all customer data); lightweight input pattern check on STT transcript before LLM; adversarially test with injection attempts before launch.

---

## Implications for Roadmap

The architecture research provides an explicit 11-step build order based on component dependencies. The suggested phase structure maps those steps into delivery phases.

### Phase 1: Foundation — Pall-Ex API Integration and Data Schema

**Rationale:** The Nexus API is the root dependency for every surface. Nothing else should be built until this layer is stable and signed off. The database schema must also precede all service writes to it — retrofitting schema after the fact is one of the highest-cost identified mistakes.
**Delivers:** Nexus API client (mock mode + live mode), JWT refresh singleton with mutex, opossum circuit breaker, MSW mock fixtures covering all edge cases (null ETA, 429, 5xx, postcode mismatch, multiple results), Supabase Postgres schema (`calls`, `drivers`, `portal_lookups`), Upstash Redis token cache, environment secrets structure, and instrumentation event definitions that underpin all five brief success metrics.
**Addresses:** FEATURES.md — Nexus API integration (P1); instrumentation event schema (P1). Pitfall 2 (token race condition), Pitfall 5 (wrong build order), Pitfall 10 (uninstrumented metrics).
**Avoids:** Surfaces built on a mock that diverges from the live API; cascading 401s under concurrent voice calls; missing metric events that cannot be reconstructed post-launch.
**Research flag:** Skip deeper research — JWT singleton, circuit breaker (opossum), MSW 2.x, Upstash Redis are all established patterns with official documentation. Pall-Ex credential availability is a tracked external blocker for the live-mode canary test; mock mode proceeds without it.

### Phase 2: Customer Tracking Portal

**Rationale:** The portal is the simplest consumer of the API layer, produces a visible user-facing deliverable, and end-to-end validates the tracking service and MSW mock before the more complex voice agent inherits the same foundation.
**Delivers:** Next.js tracking portal (reference + postcode form), 5-stage milestone timeline, ETA window display, all error states (not found, postcode mismatch, multiple results, API unavailable), mobile-first layout, `portal_lookups` write on each lookup, HTTPS enforcement, no sensitive data in URL query string.
**Addresses:** FEATURES.md — all portal P1 features. Pitfall 9 (API downtime bad UX: 10-second timeout, specific error message); Pitfall 1 partial (postcode normalisation: case-insensitive, strip spaces before Nexus comparison); Pitfall 10 (portal completion event logged).
**Avoids:** Infinite spinner on API downtime; generic error messages; raw postcode in URL.
**Research flag:** Skip deeper research — standard Next.js 15 App Router patterns, thoroughly documented.

### Phase 3: Admin Dashboard Core

**Rationale:** The admin dashboard reads from the `calls` table and provides Derby Aggs with visibility from day one. The driver contact list CRUD is a hard prerequisite for the outbound calling feature in Phase 5.
**Delivers:** Shared-password login (Supabase Auth), call metrics summary cards, call history log with date/outcome/reference filters, transcript viewer, driver contact list CRUD (Name, Phone E.164, Active toggle), basic API error rate indicator.
**Addresses:** FEATURES.md — all admin P1 features. Pitfall 8 (shared password: session timeout + HTTPS enforced; flag individual accounts for v1.1); driver phone numbers never exposed in customer-facing API responses.
**Avoids:** Driver data exposure; missing operational visibility at voice agent launch; no baseline metrics view.
**Research flag:** Skip deeper research — standard Next.js + Supabase dashboard patterns. Note: marginal engineering cost of individual accounts is low — push back on shared password if any appetite exists.

### Phase 4: Voice Agent — Core Call Flow

**Rationale:** The voice agent depends on the tracking service (Phase 1), database schema (Phase 1), and driver list (Phase 3). Separating core inbound call handling from the outbound driver feature keeps the most complex feature isolated for validation after the inbound flow is proven stable.
**Delivers:** ElevenLabs Agents configuration (UK Twilio number, Scribe v2 Realtime STT explicitly enabled, system prompt with data-grounding constraints and AI disclosure), server webhook tool endpoint (`POST /api/voice/tool`), voice spell-out and NATO phonetic read-back confirmation loop, DTMF fallback for keypad entry, human escalation path (`transfer_to_number`), API unavailable fallback script, post-call webhook receiver and `calls` table writer, call recording consent announcement (first 3 seconds of every inbound call), HMAC webhook signature validation.
**Addresses:** FEATURES.md — all voice agent P1 features except outbound driver call. Pitfall 1 (STT confirmation loop); Pitfall 3 (data-grounding prompt + output validator); Pitfall 5 (GDPR: consent announcement, transcript retention TTL, DPAs); Pitfall 6 (prompt injection hardening and adversarial test suite).
**Avoids:** Silent STT errors reaching the API; LLM inferring null ETAs; recording without consent; driver numbers in transcripts.
**Research flag:** NEEDS RESEARCH during planning. ElevenLabs Agents server webhook tool configuration, Scribe v2 Realtime opt-in procedure, DTMF tone handling in the ElevenLabs telephony stack, and UK data residency options for ElevenLabs all need phase-specific research before implementation begins. Alphanumeric capture accuracy must be validated with real-world noisy audio early in this phase — failure triggers the Retell AI pivot decision.

### Phase 5: Voice Agent — Outbound Driver Escalation

**Rationale:** The primary v1 differentiator and the most architecturally complex feature. Depends on a stable driver list (Phase 3) and a proven inbound voice agent (Phase 4). Isolating it allows inbound flows to be validated in production before the async orchestration layer is added.
**Delivers:** Outbound Call Orchestrator service (async pattern: immediate tool call response with holding phrase, separate driver call via ElevenLabs REST API, result stored by `parent_call_id`, 45-second timeout with human escalation fallback), customer consent-to-hold flow before initiating driver call, single-attempt-only hard limit in code, delivery-hours time gate, outbound call sub-log in admin dashboard.
**Addresses:** FEATURES.md — voice agent outbound driver call (P1); admin outbound call sub-log (P2). Pitfall 4 (driver call safety and legal: single attempt, time gate, customer consent, no retry); architecture anti-pattern 4 (async pattern avoids tool call timeout from synchronous blocking).
**Avoids:** Tool call timeout causing call drops; repeated calls to driving drivers; missing cost audit trail for outbound per-minute charges.
**Research flag:** NEEDS RESEARCH during planning. ElevenLabs outbound call REST API, call hold state management, async result delivery mechanism (poll tool call vs. webhook-to-in-memory-state), and whether ElevenLabs supports a conference bridge as a sync alternative for v1.x all need phase-specific research.

### Phase 6: Production Hardening and Live Credentials

**Rationale:** Pall-Ex credential issuance is an external dependency with an uncertain timeline. This phase gates the final switch from MSW mock to live Nexus API, adds production operational safeguards, and completes all compliance steps before live customer data is processed.
**Delivers:** Live Pall-Ex credentials integrated (canary test run before full switch); Vercel Pro and Supabase Pro upgrades; call duration hard limit configured in ElevenLabs (8–10 minutes with 7-minute warning message); LLM context pruning after 8–10 turns; 90-day transcript retention with expiry field set; data processor agreements signed (ElevenLabs, LLM provider); admin dashboard API error rate indicator active with amber/red threshold alerts; baseline manual enquiry volume documented (prerequisite for "reduction in manual enquiries" success metric).
**Addresses:** Pitfall 9 (API downtime production testing: Nexus 503 injection test confirmed); Pitfall 10 (success metrics baseline); performance traps (call duration limit, LLM context pruning). STACK — Vercel Hobby to Pro; Supabase free to Pro.
**Avoids:** Cost blowout from no call duration limit; context-length-induced latency spikes on long calls; launching without a measurable baseline for project success metrics.
**Research flag:** Skip deeper research — operational and compliance steps are checklist-driven with no novel technical patterns.

### Phase Ordering Rationale

- **Foundation first:** Pitfalls research explicitly identifies building surfaces before the API layer as one of the highest-cost mistakes. Phase 1 is a hard gate, not a parallel workstream.
- **Portal before voice agent:** The portal is the simpler consumer and validates the tracking service end-to-end, surfacing API mock gaps before the more complex voice agent inherits them.
- **Admin before voice agent goes live:** The driver list CRUD is a prerequisite for outbound calls; call metrics visibility from day one is a stated project requirement.
- **Outbound driver call isolated:** The async orchestration pattern, safety constraints, and legal considerations make this the riskiest feature. Isolating it allows the inbound voice agent to be validated in production first.
- **Live credentials as a tracked gate:** Pall-Ex credential issuance is external with realistic lead time. Phases 1–5 proceed entirely on MSW mock; Phase 6 is the explicit live-switchover gate. Credential SLA must be established with Pall-Ex as a project dependency, not an assumption.

### Research Flags

**Phases needing `/gsd-research-phase` during planning:**
- **Phase 4 (Voice Agent — Core Call Flow):** ElevenLabs Agents server webhook tool configuration, Scribe v2 Realtime opt-in procedure, DTMF handling in ElevenLabs telephony, UK data residency confirmation, and real-world alphanumeric capture accuracy validation under industrial noise.
- **Phase 5 (Outbound Driver Escalation):** ElevenLabs outbound call REST API, call hold state management, async result delivery pattern, and whether a conference bridge sync alternative is available.

**Phases with standard, well-documented patterns (skip research phase):**
- **Phase 1:** JWT singleton, opossum circuit breaker, MSW 2.x, Upstash Redis — all established with official documentation.
- **Phase 2:** Next.js 15 App Router portal — standard patterns; Pall-Ex response shaping is the only domain-specific element, covered by the Phase 1 foundation.
- **Phase 3:** Next.js + Supabase admin dashboard — thoroughly documented combination.
- **Phase 6:** Operational and compliance steps — checklist-driven, no novel technical patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technology choices verified against official docs and pricing pages (2026-06-11). ElevenLabs feature set (server tools, post-call webhooks, transfer, outbound) all confirmed in official docs. Scribe v2 Realtime opt-in requirement confirmed. |
| Features | HIGH | Portal table stakes from Baymard and NN/G research. Voice agent patterns from platform docs and practitioner guides. DTMF fallback confirmed as launch requirement (not v1.x) given noisy-environment constraint. Admin dashboard metrics from industry benchmark sources. |
| Architecture | HIGH (patterns) / MEDIUM (ElevenLabs-specific) | Core patterns (JWT singleton, circuit breaker, async outbound, shared tracking service, channel discriminator) are well-documented. Architecture research used Retell/Vapi as reference examples; patterns are platform-agnostic but ElevenLabs-specific tool call configuration mechanics need Phase 4 research to confirm exact implementation. |
| Pitfalls | HIGH | UK GDPR/PECR positions from ICO official guidance and Data (Use and Access) Act 2025. STT accuracy figures from official Deepgram and ElevenLabs benchmarks. Token refresh race condition patterns from multiple practitioner sources. Driver call safety from RAC/UK law sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **ElevenLabs alphanumeric capture accuracy under real-world industrial noise:** Voice spell-out + read-back confirmation is the designed mitigation, but whether Scribe v2 Realtime is sufficient in lorry cab environments remains to be validated with real audio samples. This is the go/no-go question for the platform choice. Must be tested early in Phase 4 with genuine ambient noise recordings.

- **ElevenLabs async outbound call and result relay pattern:** The architecture calls for an async driver call with the result relayed back to the active inbound call. The exact mechanism depends on ElevenLabs' specific API capabilities — needs Phase 5 research to confirm whether poll tool calls, webhook-to-in-memory-state keyed by call_id, or a different pattern is the right approach.

- **Pall-Ex Nexus API live behaviour vs. spec:** The API spec is 222 pages; field nullability, date formats, `searchTerm` matching semantics, and rate limit behaviour always diverge from spec in production. MSW mock must explicitly model all edge cases, and a canary test with real credentials must precede any production switch.

- **Pall-Ex credential lead time:** Credentials are pending. This is the single critical-path external dependency. A firm SLA must be established with Pall-Ex and tracked as a project milestone — not treated as an assumption.

- **ElevenLabs UK data residency:** Pitfalls research flagged Vapi's Azure UK South data residency option as required before handling live customer data. ElevenLabs' equivalent (or DPA position) must be confirmed during Phase 4 research before any live inbound call is accepted.

---

## Sources

### Primary (HIGH confidence)
- [ElevenLabs Agents Pricing](https://elevenlabs.io/pricing/agents) — per-minute costs, plan tiers, included minutes (verified 2026-06-11)
- [ElevenLabs: Scribe v2 Realtime in ElevenLabs Agents](https://elevenlabs.io/blog/scribe-v2-realtime-in-elevenlabs-agents) — opt-in config, telephony codec, November 2025
- [ElevenLabs Post-call Webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks) — `call_duration_secs`, `call_successful`, transcript payload verified
- [ElevenLabs Transfer to Number](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools/transfer-to-human) — warm transfer system tool verified
- [ElevenLabs Twilio Integration](https://elevenlabs.io/agents/integrations/twilio) — UK number provisioning path
- [ElevenLabs Scribe v2 Introduction](https://elevenlabs.io/blog/introducing-scribe-v2) — 93.5% FLEURS benchmark, sub-150ms latency
- [Supabase Pricing](https://supabase.com/pricing) — free tier pause behaviour, Pro plan cost
- [Vercel Pricing](https://vercel.com/pricing) — Hobby non-commercial restriction, Pro cost, function timeout limits
- [Upstash Redis Pricing](https://upstash.com/) — free tier limits, HTTP-native serverless compatibility
- [Baymard Institute — Order Tracking UX](https://baymard.com/blog/integrate-tracking-info) — portal table stakes research
- [NN/G — Status Trackers and Progress Updates](https://www.nngroup.com/articles/status-tracker-progress-update/) — milestone timeline design guidelines
- [ICO — Electronic and Telephone Marketing (PECR)](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/) — UK regulatory position on automated calls
- [ICO — Guidance on AI and Data Protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/) — AI processing obligations
- [Data (Use and Access) Act 2025](https://pwani.co.uk/voice-ai-providers-face-17-5-million-gdpr-penalties-as-compliance-gap-widens/) — PECR fine alignment with UK GDPR (£17.5m / 4% turnover)
- [Opossum GitHub (nodeshift)](https://github.com/nodeshift/opossum) — circuit breaker library, Node 20+, v9.0.0
- [Nango — OAuth Token Refresh Race Conditions](https://nango.dev/blog/concurrency-with-oauth-token-refreshes/) — singleton mutex pattern for concurrent token refresh
- [Deepgram — Noise-Robust Speech Recognition](https://deepgram.com/learn/noise-robust-speech-recognition-methods-best-practices) — STT accuracy figures under noise
- [AssemblyAI — Voice Agent Accuracy Benchmarks](https://www.assemblyai.com/blog/voice-agent-accuracy-problem-benchmarks) — STT error rates under ambient noise conditions

### Secondary (MEDIUM confidence)
- [Retell AI Pricing](https://www.retellai.com/pricing) — fallback platform cost comparison (~$0.17/min blended)
- [Vapi Pricing](https://vapi.ai/pricing) — alternative platform cost comparison
- [Ikki: ElevenLabs vs Vapi vs Retell 2026](https://www.ikki.io/blog/elevenlabs-vs-vapi-vs-retell-2026) — latency benchmarks; third-party analysis
- [Teneo AI — Containment Rate Benchmarks 2026](https://www.teneo.ai/blog/containment-rate-call-centre-benchmarks-improve-it-2026) — 80%+ benchmark for simple intent (single vendor source, consistent with industry figures)
- [Retell AI — ASR Provider Comparison](https://docs.retellai.com/build/asr-provider-comparison) — Deepgram Nova-3 + Azure fallback details
- [CallSphere — Prompt Injection Defence for AI Voice Agents](https://callsphere.ai/blog/prompt-injection-defense-ai-voice-agents) — injection defence patterns
- [DILR.ai — Voice AI Data Retention GDPR Guide](https://www.dilr.ai/blog/voice-ai-data-retention-gdpr-guide) — transcript retention schedule guidance

---
*Research completed: 2026-06-11*
*Ready for roadmap: yes*
