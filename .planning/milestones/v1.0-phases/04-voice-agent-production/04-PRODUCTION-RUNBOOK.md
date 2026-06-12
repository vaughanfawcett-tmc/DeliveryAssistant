# Production Runbook — Derby Aggs Delivery Assistant (Phase 4)

**Status:** PENDING HUMAN SIGN-OFF (SC-5 and SC-6 are human-action gates, not code)  
**Last updated:** 2026-06-12  
**Relates to:** D-13 (deferred human-action items), SC-5 (noise go/no-go), SC-6 (live cutover)

This document is the authoritative ordered checklist for every external step that cannot be performed or verified from code. Execute each item in sequence. Do not skip items or reorder.

---

## Prerequisites

Before starting this runbook, ensure:

- Phase 1–4 code is deployed to Vercel (all plans green, SUMMARY.md files present).
- You have admin access to: ElevenLabs dashboard, Twilio console, Vercel dashboard, Supabase dashboard, and the Pall-Ex Nexus API credentials (from your account manager).
- All infrastructure env vars listed below are noted and ready to set.

---

## Ordered Checklist

### HUMAN-ACTION: Step 1 — Provision ElevenLabs Agent + Twilio UK Number

**Status:** Awaiting execution  
**Reason this is human-only:** Requires paid ElevenLabs and Twilio accounts; no API in mock mode.

#### 1a. Create ElevenLabs Agent

1. Log in to [ElevenLabs dashboard](https://elevenlabs.io/app/conversational-ai).
2. Create a new Conversational AI agent.
3. Copy the agent definition from `src/lib/voice/agent-config.ts`:
   - Set **First Message** to the `first_message` field value (the AI-disclosure + recording-consent copy from `src/lib/voice/compliance.ts`).
   - Paste the `system_prompt` field into the **System Prompt** box.
   - Under **Tools / Server Tools**, add each of the five tools from `agentConfig.tools`:

     | Tool name              | Webhook URL (replace `<your-domain>`)           |
     |------------------------|-------------------------------------------------|
     | `lookup_consignment`   | `https://<your-domain>/api/voice/lookup_consignment` |
     | `request_human`        | `https://<your-domain>/api/voice/request_human` |
     | `contact_driver`       | `https://<your-domain>/api/voice/contact_driver` |
     | `call_started`         | `https://<your-domain>/api/voice/call_started`  |
     | `call_ended`           | `https://<your-domain>/api/voice/call_ended`    |

4. Note the agent's **Agent ID** — you will set it as `ELEVENLABS_AGENT_ID` in Step 2.
5. Note the agent's **Webhook Signing Secret** — you will set it as `ELEVENLABS_WEBHOOK_SECRET` in Step 2.

#### 1b. Buy a Twilio UK Phone Number

1. Log in to [Twilio Console](https://console.twilio.com/).
2. Navigate to **Phone Numbers → Manage → Buy a Number**.
3. Select country **United Kingdom (GB)**, type **Voice**, and purchase a number.
4. Note the number in E.164 format (e.g. `+441234567890`) — you will set it as `TWILIO_PHONE_NUMBER` in Step 2.
5. Note your **Account SID** and **Auth Token** from the Twilio dashboard home — you will set these as `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in Step 2.
6. Configure the Twilio number:
   - Under **Voice Configuration**, set the **A CALL COMES IN** webhook to:  
     `https://<your-domain>/api/voice/call_started`  
     Method: **HTTP POST**

---

### HUMAN-ACTION: Step 2 — Set Webhook URLs, Secrets, and Env Vars

**Status:** Awaiting execution  
**Reason this is human-only:** Secrets cannot be committed to code; must be set in Vercel dashboard and locally.

#### 2a. Set env vars in Vercel

Log in to [Vercel dashboard](https://vercel.com/dashboard) → your project → **Settings → Environment Variables**.

Add/update all of the following (all environments: Production, Preview, Development as appropriate):

| Variable | Value | Required when |
|----------|-------|---------------|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key (from dashboard → Profile → API Keys) | `PALLEX_MOCK=false` |
| `ELEVENLABS_AGENT_ID` | Agent ID from Step 1a | `PALLEX_MOCK=false` |
| `ELEVENLABS_WEBHOOK_SECRET` | Webhook signing secret from Step 1a | `PALLEX_MOCK=false` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID from Step 1b | `PALLEX_MOCK=false` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token from Step 1b | `PALLEX_MOCK=false` |
| `TWILIO_PHONE_NUMBER` | E.164 Twilio number from Step 1b | `PALLEX_MOCK=false` |
| `VOICE_WEBHOOK_SECRET` | A random 32+-character string (generate with `openssl rand -hex 32`) | Always |

> **Security note:** `VOICE_WEBHOOK_SECRET` is used for HMAC verification of all inbound voice webhooks (see `src/lib/voice/webhook-auth.ts`). It MUST be at least 32 characters. Do NOT use the dev-only default in production.

#### 2b. Verify env schema passes

After setting vars, trigger a Vercel deployment and confirm the build log does not contain `Invalid environment:` errors.

Locally, copy vars to `.env.local` and run:
```bash
PALLEX_MOCK=false npx tsx -e "import('./src/lib/env').then(m => console.log('env OK', m.env.ELEVENLABS_AGENT_ID))"
```

---

### HUMAN-ACTION: Step 3 (SC-5) — Real-World Noise STT Go/No-Go Test

**Status:** HUMAN-ACTION GATE — cannot be performed or verified from code  
**Criterion:** SC-5 — ElevenLabs Scribe v2 STT accurately captures alphanumeric consignment refs in a real-world noisy environment (lorry cab, depot yard).

This is a **decision gate**: PASS → stay on ElevenLabs; FAIL → pivot to Retell AI (see below).

#### Test procedure

1. With the Twilio number live (Step 1b complete), call the number from a device inside or near a lorry cab or depot yard (representative ambient noise).
2. Attempt to speak a realistic consignment reference (e.g. `PA123456`) and a postcode (e.g. `DE1 2AB`) in normal conversational speech.
3. Evaluate:
   - Did the agent correctly capture the consignment number on the first or second attempt?
   - Did the NATO read-back (`P for Papa, A for Alfa...`) match what you said?
   - Did the agent confirm correctly before proceeding to lookup?
4. Repeat with at least 3 different consignment references.

#### Pass criteria
- 3 out of 3 captures succeed within 2 spoken attempts each.
- No digit/letter transpositions that would produce an incorrect lookup.

#### PASS → Continue with ElevenLabs
No code changes required.

#### FAIL → Pivot to Retell AI
The telephony adapter must be swapped. This is the only code change required:

1. Create a Retell AI account and agent following Retell's setup guide.
2. In `src/lib/voice/telephony/`, create `retell-adapter.ts` implementing the same `VoiceTelephonyAdapter` interface as `elevenlabs-twilio-adapter.ts`.
3. Update the dependency injection point (the call handler in `src/app/api/voice/`) to use the Retell adapter instead.
4. All conversation and business logic in `src/lib/voice/conversation-machine.ts`, `src/lib/voice/driver-escalation.ts`, etc. remains unchanged — the adapter is the only swap.
5. Re-run the full test suite: `npm test`.
6. Re-run this SC-5 test with the Retell adapter live.

> **Note:** The pivot scope is intentionally minimal. The conversation machine, tool endpoints, persistence, and compliance logic are platform-agnostic by design (D-01).

---

### HUMAN-ACTION: Step 4 (SC-6a) — Pall-Ex Live Credentials Canary + Flip PALLEX_MOCK=false

**Status:** HUMAN-ACTION GATE — cannot be performed or verified from code  
**Criterion:** SC-6 — live Pall-Ex Nexus API connectivity confirmed before full cutover.

#### 4a. Obtain Pall-Ex live credentials

Contact your Pall-Ex account manager to obtain:
- `PALLEX_USERNAME` — your API username
- `PALLEX_PASSWORD` — your API password
- `PALLEX_BASE_URL` — production Nexus base URL (v2.2.1, typically `https://nexus.pall-ex.com/api`)

#### 4b. Run the canary test

Do NOT flip `PALLEX_MOCK` until the canary passes. Run the canary against a known-good consignment:

```bash
PALLEX_MOCK=false \
PALLEX_BASE_URL=<live_url> \
PALLEX_USERNAME=<live_username> \
PALLEX_PASSWORD=<live_password> \
SUPABASE_URL=$SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL \
UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN \
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD \
DASHBOARD_SESSION_SECRET=$DASHBOARD_SESSION_SECRET \
VOICE_WEBHOOK_SECRET=$VOICE_WEBHOOK_SECRET \
npx tsx -e "
import { lookupConsignment } from './src/lib/tracking/service';
const result = await lookupConsignment({ trackingRef: '<KNOWN_CONSIGNMENT>', postcode: '<KNOWN_POSTCODE>' });
console.log(JSON.stringify(result, null, 2));
"
```

Expected: `{ ok: true, consignment: { ... } }` with real delivery data.

#### 4c. Flip PALLEX_MOCK=false in Vercel

Only after the canary passes:

1. In Vercel dashboard → Environment Variables, set:
   - `PALLEX_MOCK` = `false`
   - `PALLEX_USERNAME` = `<live_username>`
   - `PALLEX_PASSWORD` = `<live_password>`
   - `PALLEX_BASE_URL` = `<live_url>`
2. Trigger a new deployment.
3. Verify the deployment log: confirm no `Invalid environment:` errors.
4. Place a live test call through the Twilio number and look up a real consignment.

> **Rollback:** If issues arise, set `PALLEX_MOCK=true` in Vercel and redeploy. This reverts all Nexus calls to MSW mock responses immediately.

---

### HUMAN-ACTION: Step 5 (SC-6b) — DPAs, Retention Purge Job, Vercel Pro + Supabase Pro

**Status:** HUMAN-ACTION GATE — cannot be performed or verified from code  
**Criterion:** SC-6 — GDPR/PECR compliance operational before production traffic.

#### 5a. Sign Data Processing Agreements (DPAs)

Before any real customer calls are taken:

1. **ElevenLabs DPA** — Request and sign the ElevenLabs Data Processing Agreement (available via ElevenLabs enterprise/legal contact). Confirm it covers call audio processed via Scribe v2.
2. **Twilio DPA** — Confirm the Twilio DPA in your Twilio account (Console → Account → Agreements → Data Processing Addendum).
3. **Supabase DPA** — Available at [supabase.com/dpa](https://supabase.com/dpa) — sign and retain a copy.
4. Retain signed copies in your legal/compliance folder.

#### 5b. Activate the 30-Day Recording Retention Purge Job

The retention helper is implemented in `src/lib/voice/retention.ts` (`RETENTION_DAYS = 30`). The purge job itself must be activated by an operator:

**Option A: Supabase pg_cron (recommended)**

Run the following in your Supabase SQL editor (replace table/column names if needed):

```sql
-- Enable pg_cron if not already enabled (Supabase Pro plan required)
create extension if not exists pg_cron;

-- Daily purge job: delete calls older than 30 days
select cron.schedule(
  'purge-old-calls',
  '0 3 * * *',   -- 03:00 UTC daily
  $$
    delete from public.calls
    where start_at < now() - interval '30 days';
  $$
);
```

Verify the job is scheduled:
```sql
select * from cron.job where jobname = 'purge-old-calls';
```

**Option B: Vercel Cron Job**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/purge-calls",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Create `src/app/api/cron/purge-calls/route.ts` using `retentionCutoff()` from `src/lib/voice/retention.ts` to delete rows.

> **Reference:** `RETENTION_DAYS` is defined in `src/lib/voice/retention.ts`. Any purge job MUST use `retentionCutoff()` from that module — do not hardcode `30` elsewhere so the policy value stays single-source.

#### 5c. Upgrade Vercel to Pro plan

1. Log in to [Vercel dashboard](https://vercel.com/dashboard) → Team Settings → Billing.
2. Upgrade to **Pro** plan.
3. Reason: Pro plan required for:
   - Cron jobs (if using Vercel cron option above)
   - Higher function concurrency for voice webhooks (low latency required by ElevenLabs)
   - Log retention and observability

#### 5d. Upgrade Supabase to Pro plan

1. Log in to [Supabase dashboard](https://supabase.com/dashboard) → Project Settings → Billing.
2. Upgrade to **Pro** plan.
3. Reason: Pro plan required for:
   - `pg_cron` extension (retention purge job)
   - Higher connection limits (concurrent voice webhook calls)
   - Point-in-time recovery (GDPR audit trail)

---

## Post-Cutover Verification

After completing all five steps, perform a full end-to-end verification:

- [ ] Make a live call to the Twilio UK number.
- [ ] Confirm AI-disclosure + recording-consent is spoken first (VOICE-01).
- [ ] Speak a real consignment number; confirm NATO read-back is correct (VOICE-02).
- [ ] Look up a real consignment; confirm only API-returned facts are spoken (VOICE-08).
- [ ] Say "agent" mid-call; confirm warm transfer fires (VOICE-06).
- [ ] Check the admin dashboard: confirm the call row appears with transcript and `recording_url` populated.
- [ ] Confirm the recording plays in RecordingPlayer on the call detail page.

---

## Rollback Procedures

| Issue | Rollback action |
|-------|----------------|
| Pall-Ex API errors after cutover | Set `PALLEX_MOCK=true` in Vercel → redeploy |
| ElevenLabs STT failures (SC-5) | Implement Retell adapter (Step 3 FAIL path) |
| Voice webhook auth failures | Regenerate `VOICE_WEBHOOK_SECRET` and `ELEVENLABS_WEBHOOK_SECRET` in Vercel + ElevenLabs dashboard |
| Retention purge job errors | Disable the cron job; manually run `DELETE ... WHERE start_at < now() - interval '30 days'` |

---

## Env Var Quick Reference

| Variable | Used by | Required when |
|----------|---------|---------------|
| `PALLEX_MOCK` | `src/lib/env.ts`, Nexus client | Always; `false` = live mode |
| `PALLEX_BASE_URL` | Nexus client | Always |
| `PALLEX_USERNAME` | Nexus auth | `PALLEX_MOCK=false` |
| `PALLEX_PASSWORD` | Nexus auth | `PALLEX_MOCK=false` |
| `ELEVENLABS_API_KEY` | ElevenLabs client | `PALLEX_MOCK=false` |
| `ELEVENLABS_AGENT_ID` | ElevenLabs client | `PALLEX_MOCK=false` |
| `ELEVENLABS_WEBHOOK_SECRET` | `src/lib/voice/webhook-auth.ts` | `PALLEX_MOCK=false` |
| `TWILIO_ACCOUNT_SID` | Twilio adapter | `PALLEX_MOCK=false` |
| `TWILIO_AUTH_TOKEN` | Twilio adapter | `PALLEX_MOCK=false` |
| `TWILIO_PHONE_NUMBER` | Twilio adapter | `PALLEX_MOCK=false` |
| `VOICE_WEBHOOK_SECRET` | `src/lib/voice/webhook-auth.ts` | Always (min 32 chars) |
| `DRIVER_CALL_MAX_DURATION_S` | Driver escalation | Always (default: 180) |
| `DRIVER_CALL_MAX_RETRIES` | Driver escalation | Always (default: 2) |
| `CONTACT_PHONE` | Human handoff transfer | Always |

---

*This runbook was generated as part of Phase 4 plan 06. SC-5 and SC-6 are explicitly human-action gates and cannot be faked, automated, or verified from code.*
