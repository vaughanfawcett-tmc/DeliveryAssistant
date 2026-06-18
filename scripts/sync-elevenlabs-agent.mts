/**
 * Creates (or updates) the Derby Aggs delivery-assistant agent in ElevenLabs
 * from the in-repo agent definition (src/lib/voice/agent-config.ts), so the live
 * agent always matches the reviewed spec (disclosure-first, NATO prompt, etc.).
 *
 * For the browser demo the lookup runs as a CLIENT tool (executed in the page by
 * the ElevenLabs widget), so no public webhook tunnel is required. The phone
 * path uses the server-tool webhooks instead (see 04-PRODUCTION-RUNBOOK.md).
 *
 * Usage:  npx tsx scripts/sync-elevenlabs-agent.mts
 * Reads ELEVENLABS_API_KEY from .env.local; writes ELEVENLABS_AGENT_ID back to it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { agentConfig } from '../src/lib/voice/agent-config.ts';

// ---- env -------------------------------------------------------------------
const ENV_PATH = '.env.local';
const envText = readFileSync(ENV_PATH, 'utf8');
const env: Record<string, string> = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const API_KEY = env.ELEVENLABS_API_KEY;
if (!API_KEY) throw new Error('ELEVENLABS_API_KEY missing from .env.local');

const KB_ID = 'ryowtRvOyIbmHyJ39pFi'; // created via /v1/convai/knowledge-base/text
const VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice — clear British female
const BASE = 'https://api.elevenlabs.io';

// ---- client tool: lookup_consignment --------------------------------------
// type:"client" → handled in-browser by the widget; no webhook URL needed.
const lookupTool = {
  type: 'client',
  name: 'lookup_consignment',
  description:
    'Look up delivery status for a consignment number + postcode. Returns ok, ' +
    'plainStatus, description, currentStage, and estimated window when available. ' +
    'Only call after both values have been captured and confirmed by the caller.',
  response_timeout_secs: 20,
  expects_response: true,
  parameters: {
    type: 'object',
    properties: {
      trackingRef: {
        type: 'string',
        description: 'The consignment / tracking number, e.g. PA-12345',
      },
      postcode: {
        type: 'string',
        description: 'The delivery postcode, e.g. DE1 1AA',
      },
    },
    required: ['trackingRef', 'postcode'],
  },
};

// ---- client tool: end_call ------------------------------------------------
// type:"client" → the browser widget handles it (VoiceAssistant schedules
// endSession ~2s later so the agent's closing line finishes first). The agent
// is instructed (system prompt Step 5) to say a brief goodbye, THEN call this.
const endCallTool = {
  type: 'client',
  name: 'end_call',
  description:
    'End the conversation and hang up. Call this only after you have spoken a ' +
    'brief closing line and the caller has no further questions. Takes no parameters.',
  response_timeout_secs: 5,
  expects_response: true,
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const body = {
  name: 'Derby Aggs Delivery Assistant',
  conversation_config: {
    agent: {
      first_message: agentConfig.first_message,
      language: 'en',
      prompt: {
        prompt: agentConfig.system_prompt,
        llm: 'gpt-4o-mini',
        temperature: 0.3,
        tools: [lookupTool, endCallTool],
        knowledge_base: [
          {
            type: 'text',
            id: KB_ID,
            name: 'Derby Aggs Delivery Assistant KB',
            usage_mode: 'auto',
          },
        ],
      },
    },
    tts: {
      voice_id: VOICE_ID,
      model_id: 'eleven_turbo_v2',
      optimize_streaming_latency: 4, // lowest latency — snappier replies
      speed: 1.08, // slightly quicker delivery without sounding rushed
    },
    // Snappier turns + auto-hang-up on silence (the caller asked for both).
    turn: {
      turn_timeout: 6, // re-engage sooner if the caller goes quiet mid-turn
      // End the call after ~12s of total silence (no caller audio at all).
      silence_end_call_timeout: 12,
    },
    conversation: {
      max_duration_seconds: 600,
    },
  },
  platform_settings: {
    auth: { enable_auth: false }, // public agent → browser connects with agentId only
  },
};

async function main() {
  const existingId = env.ELEVENLABS_AGENT_ID;
  const isUpdate = existingId && existingId.startsWith('agent_');
  const url = isUpdate
    ? `${BASE}/v1/convai/agents/${existingId}`
    : `${BASE}/v1/convai/agents/create`;
  const method = isUpdate ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}\n${text}`);
    process.exit(1);
  }
  const json = JSON.parse(text);
  const agentId = json.agent_id ?? existingId;
  console.log(`${isUpdate ? 'Updated' : 'Created'} agent: ${agentId}`);

  // Persist agent id to .env.local
  const newEnv = envText.includes('ELEVENLABS_AGENT_ID=')
    ? envText.replace(/ELEVENLABS_AGENT_ID=.*/, `ELEVENLABS_AGENT_ID=${agentId}`)
    : envText.trimEnd() + `\nELEVENLABS_AGENT_ID=${agentId}\n`;
  writeFileSync(ENV_PATH, newEnv);
  console.log('Wrote ELEVENLABS_AGENT_ID to .env.local');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
