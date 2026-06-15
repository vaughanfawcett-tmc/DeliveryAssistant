'use client';

import { useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';

interface Props {
  /** ElevenLabs agent id — read server-side from env and passed in. */
  agentId: string;
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
      lookup_consignment: async (params: Record<string, unknown>) => {
        const trackingRef = String(params.trackingRef ?? '');
        const postcode = String(params.postcode ?? '');
        setLastLookup(`Looking up ${trackingRef} / ${postcode}…`);
        try {
          const res = await fetch('/api/voice/demo_lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingRef, postcode }),
          });
          const data = await res.json();
          setLastLookup(
            data.ok
              ? `${trackingRef}: ${data.plainStatus}`
              : `${trackingRef}: ${data.reason}`,
          );
          // The tool result is fed back to the agent as a string it reads from.
          return JSON.stringify(data);
        } catch {
          return JSON.stringify({ ok: false, reason: 'api_error' });
        }
      },
    },
    onError: (message: string) => setError(message),
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
