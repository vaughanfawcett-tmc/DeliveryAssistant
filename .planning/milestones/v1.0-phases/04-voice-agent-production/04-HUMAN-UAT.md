---
status: partial
phase: 04-voice-agent-production
source: [04-VERIFICATION.md, 04-PRODUCTION-RUNBOOK.md]
started: 2026-06-12T18:00:00Z
updated: 2026-06-12T18:00:00Z
---

## Current Test

[awaiting human / ops execution — external accounts & live credentials required]

## Tests

### 1. SC-5 — Real-world noisy-audio STT go/no-go
expected: Provision the ElevenLabs Agent + Twilio UK number (runbook §1–2), then test alphanumeric tracking-ref capture accuracy in real lorry-cab / haulage-yard noise. PASS → stay on ElevenLabs. FAIL → swap `src/lib/voice/telephony/elevenlabs-twilio-adapter.ts` for a Retell adapter (conversation logic untouched).
result: [pending — needs live platform + real audio]

### 2. SC-6 — Live Pall-Ex canary + production cutover
expected: Run the Pall-Ex live-credential canary, flip `PALLEX_MOCK=false`, sign DPAs (ElevenLabs / Twilio / Supabase), activate the 30-day retention purge job (pg_cron using `retentionCutoff()` from `src/lib/voice/retention.ts`), and upgrade Vercel Pro + Supabase Pro. Per runbook §4–6.
result: [pending — needs live Pall-Ex credentials, signed contracts, paid plans]

### 3. End-to-end live call smoke test
expected: Call the live UK number; hear AI disclosure + recording consent first; provide a tracking ref + postcode by voice (NATO read-back) and by DTMF; hear an accurate status read-back; trigger the driver-escalation path; request a human ("0"/"agent") and confirm warm handoff. Confirm each call + linked driver sub-call appears in the admin dashboard.
result: [pending — needs live deployment]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

None — all software is built and verified against mock mode + tests. The pending items are external/human-action production-cutover steps (live credentials, paid accounts, real-world audio) that cannot be performed or verified from code. Full step-by-step instructions: `.planning/phases/04-voice-agent-production/04-PRODUCTION-RUNBOOK.md`.
