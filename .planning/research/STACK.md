# Stack Research

**Domain:** AI Voice Agent + Customer Tracking Portal + Admin Dashboard (Pall-Ex integration)
**Researched:** 2026-06-11
**Confidence:** HIGH (voice platform pricing verified via official pricing pages; STT accuracy benchmarks from official ElevenLabs/Deepgram sources; hosting costs from official provider pages)

---

## Voice AI Platform Decision (Critical)

### Comparison Matrix

| Criterion | ElevenLabs Agents | Vapi | Retell AI | Raw Twilio + DIY |
|-----------|------------------|------|-----------|-----------------|
| **STT models available** | Own Scribe v2 Realtime only (selectable in Advanced config) | Deepgram Nova-3, Azure, AssemblyAI, custom | Deepgram (default), Azure, Soniox | Any (Deepgram, Whisper, Azure, etc.) |
| **Noisy audio accuracy** | Scribe v2 Realtime: 93.5% on FLEURS benchmark; claims lowest WER of any low-latency ASR; mu-law telephony codec support; internal benchmarks strong but limited independent verification | Deepgram Nova-3: 92% clean, 78% conference, 65% mobile-with-noise (Deepgram own benchmarks); STT provider choice is yours — you can pick the best | Deepgram Nova-3 default + Azure auto-failover mid-call; real-world UK deployments cited as reliable | Fully in your control; Deepgram Nova-3 is the telephony gold standard |
| **Alphanumeric / tracking number capture** | No native DTMF digit-collection tool; DTMF for IVR navigation only (play tones outbound); multimodal chat fallback exists; agent prompting required for spelling confirmation flows | Keypad input plan (DTMF digit collection from caller); well-documented; custom transcriber option | Listen to User Keypad Input: callers enter digits via keypad, captured in transcript; DTMF inputs included in transcript — best native support | Full control via Twilio <Gather> verb; most flexible |
| **All-in cost per minute** | ~$0.08–0.10/min (Scribe included; LLM currently absorbed but will be passed through; no separate telephony if you own Twilio number) | ~$0.13–0.25/min (Vapi $0.05 + Deepgram ~$0.01 + LLM ~$0.02–0.06 + TTS ~$0.04 + telephony ~$0.015) | ~$0.11–0.22/min ($0.07 voice engine + Deepgram STT ~$0.01 + LLM ~$0.006–0.06 + TTS varies + telephony $0.015) | ~$0.08–0.15/min but requires significant dev time to build orchestration |
| **UK phone number** | Via Twilio integration (you buy Twilio UK number) or SIP trunk; ElevenLabs itself does not provision numbers | Via Twilio integration; you buy Twilio UK number | UK available ($0.10/min outbound via Twilio); can purchase UK inbound number through Retell dashboard | Native Twilio UK numbers — most straightforward |
| **Outbound calling** | Yes — batch calling API + single outbound call API; requires Twilio or SIP trunk connected | Yes — full outbound call API; programmatic trigger mid-conversation via tool call | Yes — API-triggered outbound calls; batch campaigns supported | Yes — Twilio REST API |
| **Mid-conversation escalation / transfer** | Built-in `transfer_to_number` system tool; conference, blind, or SIP REFER transfer types; warm transfer message to human agent supported | Dynamic call transfers via tool calling; full transcript passed to routing server; warm handoff with context summary | Warm transfer with human detection, whisper message, three-way intro; built-in call transfer node in conversation flow | Manual implementation required |
| **Post-call webhooks / analytics** | `post_call_transcription` webhook: full transcript, `call_successful`, `call_duration_secs`, conversation ID, extracted data, audio metadata | `call-analysis` webhook; call summary, structured evaluation, minutesUsed; assistant hooks for in-call events | Webhook on call events; post-call analysis (Boolean/Text/Number/Enum fields); basic transcript, latency, summary | Custom — you build what you need |
| **Server tools (mid-call API)** | Yes — webhook tools with dynamic path/query/body params; agent calls your backend mid-conversation; custom auth headers supported | Yes — function calling with server-side execution; most mature tooling ecosystem | Yes — function calls / custom LLM + tools during conversation | Full control |
| **DX / time to production** | Good — no-code dashboard + API; Twilio setup adds one step | Good — developer-first but more moving parts | Very good — production-ready telephony focus; strong UK deployment track record | Poor — you build STT → LLM → TTS pipeline yourself |
| **Latency (end-to-end)** | ~900ms median (pipeline overhead vs competitors) | ~500–750ms | ~580–800ms | Depends on your stack |

### Pricing at Target Volumes

**Assumptions:** 500 calls/month × 2 min avg = 1,000 min/month; 2,000 calls/month × 2 min = 4,000 min/month

**ElevenLabs Agents (Creator plan $11/month, 275 min included, overage ~$0.08/min):**
- 500 calls: 1,000 min → 275 included + 725 overage @ $0.08 = $69/month (plan + overage)
- 2,000 calls: 4,000 min → $11 + 3,725 × $0.08 = ~$309/month
- Note: LLM costs currently absorbed but flagged for future pass-through; Twilio adds ~$0.013/min (~$13–52/month)

**Vapi (Build plan, pay-as-you-go):**
- 500 calls: 1,000 min @ ~$0.18 blended = ~$180/month
- 2,000 calls: 4,000 min @ ~$0.18 = ~$720/month

**Retell AI (usage-based, no mandatory subscription):**
- 500 calls: 1,000 min @ ~$0.17 blended (Deepgram STT + GPT-4o-mini LLM + ElevenLabs TTS + telephony) = ~$170/month
- 2,000 calls: 4,000 min = ~$680/month

**Raw Twilio + Deepgram + OpenAI TTS:**
- Components: Deepgram ~$0.0059/min, Twilio ~$0.0130/min, OpenAI TTS ~$0.015/min, GPT-4o-mini ~$0.006/min ≈ $0.034/min platform cost + significant dev build time
- 500 calls: ~$34/month but weeks of engineering to build reliably

### Recommendation: ElevenLabs Agents

**Recommendation: ElevenLabs Agents — Confidence: MEDIUM-HIGH**

ElevenLabs is the right choice for this project for the following verified reasons:

1. **Scribe v2 Realtime is purpose-built for the agent use case** and is optionally selectable in the Advanced configuration. It supports mu-law telephony codec encoding (matching Twilio's 8kHz format), achieves 93.5% accuracy on the FLEURS multilingual benchmark, and was specifically described by ElevenLabs as outperforming Deepgram Nova-3 in real-time accuracy benchmarks. It handles breaths, filler words, and environmental noise better than older models. Published November 2025 — current.

2. **Cheapest all-in cost at this volume.** At 500 calls/month (1,000 min), ElevenLabs Agents costs roughly £55–60/month all-in (plan + Twilio), versus ~£140 for Vapi or Retell with equivalent model quality. At 2,000 calls/month the gap widens further.

3. **All required capabilities are present**: outbound calling via Twilio API, `transfer_to_number` system tool for warm human escalation, server/webhook tools for mid-conversation Pall-Ex API calls, and post-call `post_call_transcription` webhooks with full transcript + `call_successful` + `call_duration_secs` fields — exactly what the admin dashboard needs.

4. **DTMF caveat**: ElevenLabs' DTMF tooling is for the agent to play tones outward (navigating IVRs). For the caller entering a tracking number by keypad, ElevenLabs does not have a native "collect digits" DTMF tool comparable to Retell's. The mitigation is: prompt the agent to ask callers to spell out the tracking number letter-by-letter ("say each character separately"), and use Scribe v2 Realtime's accuracy to capture it. This is a known pattern for alphanumeric capture with LLM-based agents. If keypad fallback is considered critical, Retell AI has a native digit-collection tool. Assess this during the voice agent build phase.

5. **UK phone numbers**: Connect a Twilio UK number (available from Twilio's UK inventory) to ElevenLabs via the native Twilio integration. This adds one setup step but is well-documented and the integration is maintained by both Twilio and ElevenLabs.

**Why not Vapi:** More expensive at this scale; Vapi's orchestration-layer model means you pay Vapi + every underlying provider separately. Better suited to teams needing to mix-and-match 6+ providers at scale.

**Why not Retell AI:** Retell has excellent DTMF digit-collection and a strong UK enterprise reputation, and is a legitimate second choice if ElevenLabs' alphanumeric-by-voice accuracy proves insufficient in real-world noisy testing. However, at this volume it costs 3–4x more, and ElevenLabs' Scribe v2 Realtime accuracy claims are strong. Revisit if noisy-environment testing in Phase 2 shows unacceptable error rates.

**Why not raw Twilio DIY:** The engineering cost to build and maintain a reliable STT → LLM → TTS pipeline with proper turn detection, barge-in handling, and telephony state management is 4–6 weeks of work. Not justified for a project of this size.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **ElevenLabs Agents** | Current (Scribe v2 Realtime) | Voice AI agent platform (inbound + outbound phone calls) | Best STT accuracy at this price point; all required features (server tools, post-call webhooks, transfer, outbound) verified present; cheapest all-in cost at 500–2,000 calls/month |
| **Twilio** | Current | UK phone number provisioning + telephony transport | ElevenLabs' native integration partner; UK numbers readily available; used for both inbound agent number and outbound calling from agent |
| **Next.js** | 15 (App Router) | Full-stack framework: customer tracking portal + admin dashboard + backend API routes | Single framework covers all three surfaces (public portal, admin dashboard, API); App Router server components reduce client JS; API routes handle Pall-Ex proxy + ElevenLabs webhook ingestion; Vercel deployment is zero-config |
| **Supabase** | Current (Postgres 15) | Database + Auth | Managed Postgres free tier; built-in row-level security; simple auth for shared admin password via Supabase Auth; no separate auth library needed; 500 MB free tier is sufficient for this project's data volume; paused-on-inactivity only affects dev, not prod (Pro plan at $25/mo when going live) |
| **Vercel** | Current | Hosting (Next.js + API routes) | Zero-config Next.js deployment; free Hobby tier is non-commercial only — use Pro ($20/mo) for this client project; global CDN; auto-preview deployments per PR |
| **Upstash Redis** | Current | Token cache for Pall-Ex bearer JWT (1h TTL) + optional API response cache | HTTP-native Redis; works from Vercel serverless functions without TCP connection issues; free tier (500K commands/month) covers this project's volume; TTL-based expiry maps directly to 1h bearer / 24h refresh token lifecycle |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@elevenlabs/elevenlabs-js` | Latest | ElevenLabs SDK for Node.js | Server-side: trigger outbound calls, fetch conversation history for admin dashboard, post-call webhook validation |
| `twilio` | Latest | Twilio Node.js SDK | Not strictly needed (ElevenLabs native integration handles most telephony); only needed if you need to programmatically buy/configure numbers or handle Twilio status callbacks directly |
| `@supabase/supabase-js` | Latest | Supabase client | All database reads/writes; use server-side client in Next.js Server Components and Route Handlers; never expose service role key to client |
| `@supabase/ssr` | Latest | Supabase auth in Next.js App Router | Cookie-based session management; required for App Router compatibility |
| `@upstash/redis` | Latest | HTTP Redis client for Vercel serverless | Pall-Ex JWT caching; no `ioredis` (TCP) — Upstash Redis HTTP client only, required for serverless |
| `zod` | 3.x | Runtime validation | Validate Pall-Ex API responses against expected schema; validate webhook payloads from ElevenLabs; validate form inputs |
| `next-auth` | 5.x (Auth.js) | Optional: session management | Only needed if Supabase Auth is too opinionated; Supabase Auth is simpler for a shared-password dashboard — prefer Supabase Auth |
| `shadcn/ui` | Latest | Admin dashboard component library | Accessible, unstyled-by-default Radix UI components with Tailwind; standard for Next.js dashboards in 2025/2026 |
| `recharts` | 2.x | Call metrics charts in admin dashboard | Lightweight React chart library; renders call volume, success rate, duration histograms |
| `date-fns` | 3.x | Date formatting | Format ETA windows, call timestamps; no moment.js |
| `msw` | 2.x | Mock Service Worker — Pall-Ex API mock | Intercepts fetch at the network level; mock mode for development before Pall-Ex credentials arrive; works in both Node.js (API route tests) and browser (portal dev) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript | 5.x | Type safety across all layers | Strict mode; type the Pall-Ex API response shapes from the spec PDF; type ElevenLabs webhook payloads |
| ESLint + Prettier | Current | Code quality | Next.js default ESLint config + `eslint-config-next` |
| Playwright | Latest | E2E tests for tracking portal | Test the happy path: enter tracking number + postcode → see delivery status |
| Vitest | Latest | Unit tests for backend logic | Test token lifecycle manager, postcode comparison, mock API integration |
| Ngrok / Cloudflare Tunnel | Current | Local webhook development | ElevenLabs post-call webhooks require a public URL; use ngrok or `cloudflared tunnel` to expose local Next.js for development |

---

## Installation

```bash
# Create Next.js app
npx create-next-app@latest delivery-assistant --typescript --tailwind --eslint --app --src-dir

# Database + Auth
npm install @supabase/supabase-js @supabase/ssr

# Redis cache (serverless-safe)
npm install @upstash/redis

# Voice platform
npm install @elevenlabs/elevenlabs-js

# UI components
npx shadcn@latest init
npm install recharts date-fns

# Validation
npm install zod

# Dev / test
npm install -D msw vitest @playwright/test @types/node
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| ElevenLabs Agents | Retell AI | If ElevenLabs' voice-only alphanumeric capture proves unreliable in real-world noisy testing — Retell has native DTMF digit collection. Budget will be 3–4x higher. |
| ElevenLabs Agents | Vapi | If you need to mix multiple STT/LLM/TTS providers on a per-call basis, or if your team wants maximum provider flexibility. More expensive at this volume. |
| Supabase | Neon (serverless Postgres) | If you don't need Supabase Auth and want a pure serverless Postgres with DB branching per PR. Neon is slightly cheaper at low usage and integrates natively with Vercel Postgres. Use Neon if you plan to use a separate auth solution. |
| Upstash Redis | In-process memory (Map/LRU) | Acceptable only if running a single, always-on server instance. Vercel serverless functions are stateless and restart between requests — in-process caching will cause excessive Pall-Ex re-authentication. Upstash is required for serverless. |
| shadcn/ui | Mantine / Chakra UI | If you need a fully-featured component library with less configuration. shadcn/ui is lighter and more composable for a focused dashboard. |
| Vercel Pro | Railway | If monthly costs need to be reduced further at higher scale, or if you add services (e.g., a background worker for webhook processing) that don't fit Vercel's serverless model. Railway runs containers; approximately same price at this project size. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Raw Twilio + DIY STT/LLM/TTS pipeline** | 4–6 weeks of engineering to build turn detection, barge-in, session state, latency optimisation; ongoing maintenance burden; not justified for a project of this scale | ElevenLabs Agents (wraps all of this) |
| **Whisper (OpenAI) for real-time STT** | Whisper is a batch model; its real-time streaming variant reaches 71% WER at 0dB SNR under noise — inadequate for vehicle cabs/yards; not designed for telephony | Deepgram Nova-3 (if using Retell/Vapi) or ElevenLabs Scribe v2 Realtime |
| **ioredis on Vercel** | ioredis uses TCP connections which conflict with Vercel's serverless execution model (functions close before TCP connections drain); causes intermittent connection errors | @upstash/redis (HTTP-based, stateless) |
| **Vercel Hobby plan for production** | Hobby plan is explicitly for personal/non-commercial use; 10-second function timeout (insufficient for voice webhook processing); no commercial use allowed | Vercel Pro ($20/mo) |
| **Supabase free tier in production** | Projects auto-pause after 7 days of inactivity; first request after pause has cold-start latency; unsuitable for a live customer-facing product | Supabase Pro ($25/mo) — upgrade when going live, not before |
| **moment.js** | 67KB bundle size; no longer maintained; tree-shaking doesn't work well | date-fns (modular, tree-shakeable) |
| **React Query / TanStack Query for all state** | Not necessary for this project's scope; Next.js Server Components fetch data server-side; reserve client-side data fetching for live admin dashboard polling only | Next.js Server Components for initial loads; use `useSWR` or native `fetch` with revalidation for real-time dashboard updates |

---

## Backend Architecture: Pall-Ex API Integration Layer

The Pall-Ex JWT lifecycle is the most delicate backend concern. The token has two states:
- `bearerToken`: 1 hour TTL, used on every API request
- `refreshToken`: 24 hour TTL, used to get a new bearer token without re-authenticating

**Pattern (Next.js Route Handler + Upstash Redis):**

```typescript
// lib/pallexAuth.ts — token lifecycle manager
// 1. On each Pall-Ex API call, check Upstash for cached bearerToken
// 2. If missing/expired, check for cached refreshToken
// 3. If refreshToken valid: POST /Account/refresh → new bearerToken (cache with 55-min TTL)
// 4. If refreshToken missing/expired: POST /Account/login → full re-auth (cache both tokens)
// 5. Never store credentials in Redis; store tokens only
```

TTL strategy: cache bearerToken with 55-minute TTL (5-min buffer before 1h expiry), refreshToken with 23-hour TTL (1-hour buffer before 24h expiry).

**Mock mode**: Use MSW in Node.js mode. Set `PALLEX_MOCK=true` environment variable. MSW intercepts `fetch` calls to the Pall-Ex base URL and returns fixture responses generated from the API spec. Remove MSW handler when `PALLEX_MOCK=false` (production with real credentials). This means the same application code path runs in both mock and real mode.

---

## Stack Patterns by Variant

**Inbound customer call (phone → ElevenLabs Agent → Pall-Ex lookup):**
- Phone call arrives on Twilio UK number
- ElevenLabs agent receives call; Scribe v2 Realtime transcribes speech
- Agent prompts for tracking number + postcode (spell-out flow)
- Agent fires server webhook tool to `POST /api/voice/lookup` (your Next.js Route Handler)
- Route Handler: validate postcode, call Pall-Ex via token lifecycle manager, return delivery status JSON
- Agent speaks the result; `transfer_to_number` available as escalation path
- Post-call: ElevenLabs fires `post_call_transcription` webhook to `POST /api/webhooks/elevenlabs`
- Route Handler: parse transcript + `call_successful` + `call_duration_secs`, upsert row in Supabase `calls` table

**Admin dashboard authentication (shared password):**
- Use Supabase Auth with a single admin user account (email + password)
- No role system required for v1; the single account is the gate
- Next.js middleware checks Supabase session cookie on `/admin/*` routes

**Development without Pall-Ex credentials:**
- Set `PALLEX_MOCK=true`
- MSW fixture returns realistic consignment responses from spec fields
- All tracking portal and voice agent flows testable end-to-end

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15 | React 19, Node.js 18+ | App Router required; Pages Router not needed for new project |
| `@supabase/ssr` latest | Next.js 15 App Router | Required alongside `@supabase/supabase-js`; the older `@supabase/auth-helpers-nextjs` is deprecated |
| `@upstash/redis` latest | Vercel Edge + Node.js runtimes | Works in both; use `@upstash/redis` not `ioredis` on Vercel |
| ElevenLabs Agents Scribe v2 Realtime | ElevenLabs Agents platform | Opt-in under Advanced config; not yet the default STT — must be explicitly selected |
| shadcn/ui latest | Next.js 15 + Tailwind 4 | Tailwind 4 support added in shadcn/ui late 2025; verify CLI generates correct config |
| MSW 2.x | Node.js 18+ and browser | v2 broke v1 API; use `http` handler (not `rest`) in v2 |

---

## Cost Summary

**Monthly running cost at 500 calls/month (MVP validation phase):**

| Service | Cost |
|---------|------|
| ElevenLabs Agents (Creator plan, 275 min + 725 overage @ $0.08) | ~$69 |
| Twilio UK number ($1/mo) + inbound minutes (~$0.01/min × 1,000 min) | ~$11 |
| Vercel Pro | $20 |
| Supabase Pro (upgrade when live) | $25 |
| Upstash Redis (free tier: 500K commands/month) | $0 |
| **Total** | **~$125/month** |

**Monthly running cost at 2,000 calls/month:**

| Service | Cost |
|---------|------|
| ElevenLabs Agents (4,000 min @ ~$0.08 after plan allowance) | ~$309 |
| Twilio UK minutes (4,000 × $0.013) | ~$52 |
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Upstash Redis (still within free tier at this call volume) | $0 |
| **Total** | **~$406/month** |

Note: LLM costs are currently absorbed by ElevenLabs ("will pass through eventually"). When this changes, add approximately $0.01–0.03/min for GPT-4o-mini or Claude Haiku class model, adding $10–120/month at these volumes. Monitor ElevenLabs pricing announcements.

---

## Sources

- [ElevenLabs Agents Pricing](https://elevenlabs.io/pricing/agents) — per-minute costs, plan tiers, included minutes (verified 2026-06-11)
- [ElevenLabs: We cut our pricing for Conversational AI](https://elevenlabs.io/blog/we-cut-our-pricing-for-conversational-ai) — pricing reduction announcement
- [ElevenLabs: Scribe v2 Realtime in ElevenLabs Agents](https://elevenlabs.io/blog/scribe-v2-realtime-in-elevenlabs-agents) — November 2025; opt-in under Advanced config
- [ElevenLabs Post-call Webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks) — verified webhook payload fields including `call_duration_secs`, `call_successful`, transcript
- [ElevenLabs Transfer to Number](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools/transfer-to-human) — warm transfer system tool, conference/blind/SIP REFER types
- [ElevenLabs Twilio Integration](https://elevenlabs.io/agents/integrations/twilio) — UK phone provisioning path via Twilio
- [Retell AI ASR Provider Comparison](https://docs.retellai.com/build/asr-provider-comparison) — Deepgram (default), Azure, Soniox; Deepgram auto-failover to Azure
- [Retell AI International Calling](https://docs.retellai.com/deploy/international-call) — UK: $0.10/min outbound via Twilio
- [Retell AI Pricing](https://www.retellai.com/pricing) — $0.07–0.31/min depending on configuration
- [Vapi Pricing](https://vapi.ai/pricing) — $0.05/min hosting + pass-through provider costs
- [Deepgram Nova-3 Benchmarks](https://deepgram.com/learn/speech-to-text-benchmarks) — 6.84% median WER streaming; 65% accuracy on mobile-with-noise
- [ElevenLabs Scribe v2 Introduction](https://elevenlabs.io/blog/introducing-scribe-v2) — 93.5% FLEURS benchmark; sub-150ms latency
- [Neon Pricing](https://neon.com/pricing) — free tier: 100 CU-hours/month, 0.5 GB storage; $0.35/GB-month storage
- [Supabase Pricing](https://supabase.com/pricing) — Free: 500 MB DB, 50K MAUs; Pro: $25/mo; free projects pause after 7 days inactivity
- [Vercel Pricing](https://vercel.com/pricing) — Hobby: free but non-commercial; Pro: $20/month/developer
- [Upstash Redis Pricing](https://upstash.com/) — Free: 500K commands/month; $0.20 per 100K thereafter
- [Ikki: ElevenLabs vs Vapi vs Retell 2026](https://www.ikki.io/blog/elevenlabs-vs-vapi-vs-retell-2026) — latency benchmarks; 10K min/month pricing comparison (MEDIUM confidence — third-party analysis)
- [Softomatesolutions: Best Voice AI Platforms UK 2026](https://www.softomatesolutions.com/blog/best-ai-call-automation-services-uk/) — UK deployment patterns (MEDIUM confidence)

---

*Stack research for: Delivery Assistance Agent (Derby Aggs / Pall-Ex)*
*Researched: 2026-06-11*
