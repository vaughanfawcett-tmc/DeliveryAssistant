# Architecture Research

**Domain:** Multi-channel delivery tracking system (web portal + AI voice agent + admin dashboard)
**Researched:** 2026-06-11
**Confidence:** HIGH (core patterns) / MEDIUM (voice platform specifics — platform choice not yet finalised)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Web Tracking    │  │  Voice Platform  │  │  Admin Dashboard     │  │
│  │  Portal          │  │  (Retell/Vapi)   │  │  (Next.js)           │  │
│  │  (Next.js)       │  │  Telephony edge  │  │                      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
└───────────┼──────────────────────┼─────────────────────────┼────────────┘
            │ HTTPS                │ WebSocket / HTTPS        │ HTTPS
            │                      │ (tool calls)             │
┌───────────┼──────────────────────┼─────────────────────────┼────────────┐
│           │      BACKEND API LAYER (single Node.js / Next.js service)   │
│  ┌────────▼──────────────────────▼─────────────────────────▼───────┐    │
│  │                      API Router                                   │    │
│  │  POST /api/track          GET /api/track/:ref                    │    │
│  │  POST /api/voice/tool     POST /api/webhooks/call-event          │    │
│  │  GET  /api/admin/*        POST /api/drivers/*                    │    │
│  └────────┬────────────────────────────────────────────────────────┘    │
│           │                                                               │
│  ┌────────▼────────────────────────────────────────────────────────┐    │
│  │                  Service Layer                                    │    │
│  │  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐   │    │
│  │  │  Tracking    │  │  Nexus API     │  │  Call Pipeline     │   │    │
│  │  │  Service     │  │  Client        │  │  Service           │   │    │
│  │  │              │  │  (JWT + cache  │  │                    │   │    │
│  │  │  - lookup    │  │   + circuit    │  │  - webhook ingest  │   │    │
│  │  │  - postcode  │  │   breaker)     │  │  - call storage    │   │    │
│  │  │    verify    │  │                │  │  - metrics agg     │   │    │
│  │  │  - response  │  │  - bearerToken │  │                    │   │    │
│  │  │    shaping   │  │  - refresh     │  │                    │   │    │
│  │  └──────┬───────┘  └──────┬─────────┘  └────────┬───────────┘   │    │
│  │         │                 │                      │               │    │
│  │  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │    │
│  │  │              Outbound Call Orchestrator                    │  │    │
│  │  │  (trigger driver call, hold original, relay result)       │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
            │                      │                       │
┌───────────▼──────────────────────▼───────────────────────▼────────────┐
│                        DATA LAYER                                       │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────┐    │
│  │  PostgreSQL   │  │  Redis / Memory  │  │  Pall-Ex Nexus       │    │
│  │               │  │  Cache           │  │  REST API (external) │    │
│  │  - calls      │  │                  │  │                      │    │
│  │  - drivers    │  │  - consignment   │  │  POST /Account/login │    │
│  │  - portal_    │  │    status        │  │  GET  /Consignments  │    │
│  │    lookups    │  │  - bearer token  │  │                      │    │
│  └───────────────┘  └──────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Web Tracking Portal | Customer-facing UI; collect tracking ref + postcode, display status milestones | Next.js App Router, server components for first render |
| Voice Platform Edge | Telephony, STT, TTS; calls backend tool endpoints mid-conversation | Retell AI or Vapi (platform decision pending) |
| Admin Dashboard | Call metrics, call history, driver management, shared-password login | Next.js App Router, same monorepo as portal |
| API Router | Route HTTP/WebSocket tool calls to services; auth middleware | Next.js Route Handlers or Express/Fastify |
| Tracking Service | Orchestrate lookup + postcode verify + channel-specific response shaping | Service module, no framework dependency |
| Nexus API Client | JWT lifecycle, retry/backoff, circuit breaker, response caching, mock mode | Singleton class, opossum circuit breaker |
| Call Pipeline Service | Receive post-call webhooks, persist call records, aggregate metrics | Route handler + DB writer |
| Outbound Call Orchestrator | Trigger driver call mid-conversation, relay result back to voice agent | Service module, calls voice platform REST API |
| PostgreSQL | Persistent store for calls, drivers, portal lookups | Postgres 16+, Prisma ORM |
| Redis / In-process cache | Short-TTL consignment cache; bearer token store | Redis for multi-instance, node-cache for single instance |

---

## Recommended Project Structure

```
delivery-assistant/
├── apps/
│   ├── web/                    # Customer tracking portal (Next.js)
│   │   ├── app/
│   │   │   ├── track/          # /track route — tracking form + results
│   │   │   └── layout.tsx
│   │   └── package.json
│   ├── admin/                  # Admin dashboard (Next.js)
│   │   ├── app/
│   │   │   ├── dashboard/      # Metrics overview
│   │   │   ├── calls/          # Call history table
│   │   │   └── drivers/        # Driver management
│   │   └── package.json
│   └── api/                    # Backend API (Next.js Route Handlers or standalone)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── track.ts        # POST /api/track
│       │   │   ├── voice-tool.ts   # POST /api/voice/tool  (voice agent calls this)
│       │   │   ├── webhooks/
│       │   │   │   └── call-event.ts  # POST /api/webhooks/call-event
│       │   │   └── admin/
│       │   │       ├── calls.ts
│       │   │       └── drivers.ts
│       │   ├── services/
│       │   │   ├── tracking.ts         # Lookup + postcode verify + shaping
│       │   │   ├── nexus-client.ts     # JWT lifecycle + circuit breaker
│       │   │   ├── call-pipeline.ts    # Webhook ingest + DB write
│       │   │   └── outbound-caller.ts  # Driver call orchestration
│       │   ├── lib/
│       │   │   ├── cache.ts            # Redis or in-process TTL cache
│       │   │   ├── circuit-breaker.ts  # opossum wrapper
│       │   │   └── mock-nexus.ts       # Mock responses during dev
│       │   └── db/
│       │       ├── schema.prisma
│       │       └── migrations/
│       └── package.json
├── packages/
│   └── shared/                 # Types, constants shared across apps
│       ├── types/
│       │   ├── consignment.ts
│       │   ├── call.ts
│       │   └── driver.ts
│       └── package.json
├── turbo.json
└── package.json
```

### Structure Rationale

- **apps/api:** All three channels (web portal, voice agent tool calls, admin dashboard) share one backend. This avoids duplicating the Nexus JWT lifecycle, caching, and circuit-breaker logic.
- **apps/web + apps/admin:** Separate Next.js apps so they can have independent deployments, auth strategies, and bundle optimisations. They share a common type library.
- **packages/shared:** Consignment, call, and driver types defined once, imported everywhere. TypeScript compiler catches divergence early.
- **Monorepo (Turborepo):** Low overhead for a small team; enables `turbo build` / `turbo dev` to spin everything up together. Easier than a polyrepo at this scale.

---

## Architectural Patterns

### Pattern 1: Single Shared Tracking Service (both web and voice call the same endpoint)

**What:** A single `POST /api/track` endpoint handles lookups for both the web portal and the voice agent's tool call. The `channel` field in the request body (`"web"` or `"voice"`) determines response shaping — the web response returns structured JSON with status objects and milestone arrays; the voice response returns a `spokenSummary` string pre-formatted for TTS.

**When to use:** Any time two or more channels need the same underlying data. Centralises the postcode-verification logic, caching, and error handling in one place.

**Trade-offs:** Slightly more complexity in one service vs simpler but duplicated services. Worth it here because postcode verification and Nexus error handling must behave identically across channels.

**Example:**
```typescript
// POST /api/track
// Body: { trackingRef: string, postcode: string, channel: 'web' | 'voice' }

const result = await trackingService.lookup({ trackingRef, postcode });

if (channel === 'voice') {
  return { spokenSummary: shapeForVoice(result) };
} else {
  return { consignment: shapeForWeb(result) };
}
```

The voice platform calls this endpoint as a "server tool" / custom tool call during the live conversation. Retell AI sends a `POST` to the registered tool URL with arguments extracted by the LLM; the endpoint responds with JSON that the agent incorporates into its spoken reply.

### Pattern 2: Nexus API Client as a Singleton with JWT State Machine

**What:** The Nexus client is a singleton module that holds the bearer token + refresh token in memory (or Redis for multi-instance). It implements a state machine: `UNAUTHENTICATED → AUTHENTICATED → TOKEN_EXPIRED → REFRESHING → AUTHENTICATED`. All callers await a single in-flight login or refresh — no thundering-herd re-login on expiry.

**When to use:** Any external API with short-lived auth tokens where multiple in-flight requests will race on expiry.

**Trade-offs:** More complex than a simple per-request auth header, but necessary given the 1-hour bearer token lifetime and concurrent voice + web requests hitting the same service.

**Example:**
```typescript
class NexusClient {
  private bearerToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshPromise: Promise<void> | null = null;

  async getToken(): Promise<string> {
    if (this.isTokenValid()) return this.bearerToken!;
    if (this.refreshPromise) return this.refreshPromise.then(() => this.bearerToken!);
    this.refreshPromise = this.login().finally(() => (this.refreshPromise = null));
    await this.refreshPromise;
    return this.bearerToken!;
  }
}
```

Bearer tokens should be treated as expiring at 55 minutes (5-minute safety margin) to avoid mid-request expiry. Refresh tokens (24h) trigger a full re-login, not a refresh-token exchange — the Nexus API uses username/password re-login, not a dedicated refresh endpoint.

### Pattern 3: Circuit Breaker Around Nexus Calls (opossum)

**What:** Wrap every outbound Nexus HTTP call in an opossum circuit breaker. When the Nexus API is down or slow, the circuit opens after a threshold of failures and returns a cached stale response (or a "service currently unavailable" error) immediately rather than queuing calls that will time out.

**When to use:** Any integration with an external API that can fail independently of your service. Mandatory here because Nexus downtime must not cascade into voice agent timeouts (which cause call drops).

**Trade-offs:** Adds complexity; requires deciding on thresholds (50% failure rate, 10-second volume threshold, 30-second half-open timeout are sensible defaults for this use case).

**Example:**
```typescript
import CircuitBreaker from 'opossum';

const nexusBreaker = new CircuitBreaker(nexusHttpCall, {
  timeout: 5000,          // fail after 5s
  errorThresholdPercentage: 50,
  resetTimeout: 30000,    // try again after 30s
  volumeThreshold: 5,     // need 5 calls before opening
});

nexusBreaker.fallback(() => getCachedStaleResponse() ?? { error: 'tracking_unavailable' });
```

**Graceful degradation tiers:**
1. Cache hit → return cached data (no Nexus call needed)
2. Cache miss + circuit closed → call Nexus, cache result
3. Cache miss + circuit open → return stale cache if available, else return service-unavailable response that voice agent converts to: "I can't retrieve your tracking information right now. The freight network system is temporarily unavailable."

### Pattern 4: Mock Mode for Development Without Credentials

**What:** An environment flag (`NEXUS_MOCK=true`) routes all Nexus client calls to a local mock module that returns fixture responses matching the real API spec. The mock implements the same response shape, including `status.name`, `estimatedDelDate`, `delAddressPostcode`, etc.

**When to use:** During development before Pall-Ex credentials are issued. Also useful in CI for deterministic tests.

**Trade-offs:** Requires maintaining fixture data that reflects the real API. Accept this cost — it unblocks all development tracks in parallel.

**Example:**
```typescript
// lib/mock-nexus.ts
export const mockConsignment = {
  consignmentNumber: 'DA-TEST-001',
  status: { name: 'In Transit' },
  estimatedDelDate: '2026-06-12',
  startWindow: '08:00',
  endWindow: '12:00',
  delAddressPostcode: 'DE1 1AA',
};
```

---

## Data Flow

### Web Portal Tracking Flow

```
Customer enters tracking ref + postcode
    ↓
Next.js Server Action / API call → POST /api/track { ref, postcode, channel: 'web' }
    ↓
Tracking Service: normalise ref, verify postcode format
    ↓
Cache check (Redis/in-process) — key: consignment:${ref}
    ↓ (miss)
Nexus API Client: GET /Consignments?searchTerm=${ref}
    ↓
Postcode verification: compare supplied vs delAddressPostcode (case-insensitive, strip spaces)
    ↓ (match)
Shape response for web: structured milestones + ETA
    ↓
Cache write (TTL: 2 minutes)
    ↓
Return JSON → Portal renders status UI
```

### Voice Agent Tool Call Flow

```
Customer calls phone number → Voice Platform answers
    ↓
Voice Platform STT: transcribe "my tracking number is DA12345, postcode DE1 1AA"
    ↓
LLM extracts { trackingRef: "DA12345", postcode: "DE1 1AA" }
    ↓
LLM triggers tool call → POST /api/voice/tool
  { tool: "lookup_tracking", args: { trackingRef, postcode } }
    ↓
(same Tracking Service path as web, but channel: 'voice')
    ↓
Response: { spokenSummary: "Your delivery is currently in transit and is expected between 8am and noon on Thursday." }
    ↓
Voice Platform TTS: speaks spokenSummary to customer
```

### Post-Call Webhook → Database Flow

```
Call ends on Voice Platform
    ↓
Voice Platform sends POST /api/webhooks/call-event
  event: 'call_ended'
  payload: { call_id, from_number, start_timestamp, end_timestamp,
             disconnection_reason, transcript, metadata }
    ↓
call_analyzed event follows (after platform-side analysis)
  adds: call_analysis { tracking_ref_discussed, outcome, etc. }
    ↓
Call Pipeline Service:
  - Validate HMAC signature on webhook
  - Upsert calls record (call_id as idempotency key)
  - Extract tracking_ref from metadata (injected at call start) or transcript NLP
  - Write portal_lookups record if channel='web'
    ↓
Admin Dashboard queries PostgreSQL
  - Aggregate metrics (count, success rate, avg duration) via SQL GROUP BY
  - Call history list with filters
```

### Outbound Driver Call Flow (Mid-Conversation Escalation)

```
Customer: "Can you give me an exact ETA? The driver's usually earlier."
    ↓
LLM decides: API data insufficient, trigger driver lookup
LLM calls tool: { tool: "call_driver", args: { reason: "customer ETA query" } }
    ↓
POST /api/voice/tool { tool: "call_driver", ... }
    ↓
Outbound Call Orchestrator:
  1. Look up driver phone number from DB (route today → driver assignment, or duty driver fallback)
  2. Call Voice Platform REST API: POST /calls { to: driverNumber, agent: driverQueryAgent }
  3. Return intermediate response to voice agent:
     { spokenSummary: "I'm just calling the driver now — please bear with me for a moment." }
    ↓
Voice agent speaks holding message to customer
    ↓ (async — driver call in progress)
Driver picks up → second voice agent instance asks scripted question
  "Hi, this is the Derby Aggs automated assistant. A customer is asking about delivery
   reference DA12345 to DE1 1AA. Can you give me an estimated arrival time?"
    ↓
Driver responds → STT → platform webhook delivers transcript/result
    ↓
Option A (SYNC — conference/warm-transfer):
  Voice Platform merges the two calls (conference bridge)
  Customer hears driver directly, or transfer assistant relays answer
  Original agent resumes after bridge ends
    ↓
Option B (ASYNC — callback):
  Driver call result stored in DB (keyed to original call_id)
  Original agent polls /api/voice/tool { tool: "get_driver_result", call_id }
  Agent relays result once available, or escalates to human if driver unavailable
```

**Sync vs Async trade-offs:**

| Aspect | Sync (conference/warm-transfer) | Async (callback/polling) |
|--------|----------------------------------|--------------------------|
| Customer experience | Seamless — hears live driver answer | Slight pause; agent relays result |
| Implementation complexity | HIGH — requires platform conference bridge support | MEDIUM — polling loop or webhook pair |
| Driver availability risk | Customer waits on hold while phone rings | Agent can give interim answer while waiting |
| Platform dependency | Vapi warm-transfer (Twilio-only); Retell transfer features | Works on any platform via REST API |
| Recommended for v1 | No — too many failure modes | Yes — more controllable |

**Recommendation:** Implement async for v1. The voice agent speaks a holding phrase, the backend initiates the outbound call separately, receives the result via transcript webhook (or times out after 45 seconds), then the agent resumes with either the driver's answer or an apology + human escalation offer.

---

## Data Model

### `consignment_cache`
Short-lived cache backing; use Redis TTL rather than a DB table. Key: `consignment:{ref}`. TTL: 120 seconds. This prevents hammering Nexus during a burst of calls about the same popular delivery.

Why 120 seconds: consignment status changes infrequently (scan events at depot/vehicle transitions). A 2-minute window is a negligible staleness risk but dramatically reduces Nexus call volume in a small-team deployment.

### `calls`
```sql
CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_call_id  TEXT UNIQUE NOT NULL,     -- voice platform's call_id
  from_number     TEXT,                        -- customer caller ID (may be withheld)
  direction       TEXT NOT NULL,              -- 'inbound' | 'outbound'
  call_type       TEXT NOT NULL,              -- 'customer' | 'driver'
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  duration_ms     INTEGER,
  outcome         TEXT,                        -- 'resolved' | 'escalated' | 'no_data' | 'failed'
  tracking_ref    TEXT,                        -- consignment number discussed (null if not captured)
  transcript      TEXT,                        -- full transcript (may be large)
  disconnection_reason TEXT,
  parent_call_id  UUID REFERENCES calls(id),  -- for driver calls linked to a customer call
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX calls_start_at_idx ON calls (start_at DESC);
CREATE INDEX calls_tracking_ref_idx ON calls (tracking_ref);
```

### `drivers`
```sql
CREATE TABLE drivers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone_e164  TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### `portal_lookups`
```sql
CREATE TABLE portal_lookups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_ref  TEXT NOT NULL,
  postcode      TEXT NOT NULL,
  success       BOOLEAN NOT NULL,    -- false = postcode mismatch, no result, or API error
  failure_reason TEXT,               -- 'postcode_mismatch' | 'not_found' | 'api_error'
  looked_up_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX portal_lookups_looked_up_at_idx ON portal_lookups (looked_up_at DESC);
```

**Metrics derivable from these tables (no separate metrics store needed at v1 scale):**
- Total calls in period: `COUNT(*) WHERE direction='inbound' AND call_type='customer'`
- Success rate: `COUNT(*) WHERE outcome='resolved' / COUNT(*)`
- Average call duration: `AVG(duration_ms)`
- Portal completion rate: `COUNT(*) WHERE success=true / COUNT(*) FROM portal_lookups`
- Calls per day: `date_trunc('day', start_at) GROUP BY 1`

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Pall-Ex Nexus REST API | HTTP client (axios), JWT singleton, opossum circuit breaker | bearerToken 1h / refreshToken 24h; no dedicated refresh endpoint — re-login required. Mock mode during dev |
| Voice Platform (Retell/Vapi) | Webhook receiver (POST /api/webhooks/call-event); REST API caller (outbound call initiation) | Platform emits call_started, call_ended, call_analyzed events. Validate HMAC on inbound webhooks |
| Voice Platform Tool Calls | Backend HTTP endpoint that platform POSTs to mid-call | POST /api/voice/tool — must respond within 5–10s to avoid voice agent timeout. Return spokenSummary for TTS |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web Portal ↔ API | HTTPS Server Actions or fetch to /api/track | Portal is a Next.js app; can use Server Actions to call the same service directly if co-located |
| Voice Platform ↔ API | HTTPS POST (tool calls and webhooks) | Must be publicly routable. Use ngrok/cloudflare tunnel during dev |
| Admin Dashboard ↔ API | HTTPS (authenticated with shared session cookie) | Simple shared-password session; bcrypt-hash the password in DB |
| API ↔ PostgreSQL | Prisma ORM (connection pool) | Single connection pool; PgBouncer not needed at v1 scale |
| API ↔ Cache | node-cache (in-process, single instance) or Redis (multi-instance) | Start with in-process; add Redis if horizontal scaling needed |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–100 calls/day | Single API server, in-process cache, no Redis needed. One Postgres instance. Fully adequate for v1 |
| 100–1k calls/day | Add Redis for token + consignment cache (avoids cache cold-starts on restarts). Add read replica for analytics queries |
| 1k+ calls/day | Separate voice tool endpoint onto its own process to isolate from admin/web latency. Add queue (BullMQ) for webhook processing so burst ingest does not block responses |

### Scaling Priorities

1. **First bottleneck:** Nexus API rate limits and token expiry under concurrent voice calls. Fix: shared token cache (Redis) + circuit breaker already in plan.
2. **Second bottleneck:** Postgres query time on the calls table as history grows. Fix: index on `start_at DESC`; archive old calls after 90 days; add `LIMIT` + cursor pagination to admin queries.

---

## Anti-Patterns

### Anti-Pattern 1: Each Channel Implements Its Own Nexus Integration

**What people do:** Build the voice tool endpoint and web API independently; each has its own Nexus HTTP calls, its own token management, its own error handling.

**Why it's wrong:** Token expiry races cause duplicate login calls. Cache miss rate doubles. Postcode verification logic drifts between channels. Two places to fix when Nexus changes its response schema.

**Do this instead:** Single Nexus client singleton, single Tracking Service, both channels call the same endpoint with a `channel` discriminator.

### Anti-Pattern 2: Caching Consignment Data for Too Long (or Not At All)

**What people do:** Either skip caching entirely (every tool call hits Nexus = rate limit risk + latency) or cache for 30+ minutes (staleness risk if a scan event fires mid-delivery day).

**Why it's wrong:** Nexus is a third-party API with unknown rate limits. Stale data annoys customers who see "Out for Delivery" hours after delivery completes.

**Do this instead:** 120-second TTL. Aggressive enough to prevent call storms; short enough that a scan event within a few minutes will be reflected on retry.

### Anti-Pattern 3: Storing Full Transcripts Only in the Voice Platform's Dashboard

**What people do:** Rely on Retell/Vapi's own call logs. Don't persist transcripts in your own DB.

**Why it's wrong:** Platform retention policies vary. Admin dashboard requires transcript access for filtering and compliance. Losing access if you change platforms.

**Do this instead:** Persist transcript text in the `calls` table via the post-call webhook. The platform sends the full transcript in the `call_analyzed` payload — store it. Apply truncation only if size becomes a DB concern (unlikely at v1 scale).

### Anti-Pattern 4: Initiating the Driver Call Synchronously Inside the Tool-Call Response

**What people do:** Tool call arrives, backend calls driver via voice platform API, then waits for driver call to complete before returning the tool-call response. This means the tool call blocks for however long it takes the driver to answer (or not).

**Why it's wrong:** Voice platform tool calls have hard timeouts (typically 5–10 seconds). A driver not answering immediately causes a timeout → agent error → call drops.

**Do this instead:** Return immediately from the tool call with a holding phrase ("I'm connecting with the driver now"). Initiate the outbound call asynchronously. When the driver call ends and its webhook arrives (keyed by the original call_id stored in metadata), store the result. If the customer's call is still active, the agent's next tool call fetches the result.

---

## Suggested Build Order

Dependencies drive the order. Later components build on earlier ones.

```
1. Nexus API Client (mock mode)
   ↓ all other components depend on tracking data
2. Tracking Service (lookup + postcode verify + response shaping)
   ↓ web portal and voice tool both need this
3. Database schema (Prisma migrations: calls, drivers, portal_lookups)
   ↓ call pipeline and admin need schema
4. Web Tracking Portal
   ↓ validates tracking service and Nexus mock end-to-end in a user-visible way
5. Voice Agent Tool Endpoint (/api/voice/tool)
   ↓ voice platform can now call the tracking service
6. Voice Platform Configuration (agent prompt, tool registration, phone number)
   ↓ connects live telephony to the tool endpoint
7. Call Pipeline (webhook receiver, DB write)
   ↓ produces the data the admin dashboard reads
8. Admin Dashboard (metrics, call history)
   ↓ reads from calls table populated by pipeline
9. Driver Management (CRUD in admin)
   ↓ required before outbound calling is usable
10. Outbound Call Orchestrator (driver escalation)
    ↓ depends on driver phone numbers in DB and voice platform outbound API
11. Swap mock Nexus for live credentials (external dependency — unblocks only after Pall-Ex issues credentials)
```

**Key dependency flags for roadmap:**
- Steps 1–4 are unblocked immediately (no external dependencies).
- Steps 5–6 require a voice platform account and phone number purchased/configured.
- Step 11 is gated on Pall-Ex credential issuance and should be tracked as an external milestone blocker.
- Steps 9–10 (driver calling) are the most complex feature; schedule for a phase after voice agent is stable and call pipeline is proven.

---

## Sources

- [Vapi Dynamic Call Transfers](https://docs.vapi.ai/calls/call-dynamic-transfers) — transfer architecture, warm transfer modes
- [Vapi Assistant-Based Warm Transfer](https://docs.vapi.ai/calls/assistant-based-warm-transfer) — conference bridge mechanism, hold state
- [Vapi Outbound Calling](https://docs.vapi.ai/calls/outbound-calling) — outbound call initiation API
- [Retell AI Webhook Overview](https://docs.retellai.com/features/webhook-overview) — call_started, call_ended, call_analyzed payload schema
- [Retell AI Outbound Calls](https://docs.retellai.com/deploy/outbound-call) — outbound call API, dynamic variables
- [Retell AI Function Calling](https://docs.retellai.com/integrate-llm/integrate-function-calling) — mid-call tool call architecture
- [Opossum GitHub (nodeshift)](https://github.com/nodeshift/opossum) — circuit breaker for Node.js (v9.0.0, June 2025, Node 20+)
- [Node.js Circuit Breaker Pattern in Production](https://dev.to/axiom_agent/nodejs-circuit-breaker-pattern-in-production-opossum-fallbacks-and-resilience-engineering-1mj4)
- [Voice AI Agent Architecture Pipeline](https://www.bitbytes.io/blog/ai-voice-speech-tools/ai-voice-agent-architecture-pipeline) — streaming pipeline overview
- [AI Voice Agent Webhook Integration Guide](https://leapingai.com/blog/ai-voice-agent-webhook-integration-a-complete-setup-guide)
- [JWT Token Lifecycle Management](https://skycloak.io/blog/jwt-token-lifecycle-management-expiration-refresh-revocation-strategies/)
- [Modern Full Stack Application Architecture Using Next.js 15+](https://softwaremill.com/modern-full-stack-application-architecture-using-next-js-15/)
- [A Practical Monorepo Architecture with Next.js, Fastify, Prisma, and NGINX](https://stajic.de/blog/a-practical-monorepo-architecture-next-js-platform-admin-fastify-api-prisma-and-nginx)

---
*Architecture research for: Delivery Assistance Agent (Derby Aggs)*
*Researched: 2026-06-11*
