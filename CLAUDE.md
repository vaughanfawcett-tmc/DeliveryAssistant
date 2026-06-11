# Delivery Assistance Agent

Delivery tracking self-service for Derby Aggs: customer web tracking portal, AI voice agent (inbound customer line + outbound driver escalation calls), and an admin dashboard — all built on the Pall-Ex Nexus REST API (v2.2.1).

**Core value:** A customer can find out where their delivery is — accurately, in under a minute, without a human — by web or by phone.

## GSD Workflow

This project is managed with GSD (Get Shit Done). Planning artifacts live in `.planning/`:

- `.planning/PROJECT.md` — project context, requirements status, key decisions
- `.planning/REQUIREMENTS.md` — v1 requirements with REQ-IDs and traceability
- `.planning/ROADMAP.md` — 4-phase roadmap with success criteria
- `.planning/STATE.md` — current position and project memory
- `.planning/research/` — stack, features, architecture, and pitfalls research

**Workflow rules:**
- Use GSD commands for phase work: `/gsd-discuss-phase N` → `/gsd-plan-phase N` → `/gsd-execute-phase N`
- Check `/gsd-progress` to see current position and next action
- Do not hand-edit `.planning/` state files outside GSD commands
- Mode: YOLO (auto-approve), coarse granularity, parallel plan execution
- Research, plan-check, and verifier agents are all enabled

## Key Technical Decisions (from research)

- **Stack:** Next.js 15 (App Router) + Supabase (Postgres) + Vercel; Upstash Redis for Pall-Ex token caching; MSW for Nexus API mock mode
- **Voice platform:** ElevenLabs Agents (Scribe v2 Realtime STT, Twilio UK number) — Retell AI is the fallback pivot if the noisy-audio alphanumeric capture go/no-go test fails
- **Pall-Ex auth:** username/password → bearer token (1h) + refresh token (24h); single-flight refresh pattern is mandatory to avoid 401 races under concurrent calls
- **Live credentials pending:** all development runs against mock mode until Pall-Ex issues API credentials (external dependency, swapped in Phase 4 via canary test)
- **Compliance:** call recording consent announcement at call start; GDPR retention schedules (30-day recordings); driver phone numbers are personal data

## Phases

1. **Foundation** — Pall-Ex integration layer, DB schema, mock mode (API-01..07)
2. **Tracking Portal** — customer web lookup, mobile-first (PORT-01..08)
3. **Admin Dashboard** — metrics, call history, transcripts, driver CRUD (ADMIN-01..07)
4. **Voice Agent + Production** — inbound agent, driver escalation, live credentials (VOICE-01..08, DRIV-01..04)

Phases 2 and 3 are independent and can run in parallel after Phase 1.
