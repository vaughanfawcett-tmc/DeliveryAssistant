# Roadmap: Delivery Assistance Agent

**Project:** Delivery Assistance Agent — Derby Aggs / Pall-Ex
**Core Value:** A customer can find out where their delivery is — accurately, in under a minute, without a human — by web or by phone.

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-06-12) — see `milestones/v1.0-ROADMAP.md`

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-06-12</summary>

- [x] Phase 1: Foundation (4/4 plans) — Pall-Ex integration layer, DB schema, mock mode (API-01..07)
- [x] Phase 2: Tracking Portal (4/4 plans) — mobile-first customer lookup (PORT-01..08)
- [x] Phase 3: Admin Dashboard (4/4 plans) — auth, metrics, call history, driver CRUD (ADMIN-01..07)
- [x] Phase 4: Voice Agent + Production (6/6 plans) — inbound agent, driver escalation, mock-first build + production runbook (VOICE-01..08, DRIV-01..04)

Full detail archived in `milestones/v1.0-ROADMAP.md`. Audit: `milestones/v1.0-MILESTONE-AUDIT.md`.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-06-12 |
| 2. Tracking Portal | v1.0 | 4/4 | Complete | 2026-06-12 |
| 3. Admin Dashboard | v1.0 | 4/4 | Complete | 2026-06-12 |
| 4. Voice Agent + Production | v1.0 | 6/6 | Complete | 2026-06-12 |

---

## Next Milestone

The v1.0 software is feature-complete against mock mode. The remaining work to go live is the **production cutover** (external/human steps, see `04-PRODUCTION-RUNBOOK.md`): provision ElevenLabs Agent + Twilio UK number, run the SC-5 real-world noise STT go/no-go, and execute the SC-6 live Pall-Ex canary (flip `PALLEX_MOCK=false`) with DPAs signed, the 30-day retention purge job activated, and Vercel/Supabase Pro enabled.

Start the next milestone with `/gsd-new-milestone`.
