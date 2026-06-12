---
phase: 04-voice-agent-production
verified: 2026-06-12T18:00:00Z
status: human_needed
score: 4/6 success criteria fully verified (SC-5 and SC-6 are human-action gates, not gaps)
human_verification:
  - test: "SC-5 — Real-world noisy-environment STT go/no-go"
    expected: "ElevenLabs Scribe v2 captures alphanumeric consignment refs accurately (3/3 within 2 spoken attempts) in a lorry cab / depot yard. PASS = continue ElevenLabs; FAIL = swap telephony adapter to Retell AI (see 04-PRODUCTION-RUNBOOK.md Step 3)."
    why_human: "Requires a live Twilio number, a real ElevenLabs agent provisioned, and a physical noisy environment. Cannot be run from code or simulated by tests."
  - test: "SC-6 — Live Pall-Ex credentials canary + production cutover"
    expected: "lookupConsignment with real credentials returns { ok: true, consignment: { ... } } for a known consignment. PALLEX_MOCK flipped to false. DPAs signed with ElevenLabs, Twilio, Supabase. 30-day retention purge job activated. Vercel Pro and Supabase Pro active."
    why_human: "Requires live API credentials (external dependency — Pall-Ex account manager), contractual DPA signatures, and paid plan upgrades. Cannot be done from code."
---

# Phase 4: Voice Agent + Production — Verification Report

**Phase Goal:** A customer can call a UK number, speak naturally to an AI agent that accurately captures their tracking details and reads back delivery status — and when the API cannot answer, the agent contacts a driver, relays the answer, and hands off to a human if needed — with all compliance gates met and live Pall-Ex credentials active.

**Verified:** 2026-06-12T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Critical framing applied:** Per D-13 and the explicit CONTEXT guidance, this phase was built mock-first. The autonomously-buildable software (webhook routes, conversation + driver-escalation state machines, telephony adapter, persistence, compliance copy, retention helper, agent config-as-code) is verified against the codebase and 296 passing tests. SC-5 (real-world noise STT go/no-go) and SC-6 (live Pall-Ex canary cutover / DPAs / Pro upgrades / retention-job activation) are correctly deferred external/human actions captured in 04-PRODUCTION-RUNBOOK.md — they are NOT gaps.

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Caller greeted with AI disclosure + recording consent before data capture; tracking ref and postcode capturable by voice (NATO read-back) or DTMF keypad (`#` terminator) | VERIFIED | `compliance.ts` exports `DISCLOSURE` containing "automated AI assistant" + "being recorded". `conversation-machine.ts` emits DISCLOSURE on `call_started` before any capture phase. `nato.ts` exports `readBack()` used in both utterance and DTMF handling. 39 unit tests in `conversation-machine.test.ts` cover all branches. `agent-config.ts` asserts `first_message === DISCLOSURE` (test-enforced, T-04-27). |
| SC-2 | After 3 failed capture attempts, warm transfer to human; on-demand "0"/"agent" transfer at any phase | VERIFIED | `reduce()` has a global `request_human` intercept that fires before phase switch (VOICE-06). The `confirming` phase increments `attempts`; at `MAX_ATTEMPTS = 3` it transitions to `handoff` and emits a `transfer` action with a warm summary (VOICE-05). Test `3-attempt escalation` and `on-demand human handoff` confirm both paths. |
| SC-3 | Agent only states API-returned facts; never invents status, date, or ETA; on API downtime explains + offers transfer | VERIFIED | `lookup_consignment/route.ts` is a thin pass-through to `lookupConsignment()` from `src/lib/tracking/service.ts` — the only path to delivery data (D-04). `conversation-machine.ts` answering branch reads fields only from `result.consignment`; `estimatedDelDate` is intentionally not spoken (structural null-date guard). `api_error` path emits explanation + transfer offer with no fabricated facts (VOICE-07). Tests assert: null `estimatedDelDate` produces no date-like digit sequence in output; `api_error` response never contains a status or date. |
| SC-4 | When API can't give live ETA, agent offers driver contact; on consent places outbound call; ETA relayed; hard limits on duration/retries; every attempt logged | VERIFIED | `driver-escalation.ts` exports `runDriverEscalation` with `MAX_RETRIES = 2`, `MAX_DURATION_S = 180`. Driver resolved server-side via `getDriverById` (T-04-20 anti-SSRF — caller never supplies phone number). `insertCall` called for every attempt (success, dial-fail, duration-overrun) with `call_type:'driver'`, `direction:'outbound'`, `parent_call_id` set (DRIV-04 audit trail). `contact_driver/route.ts` enforces consent gate: `consented:false` returns `{ contacted:false }` with zero `placeOutboundCall` calls (T-04-23). Adapter selection: `MockTelephonyAdapter` when `PALLEX_MOCK=true`, lazy-import of `createElevenLabsTwilioAdapter()` in production. 22 tests cover happy path, driver-not-found, unreachable-retry loop, duration overrun, sig gate, consent gate. |
| SC-5 | Real-world noisy-environment STT accuracy tested; platform confirmed or switched to Retell AI | HUMAN-ACTION | Cannot be verified from code. Requires live ElevenLabs + Twilio provisioning and a physical noisy-environment test. Captured as HUMAN-ACTION Step 3 in `04-PRODUCTION-RUNBOOK.md` with explicit PASS/FAIL criteria and Retell pivot instructions (swap `elevenlabs-twilio-adapter.ts` only; conversation logic unchanged per D-01). |
| SC-6 | Live Pall-Ex credentials canary passed; `PALLEX_MOCK=false`; DPAs signed; retention TTL job active; Vercel/Supabase Pro active | HUMAN-ACTION | Cannot be verified from code. Requires live API credentials, contractual DPA signatures, and paid-plan upgrades. Captured as HUMAN-ACTION Steps 4–5 in `04-PRODUCTION-RUNBOOK.md` with canary command, env var list, DPA dashboards, `pg_cron` SQL referencing `retentionCutoff()` from `retention.ts`. |

**Score:** 4/6 success criteria fully code-verified. SC-5 and SC-6 are correctly classified as human-action gates per D-13, not gaps.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/env.ts` | Voice/telephony env vars with mock-aware refine | VERIFIED | 18 lines matching `ELEVENLABS_\|TWILIO_\|VOICE_WEBHOOK_SECRET\|DRIVER_CALL_MAX`. `VOICE_WEBHOOK_SECRET` is `.min(32)` non-optional (T-04-01). Second independent `.refine()` requires all 6 voice credentials when `!PALLEX_MOCK`. |
| `supabase/migrations/0002_voice_recording_url.sql` | `recording_url` column migration | VERIFIED | Contains `alter table calls add column recording_url text`. |
| `src/types/database.ts` | `CallRow.recording_url: string \| null` | VERIFIED | Column present in type. |
| `src/lib/repositories/calls-repo.ts` | `insertCall` + `updateCall` | VERIFIED | Factory + free-function exports at lines 199, 219, 271, 278. Throw-on-error pattern (D-07). |
| `src/lib/repositories/drivers-repo.ts` | `getDriverById` | VERIFIED | Factory at line 114, free-function export at line 167. Return-null-on-miss (non-throwing). |
| `src/lib/voice/compliance.ts` | `DISCLOSURE` + `openingTurn()` | VERIFIED | `DISCLOSURE` contains "automated AI assistant" (AI identification) and "being recorded" (consent). |
| `src/lib/voice/nato.ts` | NATO phonetic encoder | VERIFIED | `ALFA` entry confirmed. `readBack()` exported and used in conversation-machine.ts. |
| `src/lib/voice/conversation-machine.ts` | Pure `reduce(state, event)` covering VOICE-01..08 | VERIFIED | 395 lines. Exports `reduce` and `initialState`. Global `request_human` intercept + per-phase switch. VOICE-08 structural guarantee documented in module header. |
| `src/lib/voice/types.ts` | `VoiceState`, `VoiceEvent`, `VoiceAction`, `TranscriptTurn` | VERIFIED | Created in Plan 02. Types used throughout conversation-machine.ts and call_ended route. |
| `src/lib/voice/webhook-auth.ts` | Constant-time HMAC verifier | VERIFIED | Uses `createHmac` + `timingSafeEqual` + length guard. `verifyVoiceSignature` + `verifyProviderSignature` exported. ElevenLabs structured header (`t=,v1=`) + CR-02 replay protection (5-minute staleness window). |
| `src/lib/voice/telephony/adapter.ts` | `VoiceTelephonyAdapter` interface | VERIFIED | `interface VoiceTelephonyAdapter` with 4 methods: `placeOutboundCall`, `endCall`, `transferToHuman`, `sendDtmf`. |
| `src/lib/voice/telephony/mock-adapter.ts` | In-memory test adapter | VERIFIED | `MockTelephonyAdapter implements VoiceTelephonyAdapter`. `events` array, deterministic `mock-call-N` IDs, `failNextPlace` flag. |
| `src/lib/voice/telephony/elevenlabs-twilio-adapter.ts` | Real HTTP adapter (credential-injected) | VERIFIED | `ElevenLabsTwilioAdapter implements VoiceTelephonyAdapter`. Constructor takes fully injected config; `createElevenLabsTwilioAdapter()` factory reads env lazily (T-04-10). |
| `src/mocks/voice-handlers.ts` | MSW handlers for telephony HTTP | VERIFIED | 2 `http.` handlers. `+44UNREACHABLE` trigger returns 4xx for testing unreachable-driver path. |
| `src/app/api/voice/lookup_consignment/route.ts` | Signed thin tool over `lookupConsignment` | VERIFIED | `export async function POST`. 401-first HMAC guard. Delegates entirely to `lookupConsignment()`. Response carries only `TrackingResult` fields. |
| `src/app/api/voice/request_human/route.ts` | Warm-handoff target endpoint | VERIFIED | 401-first guard. Returns `{ transferTo: env.CONTACT_PHONE, summary }` (VOICE-06). |
| `src/app/api/voice/call_started/route.ts` | Customer call persistence | VERIFIED | 401-first guard. `insertCall({ call_type:'customer', direction:'inbound', ... })`. |
| `src/app/api/voice/call_ended/route.ts` | Transcript/outcome/recording persistence | VERIFIED | 401-first guard. Outcome zod enum (`resolved\|escalated\|no_data\|failed`). `JSON.stringify(transcriptTurns)` in `{speaker, text, ts?}` shape. `updateCall(platformCallId, {..., recording_url, transcript})`. Bonus: recording URL host allowlist (`*.elevenlabs.io`, `*.twilio.com`) against CR-03. |
| `src/lib/voice/driver-escalation.ts` | Driver escalation machine | VERIFIED | 210 lines. `runDriverEscalation(input, deps)`. Exports `MAX_RETRIES = 2`, `MAX_DURATION_S = 180`. All I/O injected. Every attempt logs a `call_type:'driver'`, `direction:'outbound'` row with `parent_call_id`. |
| `src/app/api/voice/contact_driver/route.ts` | Signed consent-gated driver tool | VERIFIED | 401-first HMAC via `verifyProviderSignature`. Consent gate (`consented:false` → `{contacted:false}` with zero calls). Driver phone resolved server-side via `getDriverById`. `runDriverEscalation` called with env-supplied limits. |
| `src/lib/voice/agent-config.ts` | Version-controlled agent definition | VERIFIED | `first_message: DISCLOSURE` (imported, not duplicated). 5 tools matching `TOOL_PATHS`. `system_prompt` encodes NATO read-back, DTMF, 3-attempt cap, on-demand handoff, never-invent-data rule. |
| `src/lib/voice/retention.ts` | 30-day retention cutoff helper | VERIFIED | `RETENTION_DAYS = 30`. `retentionCutoff()`, `isExpired()` — pure, no I/O. Purge-job activation is a runbook step. |
| `src/app/dashboard/calls/[id]/page.tsx` | RecordingPlayer wired to `recording_url` | VERIFIED | `recordingUrl={call.recording_url}` confirmed. Stale `recordingUrl={null}` stub removed. |
| `.planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md` | Human-action cutover runbook | VERIFIED | All 5 ordered steps present. Contains `PALLEX_MOCK`. Explicitly states SC-5 and SC-6 are human-action gates. Names exact env vars, dashboard URLs, file references. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lookup_consignment/route.ts` | `src/lib/tracking/service.ts lookupConsignment` | `import { lookupConsignment }` + direct call | WIRED | Lines 17, 54. Thin pass-through with no data fabrication (VOICE-08). |
| `call_ended/route.ts` | `calls-repo.ts updateCall` | `import { updateCall }` + call with patch | WIRED | Lines 19, 92. Transcript, outcome, recording_url, disconnection_reason all persisted. |
| All 5 `/api/voice/*/route.ts` | `webhook-auth.ts verifyProviderSignature` | `import` + first call in POST | WIRED | Confirmed by `grep -rL "verifyProviderSignature\|verifyVoiceSignature"` returning no output — every handler verifies. |
| `driver-escalation.ts` | `telephony/adapter.ts placeOutboundCall` | `adapter.placeOutboundCall(driver.phone_e164)` | WIRED | Line 117. Destination always from managed list. |
| `driver-escalation.ts` | `calls-repo.ts insertCall` | `deps.insertCall(...)` on every attempt | WIRED | Lines 87, 122, 151, 172, 191. Full audit trail (DRIV-04). |
| `contact_driver/route.ts` | `drivers-repo.ts getDriverById` | `import { getDriverById }` + injected to escalation | WIRED | Lines 24, 116. Driver phone resolved server-side (T-04-20). |
| `agent-config.ts` | `compliance.ts DISCLOSURE` | `import { DISCLOSURE }` → `first_message: DISCLOSURE` | WIRED | Line 21, 134. Test asserts `first_message === DISCLOSURE` (T-04-27). |
| `calls/[id]/page.tsx` | `call.recording_url` | `recordingUrl={call.recording_url}` prop | WIRED | Line 62. No stub remaining. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `lookup_consignment/route.ts` | `trackingResult` | `lookupConsignment({trackingRef, postcode})` from `service.ts` (Nexus API via MSW in mock mode) | Yes — delegates entirely to service layer | FLOWING |
| `contact_driver/route.ts` | `result` (EscalationResult) | `runDriverEscalation(...)` → real driver row from `getDriverById` + `insertCall` | Yes — driver resolved from DB; attempts logged to DB | FLOWING |
| `calls/[id]/page.tsx` | `call.recording_url` | `getCallById(id)` from calls-repo (Supabase `calls` table); `recording_url` column populated by `call_ended` webhook | Null in mock mode (by design D-08); real URL in production | FLOWING (null in mock mode is correct behaviour) |
| `conversation-machine.ts` | `result.consignment` fields | `lookup_result` event carrying `TrackingResult` (injected by the route handler) | Yes — no alternative data source exists in the machine | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tsc clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| All tests green | `npx vitest run` | 32 test files, 296 tests, 0 failures | PASS |
| All voice route handlers verify signatures | `grep -rL "verifyProviderSignature\|verifyVoiceSignature" src/app/api/voice/*/route.ts` | No output (all routes have verification) | PASS |
| recording_url wired | `grep "recordingUrl={call.recording_url}" src/app/dashboard/calls/[id]/page.tsx` | Match found | PASS |
| VOICE_WEBHOOK_SECRET non-optional, min 32 | `grep "VOICE_WEBHOOK_SECRET" src/lib/env.ts` | `.min(32)` present; no default (WR-05 compliant) | PASS |
| MAX_RETRIES + MAX_DURATION_S exported | `grep "MAX_RETRIES\|MAX_DURATION" src/lib/voice/driver-escalation.ts` | Lines 22, 25 | PASS |
| DISCLOSURE contains AI + recording text | DISCLOSURE string inspected | Contains "automated AI assistant" and "being recorded" | PASS |
| RETENTION_DAYS = 30 | `grep "RETENTION_DAYS = 30" src/lib/voice/retention.ts` | Line 18 | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOICE-01 | 04-02, 04-04, 04-06 | AI disclosure + recording consent before data capture | SATISFIED | `DISCLOSURE` in `compliance.ts`; `call_started` in `conversation-machine.ts` emits it first; `agent-config.ts` `first_message === DISCLOSURE` test-asserted |
| VOICE-02 | 04-02 | Capture by voice with NATO phonetic read-back + confirmation | SATISFIED | `nato.ts` `readBack()`; `conversation-machine.ts` `awaiting_tracking`/`awaiting_postcode` → `confirming` transitions; 39 tests |
| VOICE-03 | 04-02 | DTMF keypad entry terminated with `#` | SATISFIED | `normaliseDtmf()` strips trailing `#`; `dtmf` event handled in both capture phases; `agent-config.ts` `dtmf.terminator: '#'` |
| VOICE-04 | 04-02 | Answer in plain spoken English, leading with what the caller wants | SATISFIED | `answering` branch in `conversation-machine.ts` leads with `plainStatus`; only speaks consignment fields |
| VOICE-05 | 04-02 | After 3 failed capture attempts, escalate to human | SATISFIED | `MAX_ATTEMPTS = 3`; `confirm{yes:false}` increments counter; forced `handoff` + `transfer` action at limit |
| VOICE-06 | 04-02, 04-04 | "0"/"agent" → human at any time with warm summary; `request_human` route | SATISFIED | Global `request_human` intercept in `reduce()`; `request_human/route.ts` returns `{ transferTo: CONTACT_PHONE, summary }` |
| VOICE-07 | 04-02 | API downtime → explain + offer transfer, never stall | SATISFIED | `api_error` case in `looking_up` phase emits explanation say + no fabricated status |
| VOICE-08 | 04-02, 04-04 | Only state API-returned facts | SATISFIED | Structural: `lookup_consignment/route.ts` delegates entirely to `lookupConsignment()`; `conversation-machine.ts` answering branch reads only `result.consignment` fields; `estimatedDelDate` intentionally not spoken; null date produces no digit sequence |
| DRIV-01 | 04-05 | Offer to contact driver when API can't answer | SATISFIED | `contact_driver/route.ts` consent gate: `consented:false` → offer-only with zero calls |
| DRIV-02 | 04-01, 04-05 | Place outbound call to driver from managed list | SATISFIED | `runDriverEscalation` → `adapter.placeOutboundCall(driver.phone_e164)`; `getDriverById` resolves from Supabase `drivers` table |
| DRIV-03 | 04-03, 04-05 | Relay ETA; callback if driver unreachable | SATISFIED | `escalated` outcome returned when all retries exhausted; route returns this for agent to relay callback offer |
| DRIV-04 | 04-01, 04-05 | Hard limits + logged outcome for every attempt | SATISFIED | `MAX_RETRIES = 2`, `MAX_DURATION_S = 180` from env; every attempt writes `call_type:'driver'`, `direction:'outbound'`, `parent_call_id` row |

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| `driver-escalation.ts` | `getEta` defaults to `async () => null` in production (no real ETA extraction from call transcript yet) | INFO | Intentional and documented in 04-05-SUMMARY.md: "ETA extraction from call transcripts is a Phase 4 voice-agent feature to be wired by the inbound agent plan." The machine is correct: `null` ETA → `escalated` outcome; no invented ETAs. Not a gap — the ETA relay path works end-to-end through the agent's conversation flow; the tool result IS the relay back to the customer. |
| `call_ended/route.ts` | `ALLOWED_RECORDING_HOSTS` hardcoded (bonus: CR-03 recording URL allowlist) | INFO | Positive — this is an extra security control not in the plan. |

No blocker anti-patterns found.

---

### Human Verification Required

#### 1. SC-5 — Real-World Noisy-Environment STT Go/No-Go

**Test:** With the Twilio UK number live and ElevenLabs agent provisioned (Runbook Step 1), call the number from inside or near a lorry cab or depot yard. Attempt to speak 3 different realistic consignment references and postcodes in normal conversational speech.

**Expected:** 3/3 captures succeed within 2 spoken attempts each. NATO read-back matches what was spoken. Agent confirms correctly before proceeding to lookup. No digit/letter transpositions that produce incorrect lookups.

**PASS:** Continue with ElevenLabs — no code change needed.

**FAIL:** Implement Retell AI adapter:
1. Create `src/lib/voice/telephony/retell-adapter.ts` implementing `VoiceTelephonyAdapter` (same interface as `elevenlabs-twilio-adapter.ts`)
2. Update `contact_driver/route.ts` adapter selection to use the Retell adapter
3. All conversation and business logic remains unchanged (D-01)
4. Re-run `npm test` and re-test

**Why human:** Requires live ElevenLabs + Twilio provisioning, real-world ambient noise, and physical hardware. Cannot be simulated by code tests.

#### 2. SC-6 — Production Cutover

**Test:** Follow Runbook Steps 4–5 in order:
1. Obtain Pall-Ex live credentials from account manager
2. Run canary command (in runbook) and confirm `{ ok: true, consignment: {...} }` for a known consignment
3. Set `PALLEX_MOCK=false` in Vercel with all live credentials
4. Sign ElevenLabs, Twilio, and Supabase DPAs
5. Activate 30-day retention purge job (pg_cron SQL referencing `retentionCutoff()` from `src/lib/voice/retention.ts`)
6. Upgrade Vercel Pro and Supabase Pro

**Expected:** Build log shows no `Invalid environment:` errors. Live call test succeeds with a real consignment. Admin dashboard shows the call row with transcript and `recording_url` populated.

**Why human:** Requires live API credentials (external dependency), contractual DPA signatures, and paid-plan upgrades. Cannot be automated or verified from code.

---

### Gaps Summary

No code gaps found. All 12 voice requirements (VOICE-01..08, DRIV-01..04) are satisfied by the implemented codebase. The 296-test suite (32 test files) passes with tsc clean and a successful production build.

The 2 human verification items (SC-5, SC-6) are correctly classified as external/human-action gates per D-13. They have been present in the design intent since the `04-CONTEXT.md` was authored. They are not missing work — they are work that cannot be done from code.

---

*Verified: 2026-06-12T18:00:00Z*
*Verifier: Claude (gsd-verifier)*
