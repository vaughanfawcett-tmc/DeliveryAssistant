---
phase: 04-voice-agent-production
plan: "06"
subsystem: voice
tags: [agent-config, retention, recording, runbook, compliance]
dependency_graph:
  requires: [04-01, 04-02, 04-04, 04-05]
  provides: [agent-config-as-code, retention-helper, recording-wired, production-runbook]
  affects: [src/lib/voice, src/app/dashboard/calls]
tech_stack:
  added: []
  patterns:
    - Config-as-code (agent definition version-controlled in-repo)
    - Pure retention helper (I/O-free, activation deferred to ops)
key_files:
  created:
    - src/lib/voice/agent-config.ts
    - src/lib/voice/agent-config.test.ts
    - src/lib/voice/retention.ts
    - src/lib/voice/retention.test.ts
    - .planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md
  modified:
    - src/app/dashboard/calls/[id]/page.tsx
decisions:
  - "first_message imports DISCLOSURE constant (never duplicated) — test-asserted equality guarantees T-04-27 across any future compliance copy change"
  - "retention.ts is intentionally I/O-free — purge job activation is a runbook step (D-12), never silent"
  - "recordingUrl stub replaced with call.recording_url; RecordingPlayer null-handling already covers mock mode"
  - "Runbook includes Retell pivot scope note in SC-5 FAIL path so adapter swap is documented and bounded"
metrics:
  duration: "3m 51s"
  completed: "2026-06-12"
  tasks_completed: 3
  files_changed: 6
requirements: [VOICE-01, VOICE-02, VOICE-03, VOICE-05, VOICE-06, VOICE-08, ADMIN-05]
---

# Phase 4 Plan 06: Agent Config, Retention Helper, Recording Wire + Production Runbook Summary

**One-liner:** Version-controlled ElevenLabs agent config (disclosure-first, 5 tools, NATO/capture/never-invent rules), 30-day retention helper, real recording_url wired to dashboard player, and full SC-5/SC-6 production runbook.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Agent config-as-code + retention helper | 2775218 | agent-config.ts, retention.ts + tests |
| 2 | Wire real recording_url to RecordingPlayer | 3248b83 | src/app/dashboard/calls/[id]/page.tsx |
| 3 | Author production runbook | b926dd1 | 04-PRODUCTION-RUNBOOK.md |

---

## What Was Built

### Task 1: Agent config-as-code + retention helper

**`src/lib/voice/agent-config.ts`** exports `agentConfig: AgentConfig` — the version-controlled ElevenLabs agent definition:
- `first_message` imports `DISCLOSURE` from `compliance.ts` directly (never duplicated). Test-asserted equality ensures T-04-27 (AI + recording consent precedes capture) holds wherever the config is deployed.
- `system_prompt` encodes: NATO read-back + confirm before lookup (VOICE-02), DTMF `#` terminator (VOICE-03), 3-attempt cap → warm handoff (VOICE-05), on-demand "0"/"agent" handoff (VOICE-06), never-invent-data / "only state information returned by the tool" rule (VOICE-08 — soft layer; backend tools are the hard guarantee per T-04-24).
- `tools` array: exactly 5 entries with url_paths for `lookup_consignment`, `request_human`, `contact_driver`, `call_started`, `call_ended`.
- `TOOL_PATHS` const exported for grep/test validation.
- `dtmf.terminator: '#'` (VOICE-03).

**`src/lib/voice/retention.ts`** exports:
- `RETENTION_DAYS = 30` — single-source policy value (T-04-26, D-12).
- `retentionCutoff(now?: Date): Date` — returns `now - RETENTION_DAYS days`.
- `isExpired(recordedAt: string, now?: Date): boolean` — returns true when a recording is strictly before the cutoff.
- Pure, no I/O. Activation of the purge job is a runbook/ops step (D-12) — explicitly flagged as such in both code comments and the runbook.

20 tests, all passing.

### Task 2: Wire real recording_url

`src/app/dashboard/calls/[id]/page.tsx`: replaced `recordingUrl={null}` with `recordingUrl={call.recording_url ?? null}`. The `RecordingPlayer` component already handles both cases (real URL → native `<audio>` player; null → "Recording not yet available" copy). The stale "Phase 3 stub" comment was replaced with a D-08 reference note.

### Task 3: Production runbook

`.planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md` — five ordered HUMAN-ACTION steps:

1. **Provision ElevenLabs Agent + Twilio UK number** — upload `agentConfig` from `agent-config.ts`, buy number, note Agent ID + webhook signing secret.
2. **Set webhook URLs, secrets, env vars** — all 7 voice-related env vars listed with Vercel dashboard steps.
3. **SC-5 noise go/no-go** — lorry cab/yard STT accuracy test; PASS → ElevenLabs; FAIL → Retell pivot (swap `elevenlabs-twilio-adapter.ts` only, conversation logic unchanged).
4. **SC-6a Pall-Ex live canary + PALLEX_MOCK=false flip** — canary command provided; rollback = set `PALLEX_MOCK=true`.
5. **SC-6b DPAs + retention purge job + Vercel/Supabase Pro** — ElevenLabs/Twilio/Supabase DPA steps, `pg_cron` SQL referencing `retentionCutoff()`, Pro upgrade rationale.

Each step names exact env var names, dashboard URLs, and file references.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-04-24 — Tampering (agent system_prompt) | Mitigated — never-invent-data phrase in prompt; structural guarantee in backend tools |
| T-04-25 — Information disclosure (recording_url) | Accepted — page behind iron-session admin gate (Phase 3 middleware); URL is provider-signed + staff-only |
| T-04-26 — Repudiation/compliance (retention helper) | Mitigated — RETENTION_DAYS=30 + helper present; purge-job activation documented in runbook as HUMAN-ACTION |
| T-04-27 — Spoofing (agent first_message) | Mitigated — test-asserted `first_message === DISCLOSURE` |

No new security-relevant surface introduced by this plan.

---

## Human Sign-Off Items

### PENDING HUMAN SIGN-OFF: Task 3 production runbook review

**Type:** checkpoint:human-verify  
**What to verify:**
1. Open `.planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md`
2. Confirm all five external/human steps are present, ordered, and each names exact env vars / files / dashboards.
3. Confirm it explicitly states SC-5 (noise go/no-go) and SC-6 (live cutover) are human-action gates, not code.
4. Run: `grep -q "PALLEX_MOCK" .planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md && echo OK`

This item is tracked as UAT pending human sign-off. The autonomous code deliverables (Tasks 1 and 2) are complete and verified.

---

## Verification Results

- `npx vitest run src/lib/voice/agent-config.test.ts src/lib/voice/retention.test.ts` — 20/20 PASS
- `npx tsc --noEmit` — exit 0
- `grep -q "recordingUrl={call.recording_url}" src/app/dashboard/calls/[id]/page.tsx` — MATCH
- `grep -q "PALLEX_MOCK" .planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md` — MATCH

## Self-Check: PASSED

All claimed files exist and commits are present in git log:
- `src/lib/voice/agent-config.ts` — created, commit 2775218
- `src/lib/voice/retention.ts` — created, commit 2775218
- `src/app/dashboard/calls/[id]/page.tsx` — modified, commit 3248b83
- `.planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md` — created, commit b926dd1
