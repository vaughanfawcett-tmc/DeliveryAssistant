'use client';

import { useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';

interface Props {
  /** ElevenLabs agent id — read server-side from env and passed in. */
  agentId: string;
}

interface LookupResponse {
  ok?: boolean;
  reason?: string;
  consignmentNumber?: string;
  plainStatus?: string;
  description?: string;
  estimatedDelDate?: string | null;
  startWindow?: string | null;
  endWindow?: string | null;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}

/** Turn the lookup response into a single, speech-ready sentence for the agent. */
function describeLookup(data: LookupResponse): string {
  if (!data || data.ok !== true) {
    switch (data?.reason) {
      case 'postcode_mismatch':
        return "I found that consignment, but the postcode doesn't match our records. Could you double-check the delivery postcode for me?";
      case 'not_found':
        return "I'm sorry, I couldn't find a delivery with those details. Could you double-check the consignment number and postcode?";
      case 'multiple_matches':
        return 'I found more than one delivery matching that. Could you read me the full consignment number?';
      default:
        return "I'm sorry, I can't retrieve delivery information right now due to a system issue. Would you like me to put you through to a colleague?";
    }
  }

  const parts: string[] = [
    `Here's the latest on consignment ${data.consignmentNumber}: ${data.description ?? data.plainStatus}.`,
  ];
  if (data.startWindow && data.endWindow) {
    const day = formatDate(data.estimatedDelDate);
    parts.push(
      `It's expected between ${data.startWindow} and ${data.endWindow}${day ? ` on ${day}` : ''}.`,
    );
  } else if (data.estimatedDelDate) {
    parts.push(`The estimated delivery date is ${formatDate(data.estimatedDelDate)}.`);
  } else {
    parts.push("We don't have a confirmed delivery time just yet.");
  }
  return parts.join(' ');
}

/**
 * In-browser voice agent demo. Talks to the public ElevenLabs Derby Aggregates agent
 * over WebRTC and answers its `lookup_consignment` client-tool calls by hitting
 * our same-origin /api/voice/demo_lookup endpoint (real delivery data, no
 * fabrication — VOICE-08). No phone number or webhook tunnel required.
 */
function VoiceAssistantInner({ agentId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [lastLookup, setLastLookup] = useState<string | null>(null);

  const conversation = useConversation({
    clientTools: {
      // The agent calls this once it has captured + confirmed both fields.
      // IMPORTANT: return a plain, speech-ready SENTENCE — not raw JSON. The
      // agent reads the returned string back verbatim, so a clean sentence is
      // far more reliable than asking the LLM to parse JSON fields.
      lookup_consignment: async (params: Record<string, unknown>) => {
        const trackingRef = String(params.trackingRef ?? '').trim();
        const postcode = String(params.postcode ?? '').trim();
        setLastLookup(`Looking up ${trackingRef} / ${postcode}…`);
        try {
          const res = await fetch('/api/voice/demo_lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingRef, postcode }),
          });
          const data = await res.json();
          const spoken = describeLookup(data);
          setLastLookup(spoken);
          return spoken;
        } catch {
          return "I'm sorry, I couldn't reach the delivery system just now. You can try again in a moment, or I can put you through to a colleague.";
        }
      },
    },
    onError: (message: string) => setError(message),
    onDisconnect: () => setLastLookup(null),
    // Surfaces in the browser console for diagnosis if anything stalls.
    onDebug: (info: unknown) => console.debug('[voice]', info),
    onUnhandledClientToolCall: (call: unknown) =>
      console.warn('[voice] unhandled tool call', call),
  });

  const status = conversation.status;
  const connected = status === 'connected';
  const connecting = status === 'connecting';

  async function start() {
    setError(null);
    try {
      // Prompt for mic up-front so the failure mode is obvious if denied.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId, connectionType: 'webrtc' });
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it and try again.'
          : 'Could not start the call. Check your connection and try again.',
      );
    }
  }

  function stop() {
    conversation.endSession();
    setLastLookup(null);
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            connected
              ? conversation.isSpeaking
                ? 'animate-pulse bg-accent'
                : 'bg-green-500'
              : connecting
                ? 'animate-pulse bg-amber-400'
                : 'bg-zinc-300'
          }`}
          aria-hidden
        />
        <span className="text-sm text-zinc-600">
          {connected
            ? conversation.isSpeaking
              ? 'Assistant speaking…'
              : 'Listening…'
            : connecting
              ? 'Connecting…'
              : 'Ready'}
        </span>
      </div>

      {!connected ? (
        <button
          onClick={start}
          disabled={connecting}
          className="h-14 w-full rounded-full bg-accent px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {connecting ? 'Connecting…' : '📞 Call us and get an update'}
        </button>
      ) : (
        <button
          onClick={stop}
          className="h-12 w-full rounded-full border border-red-300 bg-red-50 px-6 font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          End call
        </button>
      )}

      {lastLookup && (
        <p className="text-xs text-zinc-500" aria-live="polite">
          {lastLookup}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-zinc-400">
        Speak naturally — the assistant will ask for your tracking number and
        postcode. Try <strong>PA-12345</strong> / <strong>DE1 1AA</strong>.
      </p>
    </div>
  );
}

export function VoiceAssistant({ agentId }: Props) {
  return (
    <ConversationProvider>
      <VoiceAssistantInner agentId={agentId} />
    </ConversationProvider>
  );
}
