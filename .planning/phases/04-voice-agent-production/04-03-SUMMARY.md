---
phase: 04-voice-agent-production
plan: "03"
subsystem: voice-telephony
tags: [telephony, msw, mock, elevenlabs, twilio, interface, adapter]
dependency_graph:
  requires: []
  provides:
    - VoiceTelephonyAdapter interface (src/lib/voice/telephony/adapter.ts)
    - MockTelephonyAdapter in-memory implementation (src/lib/voice/telephony/mock-adapter.ts)
    - ElevenLabsTwilioAdapter HTTP shell (src/lib/voice/telephony/elevenlabs-twilio-adapter.ts)
    - MSW voiceHandlers with +44UNREACHABLE trigger (src/mocks/voice-handlers.ts)
  affects:
    - Plan 04-04 (inbound voice route) — can inject adapter via DI
    - Plan 04-05 (driver escalation machine) — uses MockTelephonyAdapter in tests
tech_stack:
  added: []
  patterns:
    - Injected-config adapter pattern (no env reads at import/construction time)
    - MSW handler with lazy base-URL helpers (mirrors existing handlers.ts convention)
    - failNextPlace flag for single-failure simulation in tests
key_files:
  created:
    - src/lib/voice/telephony/adapter.ts
    - src/lib/voice/telephony/mock-adapter.ts
    - src/lib/voice/telephony/mock-adapter.test.ts
    - src/lib/voice/telephony/elevenlabs-twilio-adapter.ts
    - src/lib/voice/telephony/elevenlabs-twilio-adapter.test.ts
    - src/mocks/voice-handlers.ts
    - src/mocks/voice-handlers.test.ts
  modified: []
decisions:
  - "ElevenLabsTwilioAdapter uses fully injected config — createElevenLabsTwilioAdapter() factory reads env lazily so the class is importable in tests without triggering env validation (T-04-10)"
  - "transferToHuman sends summary as X-Transfer-Summary header only (not in TwiML body) to avoid PII appearing in Twilio logs"
  - "MSW Twilio handler uses regex path to match any accountSid, keeping test config decoupled from specific SID format"
metrics:
  duration_minutes: 15
  completed_date: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 0
---

# Phase 04 Plan 03: VoiceTelephonyAdapter + MockAdapter + ElevenLabs/Twilio Shell Summary

**One-liner:** Platform-agnostic telephony interface with in-memory mock (D-01 Retell-pivot insurance) and a credential-injected ElevenLabs/Twilio adapter whose Bearer/Basic auth logic is proven offline via MSW, including a +44UNREACHABLE unreachable-driver trigger.

## Tasks Completed

| # | Name | Commit | Key files |
|---|------|--------|-----------|
| 1 | VoiceTelephonyAdapter interface + MockTelephonyAdapter | 3f24f76 | adapter.ts, mock-adapter.ts, mock-adapter.test.ts |
| 2 | ElevenLabsTwilioAdapter shell + MSW voice handlers | 762d7c2 | elevenlabs-twilio-adapter.ts, voice-handlers.ts + tests |

## What Was Built

### Task 1 — Interface + In-Memory Mock

`VoiceTelephonyAdapter` defines four operations: `placeOutboundCall`, `endCall`, `transferToHuman`, `sendDtmf`. The interface is the only coupling point between business/conversation logic and telephony platforms — swapping Retell for ElevenLabs (or vice versa) requires only a new adapter class.

`MockTelephonyAdapter` records all operations in a public `events` array with deterministic `mock-call-N` IDs. The `failNextPlace` flag lets tests trigger a single dial failure and observe retry/callback logic (DRIV-03) without any real network.

14 unit tests covering: incrementing callIds, event recording for all four ops, failNextPlace single-rejection behaviour, counter reset.

### Task 2 — Real Adapter Shell + MSW Handlers

`ElevenLabsTwilioAdapter` implements the interface with real `fetch` calls:
- `placeOutboundCall` → POST ElevenLabs `/v1/convai/twilio/outbound-call` with `Authorization: Bearer <apiKey>`
- `endCall` → POST ElevenLabs `/…/end` with Bearer auth
- `transferToHuman` → POST Twilio `Calls.json` with TwiML Dial + Basic auth (`base64(sid:token)`)
- `sendDtmf` → POST Twilio `Calls.json` with TwiML Play digits + Basic auth

All env reads are inside `createElevenLabsTwilioAdapter()` factory only — the class constructor takes fully injected config, making it safely importable in tests (T-04-10).

`voiceHandlers` (MSW) covers both endpoints with lazy `elevenLabsBase()`/`twilioBase()` helpers mirroring the existing Pall-Ex handler pattern. The `+44UNREACHABLE` trigger returns 422 from both endpoints, giving Plan 05's escalation machine a reliable offline test path.

18 tests across the two Task 2 files; 19 total test files / 150 tests all green.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints beyond what the plan described. The `ElevenLabsTwilioAdapter` introduces two outbound HTTP surfaces (ElevenLabs + Twilio) already enumerated in the plan's threat model (T-04-09, T-04-10). No additional flags.

## Known Stubs

None. The ElevenLabsTwilioAdapter's `endCall`, `transferToHuman`, and `sendDtmf` are real HTTP implementations. No placeholder data flows to any UI.

## Self-Check: PASSED

- src/lib/voice/telephony/adapter.ts — FOUND
- src/lib/voice/telephony/mock-adapter.ts — FOUND
- src/lib/voice/telephony/mock-adapter.test.ts — FOUND
- src/lib/voice/telephony/elevenlabs-twilio-adapter.ts — FOUND
- src/lib/voice/telephony/elevenlabs-twilio-adapter.test.ts — FOUND
- src/mocks/voice-handlers.ts — FOUND
- src/mocks/voice-handlers.test.ts — FOUND
- Commit 3f24f76 — FOUND
- Commit 762d7c2 — FOUND
- npm test: 19 files, 150 tests — all passed
- npx tsc --noEmit — exit 0
