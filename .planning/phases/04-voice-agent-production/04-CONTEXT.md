# Phase 4: Voice Agent + Production - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Mode:** Auto-generated (discuss --auto — Claude selected recommended defaults; logged below)

<domain>
## Phase Boundary

Deliver the voice surface of the product and the production-readiness work. A customer calls a UK number and speaks to an AI agent that: discloses it is automated + announces recording, captures a tracking number + postcode by voice (NATO phonetic read-back) or DTMF keypad, looks up delivery status via the **existing Phase 1 `lookupConsignment` service**, and reads back only API-returned facts. On failure it escalates to a human (after 3 attempts, or on demand via "0"/"agent"), and on API downtime it explains + offers transfer rather than guessing. When the API can't give a live ETA, the agent offers to call the relevant **driver from the Phase 3 managed list**, relays the ETA back to the holding customer, with hard duration/retry limits and a logged outcome for every attempt. Every call (customer + linked driver sub-call) is persisted to the **existing `calls` table** so the Phase 3 dashboard shows it.

**Hard scope boundary (LOCKED — D-13):** Phase 4 builds and ships the *software* — webhook/tool endpoints, conversation orchestration logic, driver-escalation state machine, call/transcript persistence, compliance copy, and the ElevenLabs agent configuration-as-code — fully exercised against **mock mode (MSW + a mock voice/telephony adapter)** and unit/integration tests. The items that require **external accounts, real credentials, money, or real-world phone calls** are explicitly OUT of autonomous scope and are delivered as documented human-action runbook + UAT items: provisioning the ElevenLabs Agent + Twilio UK number, the real-world noisy-audio STT go/no-go test (SC-5), and the live Pall-Ex canary cutover + compliance sign-off (SC-6, DPAs, retention TTL job activation, Vercel/Supabase Pro). Reason: these cannot be performed or verified from code and must not be faked.

</domain>

<decisions>
## Implementation Decisions

### Voice platform & integration shape
- **D-01 (platform):** ElevenLabs Agents (Scribe v2 Realtime STT) over a Twilio UK number — per project research. Retell AI remains the documented fallback pivot if the SC-5 noise go/no-go fails; the conversation/business logic lives in OUR backend (server tools), not in platform-locked config, so a pivot only swaps the telephony/STT adapter.
- **D-02 (integration pattern):** The agent reaches our backend via **server-tool webhooks** — net-new Next.js Route Handlers under `src/app/api/voice/*` (the project has no `route.ts` yet; this is the first). Tools: `lookup_consignment`, `request_human`, `contact_driver`, plus lifecycle webhooks `call_started` / `call_ended` (transcript + outcome persistence). Keep handlers thin: validate → call existing service/repo → return typed JSON.
- **D-03 (webhook auth):** Verify every inbound webhook with an HMAC signature check, replicating `src/lib/share/token.ts` (`createHmac` + `timingSafeEqual`). New secret `VOICE_WEBHOOK_SECRET`. Reject unsigned/invalid with 401. (Twilio uses its `X-Twilio-Signature`; ElevenLabs uses its own signing secret — implement a small per-provider verifier, both constant-time.)

### Reuse (do NOT rebuild)
- **D-04:** Delivery lookups go through the existing `lookupConsignment({trackingRef, postcode})` in `src/lib/tracking/service.ts` — it already does the postcode gate, Nexus call, status mapping, error union, and lookup logging. The voice tool is a thin adapter over it. This guarantees VOICE-08 (never invent data) structurally: the tool can only return what the service returns.
- **D-05:** Driver phone lookup uses `src/lib/repositories/drivers-repo.ts`; add `getDriverById(id)` (read) — currently only `listDrivers` exists.
- **D-06:** Mock mode stays `PALLEX_MOCK`-driven; add MSW handlers for the ElevenLabs/Twilio HTTP calls so the whole flow is testable offline.

### Persistence
- **D-07:** Add write methods to `src/lib/repositories/calls-repo.ts`: `insertCall(CallInsert)` and `updateCall(platformCallId, patch)` (follow the `insertDriver` throw-on-error pattern; types already exist in `database.ts`). Customer call = `call_type:'customer', direction:'inbound'`; driver escalation = `call_type:'driver', direction:'outbound', parent_call_id:<customer call id>`. Outcome enum reused: `resolved | escalated | no_data | failed`. Transcript stored as the same structured JSON the Phase 3 `TranscriptView` already parses.
- **D-08 (recording):** Add a `recording_url text null` column via a new migration (Phase 3 left `RecordingPlayer` ready for a URL). Store the provider recording URL on `call_ended`. In mock mode this is null/stub.

### Conversation logic (server-side, platform-agnostic)
- **D-09 (capture + confirm):** Capture tracking ref + postcode; read back letters in NATO phonetics and digits grouped; confirm before lookup (VOICE-02). DTMF fallback terminated with `#` (VOICE-03). Cap to 3 failed capture attempts → human handoff with a warm-handoff summary (VOICE-05/06).
- **D-10 (escalation/handoff):** "0" or "agent" at any point → human transfer with a generated call summary (VOICE-06). API downtime → explain + offer transfer, never stall (VOICE-07). Human transfer target = `CONTACT_PHONE` env (already exists).
- **D-11 (driver escalation state machine):** On `no_data`/no-live-ETA, offer to contact driver (DRIV-01). On consent: place outbound call to the driver (DRIV-02), ask ETA, relay to held customer with periodic check-ins; if driver unreachable within limits → offer callback (DRIV-03). Hard limits via env: `DRIVER_CALL_MAX_DURATION_S` (default 180), `DRIVER_CALL_MAX_RETRIES` (default 2). Every attempt writes a driver `calls` row with outcome (DRIV-04).

### Compliance (copy + structure now; legal sign-off deferred)
- **D-12:** AI disclosure + recording-consent announcement is the first turn before any data capture (VOICE-01) — implemented as the agent's opening script and asserted in tests. GDPR/PECR retention: implement a retention helper + documented TTL (30-day recordings/transcripts) but the *activation* of the scheduled purge job and signed DPAs are human/ops items (SC-6).

### Deferred to human action (NOT autonomously executable) — see <deferred>
- **D-13:** Provisioning real ElevenLabs Agent + Twilio UK number; real-world noise STT go/no-go (SC-5); live Pall-Ex canary + production cutover, DPAs, retention-job activation, Vercel/Supabase Pro (SC-6).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reuse targets (exact files)
- `src/lib/tracking/service.ts` — `lookupConsignment` / `lookupForShare`; the only path to delivery data (VOICE-08 guarantee)
- `src/lib/nexus/client.ts`, `src/lib/nexus/token-manager.ts`, `src/mocks/handlers.ts`, `src/mocks/server.ts` — Nexus client, single-flight token, MSW mock toggle (`PALLEX_MOCK`)
- `src/lib/repositories/calls-repo.ts` — add `insertCall`/`updateCall` (currently reads only)
- `src/lib/repositories/drivers-repo.ts` — add `getDriverById`; `phone_e164` for outbound
- `src/lib/share/token.ts` — HMAC + `timingSafeEqual` pattern to replicate for webhook auth
- `src/lib/env.ts` — add ELEVENLABS_*/TWILIO_*/VOICE_WEBHOOK_SECRET/DRIVER_CALL_* (no-default, fail-loud; mock-aware via existing `refine`)
- `src/types/database.ts` — `CallRow`/Insert types (already include all Phase 4 columns except `recording_url`)
- `src/test/setup-dom.ts` — env stubbing convention for tests
- `supabase/migrations/0001_init_foundation.sql` — migration style for the `recording_url` add

### Requirements
- `.planning/REQUIREMENTS.md` — VOICE-01..08, DRIV-01..04

</canonical_refs>

<specifics>
## Specific Ideas

- Implement a `VoiceTelephonyAdapter` interface with a `MockTelephonyAdapter` (used in tests/dev) and an `ElevenLabsTwilioAdapter` (real, behind credentials). This is what makes the Retell pivot cheap and the whole flow testable offline.
- Conversation orchestration as a pure, unit-tested state machine (inputs: caller utterances/DTMF/tool results; outputs: next prompt + actions) so VOICE-02/05/06/07/08 and DRIV-01..04 are verified by tests, not by a live call.
- Keep the ElevenLabs agent definition as version-controlled config (prompt, tools, first message) in-repo so it is reviewable and re-deployable; document the manual upload/wire-up step in the runbook.
- Add a `04-PRODUCTION-RUNBOOK.md` (or HUMAN-UAT) listing the exact external steps: create ElevenLabs agent, buy Twilio UK number, set webhook URLs + secrets, run noise go/no-go script, Pall-Ex canary, flip `PALLEX_MOCK=false`, sign DPAs, enable retention cron, upgrade Vercel/Supabase.
</specifics>

<deferred>
## Deferred Ideas (human-action / external — out of autonomous build scope)

- **Provisioning:** Real ElevenLabs Agent + Twilio UK phone number (needs paid accounts + dashboard config). Captured in runbook.
- **SC-5 noise go/no-go:** Real-world lorry-cab/yard STT accuracy test — requires real audio + the live platform; pass → continue ElevenLabs, fail → pivot to Retell. Decision gate, not code.
- **SC-6 live cutover:** Pall-Ex live credentials + canary test + flip off mock; signed DPAs; retention-TTL job activation; Vercel Pro + Supabase Pro. External + contractual.
- Per the project's standing design, all of the above were always intended to land via a human canary/cutover in Phase 4 — building everything else against mock first is the plan, not a shortcut.

</deferred>

---

*Phase: 04-voice-agent-production*
*Context gathered: 2026-06-12 via discuss-phase --auto (recommended defaults)*
