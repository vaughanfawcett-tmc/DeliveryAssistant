# Derby Aggregates — Delivery Assistant Architecture

Three channels, one delivery-lookup brain, built on Next.js. Everything runs
against a mock of the Pall-Ex Nexus API until live credentials are issued.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  CHANNELS                                      │
│                                                                                │
│   👤 Customer (web)        📞 Customer (voice)        🧑‍✈️ Driver (outbound)        │
│   "where's my delivery?"   "where's my delivery?"     "what's your ETA?"        │
│         │                        │                          ▲                   │
└─────────┼────────────────────────┼──────────────────────────┼───────────────────┘
          │                        │                          │
          │ HTTPS                  │ WebRTC / phone           │ outbound call
          ▼                        ▼                          │ (phase 2)
┌──────────────────────┐   ┌───────────────────────┐         │
│  NEXT.JS FRONTEND     │   │   ELEVENLABS AGENT     │         │
│  (App Router, React)  │   │   "Derby Aggregates    │         │
│                       │   │    Delivery Assistant" │         │
│  • / portal + voice   │   │  • disclosure-first    │         │
│    CTA (VoiceAssistant)│◄──┤  • NATO read-back      │         │
│  • /track/[token]     │   │  • British TTS voice   │         │
│  • /dashboard (admin) │   │  • knowledge base      │         │
│  • /login             │   │  • STT + LLM + TTS     │         │
└──────────┬────────────┘   └───────────┬───────────┘         │
           │                            │                     │
           │ server actions      tools (client tool in browser │
           │ + fetch             / signed webhooks on phone)   │
           ▼                            ▼                     │
┌──────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS BACKEND  (server-only)                          │
│                                                                                │
│   app/actions/lookup.ts          app/api/voice/*                               │
│   (web form submit)              lookup_consignment · demo_lookup ·            │
│        │                         request_human · contact_driver ·              │
│        │                         call_started · call_ended                     │
│        │                              │  (HMAC-verified — webhook-auth.ts)     │
│        ▼                              ▼                                         │
│   ┌──────────────────────────────────────────────┐   ┌──────────────────────┐ │
│   │  Tracking Service  (lib/tracking)            │   │  Voice lib (lib/voice)│ │
│   │  • lookupConsignment()                       │   │  • conversation-machine│ │
│   │  • postcode match gate                       │   │  • agent-config (src)  │ │
│   │  • status → plain-English mapping            │   │  • compliance/disclosure│ │
│   │  • logLookup() → audit                       │   │  • driver-escalation   │ │
│   └───────────────────┬──────────────────────────┘   │  • retention (GDPR)    │ │
│                       │                               │  • telephony adapters  │ │
│                       ▼                               └──────────┬───────────┘ │
│   ┌──────────────────────────────────────────────┐              │             │
│   │  Nexus Client  (lib/nexus)                   │   Admin: lib/repositories  │
│   │  • token-manager (single-flight, cached)     │   calls-repo · drivers-repo│
│   │  • circuit-breaker (closed→open→half-open)   │   lookup-log · metrics     │
│   │  • zod response validation                   │              │             │
│   └───────────────────┬──────────────────────────┘              │             │
└───────────────────────┼─────────────────────────────────────────┼─────────────┘
                        │                                          │
        ┌───────────────┼───────────────┐                         │
        ▼               ▼               ▼                         ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐      ┌────────────────────┐
│ PALL-EX NEXUS│ │ UPSTASH REDIS│ │  ELEVENLABS  │      │  SUPABASE Postgres │
│  REST API    │ │ token cache  │ │  + TWILIO    │      │                    │
│              │ │ (in-memory   │ │  (phone,     │      │  • calls (+ JSON   │
│ bearer/refresh│ │  in mock)   │ │   phase 2)   │      │    transcript)     │
│ /Consignments│ │              │ │              │      │  • drivers (PII)   │
│              │ │              │ │              │      │  • portal_lookups  │
│ ⚙ MSW mock   │ │              │ │              │      │    (audit log)     │
│  until live  │ │              │ │              │      │                    │
└──────────────┘ └──────────────┘ └──────────────┘      └────────────────────┘

Hosting: Vercel (Next.js).   Mode flag: PALLEX_MOCK=true → MSW mock + in-memory token store.
```

## How a request flows

**Web lookup:** Portal form → `lookup` server action → Tracking Service →
Nexus Client (token + breaker) → Nexus API (MSW mock) → status mapped to plain
English → rendered. Every attempt written to `portal_lookups`.

**Voice lookup (browser demo):** "Call us" button → ElevenLabs agent over WebRTC
→ agent captures + NATO-confirms consignment & postcode → calls the
`lookup_consignment` **client tool** → browser POSTs same-origin to
`/api/voice/demo_lookup` → Tracking Service (same brain as web) → agent reads
back only the returned fields (never invents data).

**Voice lookup (phone, production):** identical, except ElevenLabs/Twilio call
the **signed webhook** `/api/voice/lookup_consignment` (HMAC verified) instead of
a browser client tool.

**Driver escalation (phase 2):** no live ETA → agent offers to call the driver →
`contact_driver` tool → driver looked up in `drivers` → ElevenLabs places an
outbound Twilio call → driver's spoken ETA relayed back to the customer.

**Admin dashboard:** staff login (iron-session) → `/dashboard` reads `calls`,
`drivers`, `portal_lookups` via repositories → metrics, call history, transcripts,
recordings, driver CRUD.

## Cross-cutting

- **Auth to Pall-Ex:** username/password → 1h bearer + 24h refresh, single-flight
  refresh to avoid 401 races; tokens cached in Redis (in-memory under mock mode).
- **Resilience:** circuit breaker around Nexus; failures degrade to a safe
  "service unavailable" rather than throwing to callers.
- **Compliance:** AI + recording disclosure first on every call; driver numbers
  are personal data; 30-day recording retention; postcode gate before any
  delivery details are shared.
```
