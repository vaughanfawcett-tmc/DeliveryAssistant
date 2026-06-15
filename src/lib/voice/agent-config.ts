/**
 * ElevenLabs Agent configuration-as-code (D-01).
 *
 * Keeping the agent definition in-repo makes it reviewable, diff-able, and
 * re-deployable — the human upload step is documented in the production runbook
 * (04-PRODUCTION-RUNBOOK.md).
 *
 * Requirements satisfied:
 *   VOICE-01 — AI-disclosure + recording-consent first (first_message === DISCLOSURE)
 *   VOICE-02 — NATO read-back + confirm before lookup (encoded in system_prompt)
 *   VOICE-03 — DTMF '#' terminator fallback
 *   VOICE-05 — 3-attempt cap → human handoff
 *   VOICE-06 — on-demand "0" / "agent" handoff
 *   VOICE-08 — never-invent-data rule (structural + prompt layer)
 *
 * Threat model:
 *   T-04-24 — system_prompt encodes never-invent-data; backend tools are the hard guarantee.
 *   T-04-27 — first_message === DISCLOSURE (test-asserted); AI + recording consent precedes capture.
 */

import { DISCLOSURE } from './compliance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single server-tool that the ElevenLabs agent may invoke. */
export interface VoiceToolDef {
  /** Unique tool identifier — must match the ElevenLabs agent dashboard entry. */
  name: string;
  /** Path component of the webhook URL (e.g. `/api/voice/lookup_consignment`). */
  url_path: string;
  /** Human-readable description for the ElevenLabs platform UI and for review. */
  description: string;
}

/** Root shape of the version-controlled agent definition. */
export interface AgentConfig {
  /** Opening utterance — always the DISCLOSURE constant (VOICE-01 / T-04-27). */
  first_message: string;
  /** Full system prompt encoding the conversation rules. */
  system_prompt: string;
  /** Ordered list of server tools the agent may call. */
  tools: VoiceToolDef[];
  /** DTMF settings — '#' terminates an entry (VOICE-03). */
  dtmf: {
    terminator: '#';
  };
}

// ---------------------------------------------------------------------------
// Tool paths (export for grep/test validation)
// ---------------------------------------------------------------------------

/** The five backend tool URL paths the agent is authorised to invoke. */
export const TOOL_PATHS = [
  '/api/voice/lookup_consignment',
  '/api/voice/request_human',
  '/api/voice/contact_driver',
  '/api/voice/call_started',
  '/api/voice/call_ended',
] as const;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * System prompt for the Derby Aggregates delivery-tracking voice agent.
 *
 * Encodes:
 *  - Capture + NATO read-back + confirm rule (VOICE-02)
 *  - DTMF '#' fallback (VOICE-03)
 *  - 3-attempt cap + forced handoff (VOICE-05)
 *  - On-demand "0" / "agent" handoff (VOICE-06)
 *  - Never-invent-data / only state information returned by the API (VOICE-08)
 */
const SYSTEM_PROMPT = `You are an automated AI customer-service agent for Derby Aggregates, a freight and haulage company. You help callers track their deliveries by looking up consignment status through our secure backend tools.

## Role and Constraints

- You are an AI assistant — you identified yourself as automated in your opening message.
- You may ONLY state information returned by the lookup tool. Never invent, guess, or estimate delivery details. If the tool returns no data, say so plainly and offer to transfer the caller to a human agent.
- Only state information returned by the lookup tool. Do not fabricate ETAs, addresses, or statuses.

## Conversation Flow

### Step 1 — Capture consignment number
Ask the caller for their consignment number. Accept spoken input or DTMF keypad entry (terminated by '#').

### Step 2 — NATO read-back and confirmation (VOICE-02)
Read back each letter using the NATO phonetic alphabet (A for Alfa, B for Bravo, etc.) and each digit as its spoken word. Ask the caller to confirm: "Is that correct? Please say yes or no."

### Step 3 — Capture delivery postcode
After confirming the consignment number, ask for the delivery postcode. Apply the same NATO read-back and confirmation rule.

### Step 4 — Lookup
Once both fields are confirmed, call the lookup_consignment tool with the confirmed values. Read back only the status and time window fields from the tool response. Never add information not present in the response.

## DTMF Fallback (VOICE-03)
If the caller says they prefer to use the keypad, instruct them to key in their consignment number or postcode followed by the '#' key.

## Attempt Limit (VOICE-05)
If the caller fails to confirm a field after 3 attempts, call the request_human tool with a warm handoff summary of the call so far (what was attempted and any partial information captured). Do not make a 4th capture attempt.

## On-Demand Human Transfer (VOICE-06)
If the caller says "0", "agent", "human", or "speak to someone" at any point, immediately call the request_human tool. Provide a summary of the call so far.

## System Downtime (VOICE-07)
If the lookup_consignment tool returns an api_error, tell the caller you cannot retrieve delivery information right now due to a system issue. Offer to transfer them to a team member or ask them to try again in a few minutes.

## Driver ETA (DRIV-01)
If the lookup returns no live ETA, offer to contact the assigned driver for a current ETA. If the caller consents, call the contact_driver tool. Relay the driver's response to the caller verbatim — only state information returned by the contact_driver tool.

## Compliance
- Call recording consent was announced in your opening message.
- Do not re-announce recording during the call.
- Call the call_started tool at the beginning of each conversation and call_ended at the end with the outcome.
`;

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

/**
 * Version-controlled ElevenLabs agent definition.
 * Upload this configuration via the ElevenLabs dashboard or Management API
 * (see 04-PRODUCTION-RUNBOOK.md, Step 1).
 */
export const agentConfig: AgentConfig = {
  // VOICE-01 / T-04-27: Disclosure must be the first thing the agent says.
  // Import — never duplicate — the DISCLOSURE constant so changes stay in sync
  // and the test assertion `first_message === DISCLOSURE` always holds.
  first_message: DISCLOSURE,

  system_prompt: SYSTEM_PROMPT,

  tools: [
    {
      name: 'lookup_consignment',
      url_path: TOOL_PATHS[0],
      description:
        'Look up delivery status for a consignment number + postcode. ' +
        'Returns status, plain-English status, and estimated delivery window when available. ' +
        'Only call after both values have been captured and confirmed by the caller.',
    },
    {
      name: 'request_human',
      url_path: TOOL_PATHS[1],
      description:
        'Transfer the caller to a human agent. ' +
        'Call this when the caller requests a human, after 3 failed capture attempts, ' +
        'or whenever a warm handoff is the safest option. ' +
        'Provide a summary parameter with the call context.',
    },
    {
      name: 'contact_driver',
      url_path: TOOL_PATHS[2],
      description:
        'Place an outbound call to the assigned driver to obtain a live ETA. ' +
        'Only call with caller consent and only when the lookup returned no live ETA. ' +
        'Returns the driver response or an error if the driver is unreachable.',
    },
    {
      name: 'call_started',
      url_path: TOOL_PATHS[3],
      description:
        'Lifecycle webhook — signal that a new inbound customer call has started. ' +
        'Call this at the very beginning of every conversation to create the call record.',
    },
    {
      name: 'call_ended',
      url_path: TOOL_PATHS[4],
      description:
        'Lifecycle webhook — signal that the call has ended. ' +
        'Provide the outcome (resolved | escalated | no_data | failed) and the call transcript. ' +
        'Call this before the connection drops so the record is persisted.',
    },
  ],

  dtmf: {
    terminator: '#',
  },
};
