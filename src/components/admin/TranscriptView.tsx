'use client';

// TranscriptView — speaker-labelled transcript with JSON-parse + plain-text fallback.
// Receives only the transcript string for the specific call — not the whole CallRow (T-03-16).

interface TranscriptTurn {
  speaker: string; // "Agent" | "Customer"
  text: string;
  ts?: string; // optional timestamp
}

interface Props {
  transcript: string | null;
}

function parseTranscript(raw: string): TranscriptTurn[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      return parsed as TranscriptTurn[];
    }
    return null;
  } catch {
    return null;
  }
}

export function TranscriptView({ transcript }: Props) {
  if (!transcript || transcript.trim() === '') {
    return (
      <section>
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Transcript</h2>
        <p className="text-sm text-zinc-500">Transcript not available for this call.</p>
      </section>
    );
  }

  const turns = parseTranscript(transcript);

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">Transcript</h2>
      <div className="max-h-[60vh] overflow-y-auto border border-zinc-200 rounded-xl bg-background">
        {turns ? (
          // Structured JSON transcript — render speaker-labelled turns
          <ol className="flex flex-col divide-y divide-zinc-100">
            {turns.map((turn, i) => {
              const isCustomer = turn.speaker?.toLowerCase() === 'customer';
              return (
                <li
                  key={i}
                  className={`px-4 py-3 ${isCustomer ? 'bg-zinc-50 rounded-lg' : ''}`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    {/* aria-hidden so screen reader doesn't duplicate the speaker prefix */}
                    <span
                      aria-hidden="true"
                      className="text-sm font-semibold text-zinc-500 shrink-0"
                    >
                      {turn.speaker}
                    </span>
                    {turn.ts && (
                      <span className="font-mono text-sm text-zinc-400">{turn.ts}</span>
                    )}
                  </div>
                  {/* Logical reading order: speaker context above, message text here for screen readers */}
                  <p className="text-sm text-zinc-900 leading-relaxed">{turn.text}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          // Plain-text fallback (Phase 4 transcripts may arrive as raw strings)
          <pre className="p-4 text-sm text-zinc-900 leading-relaxed whitespace-pre-wrap font-sans">
            {transcript}
          </pre>
        )}
      </div>
    </section>
  );
}
