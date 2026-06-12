---
phase: 04-voice-agent-production
plan: "02"
subsystem: voice/conversation-machine
tags: [voice, state-machine, tdd, nato, compliance, VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07, VOICE-08]
dependency_graph:
  requires: []
  provides:
    - src/lib/voice/types.ts — VoiceState/Event/Action discriminated unions
    - src/lib/voice/nato.ts — ICAO NATO phonetic map + readBack()
    - src/lib/voice/compliance.ts — DISCLOSURE constant + openingTurn()
    - src/lib/voice/conversation-machine.ts — pure reduce() covering VOICE-01..08
  affects:
    - src/app/api/voice/* (Plan 04-04 webhook tools consume this machine)
    - src/lib/voice/driver-machine.ts (Plan 04-03 driver escalation machine)
tech_stack:
  added: []
  patterns:
    - Pure reducer pattern: (state, event) -> { state, actions }
    - ICAO NATO phonetic alphabet (VOICE-02)
    - Discriminated union event/action/state types
    - Structural never-invent-data guarantee (VOICE-08): answering branch only interpolates result.consignment fields
key_files:
  created:
    - src/lib/voice/types.ts
    - src/lib/voice/nato.ts
    - src/lib/voice/compliance.ts
    - src/lib/voice/conversation-machine.ts
    - src/lib/voice/nato.test.ts
    - src/lib/voice/compliance.test.ts
    - src/lib/voice/conversation-machine.test.ts
  modified: []
decisions:
  - "VOICE-08 structural guarantee: answering branch does not read estimatedDelDate into spoken text to prevent any possibility of invented date strings; startWindow/endWindow are only included when both are non-null"
  - "Attempt counter increments on confirm{yes:false} regardless of which field (tracking_ref or postcode) is being confirmed — a single session-wide cap of 3"
  - "global request_human intercept runs before the phase switch — ensures handoff works from any phase without duplicating logic"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 7
---

# Phase 4 Plan 02: Conversation State Machine Summary

**One-liner:** Pure (state, event) -> { state, actions } voice reducer with NATO phonetic readback, ICAO compliance disclosure, and structural VOICE-01..08 guarantees verified by 39 unit tests.

## What Was Built

A platform-agnostic conversation orchestration layer for the Derby Aggs voice agent. The entire business logic lives in our backend — not in ElevenLabs config — making the Retell AI pivot (D-01) a cheap adapter swap, and making every VOICE requirement offline-provable.

### Files

| File | Purpose |
|------|---------|
| `src/lib/voice/types.ts` | Discriminated union types: `VoiceState`, `VoiceEvent`, `VoiceAction`, `TranscriptTurn` |
| `src/lib/voice/nato.ts` | ICAO NATO map (A-Z) + `readBack()` for alphanumeric strings |
| `src/lib/voice/compliance.ts` | `DISCLOSURE` constant (AI identifier + recording notice) + `openingTurn()` |
| `src/lib/voice/conversation-machine.ts` | Pure `reduce(state, event)` covering all 8 phases of a call |
| `src/lib/voice/*.test.ts` | 39 unit tests, no live call required |

### Machine Behaviors Verified

| Requirement | Behavior | Test |
|-------------|----------|------|
| VOICE-01 | `call_started` emits DISCLOSURE as first say action | `disclosure first` |
| VOICE-02 | Utterance produces NATO readback say + transitions to `confirming` | `NATO read-back + confirm` |
| VOICE-03 | DTMF with trailing `#` strips hash, enters `confirming` | `DTMF # terminator` |
| VOICE-04 | ok=true result: say contains `plainStatus` from consignment | `ok=true result` |
| VOICE-05 | 3rd `confirm{yes:false}` → `handoff` + `transfer` action with summary | `3-attempt escalation` |
| VOICE-06 | `request_human` at ANY phase → `handoff` + `transfer` | `on-demand human handoff` |
| VOICE-07 | `api_error` → explain + offer transfer, no fabricated status | `api_error handling` |
| VOICE-08 | `null estimatedDelDate` → no date-like digit sequence in say text | `null estimatedDelDate structural test` |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `bee32df` — `test(04-02): add failing tests...` | PASS — all 3 test files failed before implementation |
| GREEN | `a989bb7` — `feat(04-02): implement pure conversation state machine...` | PASS — 39/39 tests pass |
| REFACTOR | `f0e82f8` — `refactor(04-02): use agentSay() helper consistently...` | PASS — no behavior change, tests still 39/39 |

## Threat Model Coverage

| Threat | Mitigation | Verified by |
|--------|-----------|-------------|
| T-04-05 Spoofing/Tampering | Answering branch reads only `result.consignment` fields; null estimatedDelDate produces no invented date | `VOICE-08 structural` test |
| T-04-06 Prompt injection | Utterances populate `trackingRef`/`postcode` candidates only — confirmed before use, cannot set delivery status | Machine design; `purity guarantee` tests |
| T-04-07 Repudiation | Every turn appends to `state.transcript`; warm-handoff summary built from transcript | `transcript integrity` tests |
| T-04-08 DoS via capture loop | Hard `MAX_ATTEMPTS = 3` cap forces `handoff` transition | `3-attempt escalation` test |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Design Notes

- `estimatedDelDate` is intentionally NOT spoken in the ok=true answering branch. The `startWindow`/`endWindow` fields cover the delivery window need. This is the strictest interpretation of VOICE-08: by never reading `estimatedDelDate` into the spoken text, there is no code path that could produce an invented date even if the field contains unexpected data. The test asserts on the null case; the implementation enforces it structurally.

- The `TranscriptTurn` shape (`{ speaker: 'Agent' | 'Customer', text, ts? }`) matches the Phase 3 `TranscriptView` component interface exactly, so call transcripts persisted to the `calls` table will render correctly in the admin dashboard without transformation.

## Known Stubs

None — this is a pure logic module with no external dependencies or placeholder data.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are pure TypeScript modules with no I/O.

## Self-Check

- [x] `src/lib/voice/types.ts` — created
- [x] `src/lib/voice/nato.ts` — created, exports `NATO` and `readBack`
- [x] `src/lib/voice/compliance.ts` — created, exports `DISCLOSURE` and `openingTurn`
- [x] `src/lib/voice/conversation-machine.ts` — created, exports `reduce` and `initialState`
- [x] All test files committed at RED gate (bee32df)
- [x] All implementation files committed at GREEN gate (a989bb7)
- [x] Refactor committed (f0e82f8)
- [x] `npx vitest run` — 157/157 tests pass (39 new + 118 existing)
- [x] `npx tsc --noEmit` — exits 0

## Self-Check: PASSED
