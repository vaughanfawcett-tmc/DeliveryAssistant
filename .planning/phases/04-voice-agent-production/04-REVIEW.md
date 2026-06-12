---
phase: 04-voice-agent-production
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/app/api/voice/call_ended/route.ts
  - src/app/api/voice/call_started/route.ts
  - src/app/api/voice/contact_driver/route.ts
  - src/app/api/voice/lookup_consignment/route.ts
  - src/app/api/voice/request_human/route.ts
  - src/lib/voice/webhook-auth.ts
  - src/lib/voice/conversation-machine.ts
  - src/lib/voice/driver-escalation.ts
  - src/lib/voice/compliance.ts
  - src/lib/voice/nato.ts
  - src/lib/voice/retention.ts
  - src/lib/voice/agent-config.ts
  - src/lib/voice/telephony/adapter.ts
  - src/lib/voice/telephony/elevenlabs-twilio-adapter.ts
  - src/lib/voice/telephony/mock-adapter.ts
  - src/lib/voice/types.ts
  - src/lib/repositories/calls-repo.ts
  - src/lib/repositories/drivers-repo.ts
  - src/app/dashboard/calls/[id]/page.tsx
  - src/lib/env.ts
  - src/mocks/voice-handlers.ts
findings:
  critical: 4
  warning: 6
  info: 2
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 4 covers the public webhook surface for the AI voice agent (`/api/voice/*` on ElevenLabs+Twilio) and the outbound driver-escalation flow. Four critical issues were found. The most important: `contact_driver` implements its own HMAC verifier in isolation (as its comment acknowledges) but the two verifiers accept different signature header formats, creating an inconsistency that could silently bypass auth under certain ElevenLabs header shapes. More broadly, no webhook route enforces a timestamp staleness window, making all five routes vulnerable to indefinite replay of captured webhook bodies. A third critical issue is that `recording_url` — a provider-credentialed URL — is stored verbatim and re-surfaced to the admin UI with no TTL or proxying guard. A fourth issue is that `updateCall` is keyed on the caller-supplied `platformCallId` with no ownership check, allowing an authenticated webhook sender to overwrite any call's record.

No invented-data issues were found in `conversation-machine.ts` or `lookup_consignment`. The driver-escalation retry logic is correct. PII masking at the dashboard boundary is applied consistently.

---

## Critical Issues

### CR-01: Duplicate HMAC verifiers accept different header formats

**File:** `src/app/api/voice/contact_driver/route.ts:43-81`

**Issue:** `contact_driver` implements its own `verifyVoiceSignature` instead of importing from `src/lib/voice/webhook-auth.ts`. The two implementations accept *different* header schemas for the ElevenLabs path:

- `webhook-auth.ts` (`case 'elevenlabs'`): reads header `elevenlabs-signature` and expects a bare hex string (line 92).
- `contact_driver` local verifier: reads header `x-elevenlabs-signature` and expects the structured `t=<ts>,v1=<hex>` format (line 49).

Neither header name nor format matches the other. As a result, `contact_driver` will reject valid ElevenLabs signatures that `webhook-auth.ts` would accept (or vice versa, depending on which format ElevenLabs actually sends). This divergence could cause real calls to fail auth or — if an attacker determines the looser path — could be exploited. Additionally, the local verifier exports `verifyVoiceSignature` under the same name as the canonical one, creating a confusing dual API.

The comment at the top of `contact_driver` acknowledges `webhook-auth.ts` was "in a sibling wave and NOT available in this worktree" — but that build-time isolation concern no longer applies once both files exist in the same tree.

**Fix:** Delete the local verifier from `contact_driver/route.ts` and import from the canonical module. Decide which header/format is correct for ElevenLabs (most likely `elevenlabs-signature` with a bare hex, matching ElevenLabs' documented format) and update `webhook-auth.ts` if needed:

```typescript
// contact_driver/route.ts — replace the inline verifier block with:
import { verifyProviderSignature } from '@/lib/voice/webhook-auth';

// In POST handler, replace the inline call with:
if (!verifyProviderSignature('elevenlabs', rawBody, req.headers)) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

### CR-02: No replay protection (timestamp staleness) on any webhook route

**File:** `src/lib/voice/webhook-auth.ts:80-114` (affects all five `/api/voice/*` routes)

**Issue:** All five webhook routes call `verifyProviderSignature`, which performs HMAC verification only. There is no timestamp window check. A captured request with a valid signature can be replayed indefinitely.

For `contact_driver` specifically, the local verifier parses the `t=<timestamp>` field out of the ElevenLabs structured header (line 51: `elevenlabsSig.match(/v1=([0-9a-f]+)/i)`) but silently discards the timestamp — it is never extracted or checked. This means a replayed signed `contact_driver` request could place outbound driver calls at any time in the future.

**Fix:** Add a `maxAgeSeconds` parameter (default 300 — 5 minutes) to `verifyProviderSignature`. For the ElevenLabs structured header path, parse the `t=` field, compare to the current clock, and reject if stale. For providers that do not include a timestamp, document the limitation explicitly and consider adding a nonce table or Supabase idempotency key check on `platform_call_id`.

```typescript
// webhook-auth.ts — add to verifyProviderSignature for elevenlabs case:
case 'elevenlabs': {
  const sigHeader = headers.get('elevenlabs-signature') ?? '';
  const tMatch = sigHeader.match(/t=(\d+)/);
  const v1Match = sigHeader.match(/v1=([0-9a-f]+)/i);
  if (!tMatch || !v1Match) return false;

  const signedAt = parseInt(tMatch[1], 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - signedAt) > 300) return false; // 5-min window

  return verifyVoiceSignature(rawBody, v1Match[1], secret);
}
```

---

### CR-03: Provider recording URL stored and served verbatim — may contain embedded credentials

**File:** `src/app/api/voice/call_ended/route.ts:81` and `src/app/dashboard/calls/[id]/page.tsx:54`

**Issue:** `recording_url` is accepted from the ElevenLabs webhook payload (caller-supplied string, validated only as `z.string().optional()`) and stored directly in the `calls` table. The admin dashboard page at `calls/[id]/page.tsx:54` then passes it unchanged to `<RecordingPlayer recordingUrl={call.recording_url} />`.

ElevenLabs and Twilio recording URLs typically include time-limited signed query parameters (`X-Amz-Signature`, `AccessKeyId`, etc.) embedded in the URL itself. Re-surfacing these to the browser exposes the credential-bearing URL to any admin browsing the dashboard. If the recording URL is stored for 30+ days (the GDPR retention window) but the embedded credential expires sooner, the link breaks silently with no error to the user.

Additionally, there is no allowlist validation on `recording_url` — a compromised ElevenLabs account or MITM could inject an arbitrary URL that the browser then fetches (SSRF via `<audio src>`).

**Fix:**
1. Add an allowlist check on `recording_url` in `call_ended` before storing — e.g. require the URL to match `https://*.elevenlabs.io/` or `https://*.twilio.com/`:
```typescript
// call_ended/route.ts — after zod parse, before updateCall:
const ALLOWED_RECORDING_HOSTS = ['.elevenlabs.io', '.twilio.com'];
if (parsed.recordingUrl) {
  const url = new URL(parsed.recordingUrl); // throws on invalid URL
  const allowed = ALLOWED_RECORDING_HOSTS.some(h => url.hostname.endsWith(h));
  if (!allowed) {
    return Response.json({ error: 'Invalid recording URL host' }, { status: 400 });
  }
}
```
2. Consider proxying recording playback server-side (Next.js route handler re-fetches with server-side credentials) rather than passing raw provider URLs to the browser.

---

### CR-04: `updateCall` keyed on caller-supplied `platform_call_id` with no ownership check

**File:** `src/app/api/voice/call_ended/route.ts:75-82` and `src/lib/repositories/calls-repo.ts:209-218`

**Issue:** The `call_ended` webhook handler accepts a `platformCallId` from the request body (attacker-controlled, subject to HMAC but not ownership) and passes it directly to `updateCall`, which performs `UPDATE calls SET ... WHERE platform_call_id = $1`. There is no check that a `calls` row with that `platform_call_id` was actually created by the current call session (i.e., via a prior `call_started` event).

If an attacker (or a misbehaving ElevenLabs agent) sends a valid signed `call_ended` with the `platformCallId` of a *different, completed call*, the update silently succeeds — overwriting that call's transcript, outcome, recording URL, and disconnection reason. The `.update().eq()` pattern used by Supabase returns no error when zero rows are updated, so a non-existent or wrong ID also silently succeeds.

**Fix:** Before calling `updateCall`, verify the `platform_call_id` belongs to an existing row with the expected `call_type`/`direction`, or change `updateCall` to additionally require `call_type='customer'` and `direction='inbound'` in the WHERE clause to limit blast radius:

```typescript
// calls-repo.ts — in updateCall, add a guard condition:
async function updateCall(platformCallId: string, patch: ...) {
  const { error } = await client
    .from('calls')
    .update(patch)
    .eq('platform_call_id', platformCallId)
    .eq('call_type', 'customer')   // prevents overwriting driver call rows
    .eq('direction', 'inbound');
  if (error) throw new Error(`[calls-repo] update failed: ${error.message}`);
}
```

For stronger protection, have `call_started` return the internal UUID and require `call_ended` to supply it (verifiable via primary key, not a platform-supplied string).

---

## Warnings

### WR-01: Zod validation errors leaked in 400 responses across all five routes

**File:** `src/app/api/voice/call_ended/route.ts:60`, `src/app/api/voice/call_started/route.ts:44`, `src/app/api/voice/lookup_consignment/route.ts:46`, `src/app/api/voice/request_human/route.ts:41`, `src/app/api/voice/contact_driver/route.ts:124`

**Issue:** Every route returns Zod error detail on invalid input:
```typescript
return Response.json({ error: 'Invalid request body', issues: result.error.issues }, { status: 400 });
// or:
return Response.json({ error: 'Invalid request body', details: result.error.flatten() }, { status: 400 });
```

This exposes internal field names, expected types, and schema structure to callers. For these public-facing voice webhook routes, a generic 400 is sufficient.

**Fix:** Return only a generic message:
```typescript
return Response.json({ error: 'Invalid request body' }, { status: 400 });
```

---

### WR-02: `contact_driver` returns HTTP 200 on consent denial

**File:** `src/app/api/voice/contact_driver/route.ts:140-145`

**Issue:** When `consented` is `false`, the route returns:
```typescript
return new Response(JSON.stringify({ contacted: false }), { status: 200, ... });
```
Returning 200 for a "no action was taken" response is semantically ambiguous. ElevenLabs tools interpret 2xx as success — the agent may not check the `contacted` boolean and could misreport to the customer that the driver was contacted. A 204 No Content or a structured `{ contacted: false, reason: 'no_consent' }` would be clearer.

**Fix:**
```typescript
return new Response(JSON.stringify({ contacted: false, reason: 'consent_not_given' }), {
  status: 200, // keep 200 so ElevenLabs tool call succeeds, but make payload unambiguous
  headers: { 'Content-Type': 'application/json' },
});
```
And update the agent system prompt to explicitly instruct the agent to check `contacted` before stating the driver was called.

---

### WR-03: Attempt counter is shared across tracking_ref and postcode capture

**File:** `src/lib/voice/conversation-machine.ts:241-284`

**Issue:** The `attempts` counter in `VoiceState` accumulates rejections across *both* capture fields. If a caller needs two attempts to confirm their tracking ref (`attempts = 2`) and then fails postcode confirmation once, `newAttempts = 3 >= MAX_ATTEMPTS = 3` triggers an immediate warm handoff — after only one postcode failure. The intent of VOICE-05 ("3 capture failures") appears to be 3 per field, not 3 total, but this is ambiguous in the requirements.

**Fix:** If the intent is per-field attempts, reset `attempts` to 0 when transitioning from tracking_ref confirmation to `awaiting_postcode`. Add a comment clarifying the policy either way:

```typescript
// In confirming case, on tracking_ref confirmed:
return {
  state: {
    ...state,
    phase: 'awaiting_postcode',
    confirmingField: undefined,
    attempts: 0,  // reset counter for postcode capture
    transcript,
  },
  actions: [agentSay(prompt)],
};
```

---

### WR-04: `X-Transfer-Summary` header sends call transcript excerpt to Twilio

**File:** `src/lib/voice/telephony/elevenlabs-twilio-adapter.ts:116-118`

**Issue:** `transferToHuman` attaches the `summary` string as a custom `X-Transfer-Summary` HTTP request header sent to the Twilio API:
```typescript
headers: {
  ...
  'X-Transfer-Summary': summary,
},
```
The `summary` is built by `buildSummary()` in `conversation-machine.ts` and includes caller-supplied tracking refs, postcodes, and a verbatim excerpt of the call transcript. Twilio logs all API requests — including headers — in their request inspector and potentially in their data retention. This sends PII (partial transcript content, postcodes) to a third party in a non-standard header outside of any GDPR data-processing agreement scope for that field.

The comment on line 113-114 says "summary is NOT sent to Twilio" but then immediately attaches it as a header on line 118.

**Fix:** Remove the `X-Transfer-Summary` header entirely. The summary is already available in the calls-repo audit trail for post-call review. If warm-handoff screen-pop is needed, consider a server-side mechanism (store summary against the `platform_call_id` and retrieve it in the dashboard).

```typescript
async transferToHuman(callId: string, toNumber: string, summary: string): Promise<void> {
  const url = `${this.cfg.twilioBaseUrl}/...`;
  const body = new URLSearchParams({
    Twiml: `<Response><Dial>${toNumber}</Dial></Response>`,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(this.cfg.twilioSid, this.cfg.twilioToken),
      // summary intentionally NOT sent to Twilio — logged via calls-repo instead
    },
    body: body.toString(),
  });
  await assertOk(response, 'transferToHuman');
}
```

---

### WR-05: `VOICE_WEBHOOK_SECRET` has a hardcoded insecure default

**File:** `src/lib/env.ts:39-42`

**Issue:**
```typescript
VOICE_WEBHOOK_SECRET: z
  .string()
  .min(32)
  .default('dev-only-insecure-voice-webhook-secret-change-me'),
```
In any environment where `VOICE_WEBHOOK_SECRET` is not set, webhook HMAC verification silently passes with the well-known default secret. Any attacker who reads this source file can sign arbitrary webhook payloads against the dev instances. Unlike `DASHBOARD_PASSWORD` (which has no default and fails to boot if absent), this credential can be silently omitted.

**Fix:** Remove the default and require the variable unconditionally, matching the `DASHBOARD_PASSWORD` pattern:
```typescript
VOICE_WEBHOOK_SECRET: z.string().min(32),
// No default — app must fail to boot if absent (same as DASHBOARD_PASSWORD)
```
If a dev-only bypass is needed, add an explicit `PALLEX_MOCK` check in the verifier (return true only when mock mode is on and the variable is absent).

---

### WR-06: `getCallById` called with raw URL param — no UUID format validation

**File:** `src/app/dashboard/calls/[id]/page.tsx:20`

**Issue:** The `id` path segment from the URL is passed directly to `getCallById(id)` with no format validation. While the Supabase `.eq()` call is parameterised (no SQL injection risk), an invalid UUID will cause a Supabase query error that returns `null`, triggering `notFound()`. This is not a crash but it does mean arbitrary strings hit the database on every request, and error messages from Supabase (if Supabase surfaces them) could leak schema information.

**Fix:** Add a UUID format check before the DB call:
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) notFound();
const call = await getCallById(id);
```

---

## Info

### IN-01: Exported `verifyVoiceSignature` from `contact_driver` shadows canonical export

**File:** `src/app/api/voice/contact_driver/route.ts:43`

**Issue:** The function `verifyVoiceSignature` is both exported from `webhook-auth.ts` and independently exported from `contact_driver/route.ts`. The `contact_driver` export is not used by any other module (it is a route file), but the shared name makes static analysis and refactoring error-prone. Once CR-01 is resolved by removing the local verifier, this becomes moot.

**Fix:** Remove the `export` keyword from the local `verifyVoiceSignature` in `contact_driver/route.ts` as an intermediate step (making it private to the file), then remove the function entirely when moving to the canonical import.

---

### IN-02: MSW voice handler base URLs evaluated at module import time

**File:** `src/mocks/voice-handlers.ts:57`

**Issue:** The ElevenLabs and Twilio base URL helper functions (`elevenLabsBase()`, `twilioBase()`) are called at module load time inside the `http.post(...)` template literals:
```typescript
http.post(`${elevenLabsBase()}/v1/convai/twilio/outbound-call`, ...)
```
If `ELEVENLABS_BASE_URL` or `TWILIO_BASE_URL` is set after the module is first imported (e.g. in a test setup file), the handler will use the stale value. The comment says it "mirrors the lazy-base-url pattern" but the handler path is not lazy.

**Fix:** Use a function or a dynamic URL pattern for the path to ensure the env variable is read at request time rather than at import time. Or document clearly that these handlers must be imported after env vars are set.

---

_Reviewed: 2026-06-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
